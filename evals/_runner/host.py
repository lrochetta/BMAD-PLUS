#!/usr/bin/env python3
"""Prepare and independently collect a tool-using host evaluation.

This module never launches a model, grants host permissions or provides an OS
sandbox. The caller supplies the actual host and keeps the preparation digest
outside the worker's writable workspace. Check scripts are trusted maintainer
code, withheld from the task packet and sealed before the worker starts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import run


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encoded(value) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def checked_path(value: Path) -> Path:
    """Reject links/junctions in every existing component, including parents."""
    absolute = value.absolute()
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        if part in (".", ".."):
            raise ValueError("Paths must be normalized")
        current = current / part
        if current.is_symlink() or (hasattr(current, "is_junction") and current.is_junction()):
            raise ValueError(f"Linked path is not allowed: {current}")
    return absolute


def inventory(root: Path) -> list[dict]:
    root = checked_path(root)
    records = []
    total = 0
    for file in sorted(root.rglob("*")):
        checked_path(file)
        if file.is_dir():
            continue
        if not file.is_file():
            raise ValueError(f"Not a regular file: {file}")
        data = file.read_bytes()
        total += len(data)
        if len(records) >= 200 or total > 2 * 1024 * 1024:
            raise ValueError("Input inventory exceeds the evaluation budget")
        records.append({"path": file.relative_to(root).as_posix(), "sha256": digest(data), "size_bytes": len(data)})
    return records


def spec_at(spec_id: str) -> tuple[Path, dict]:
    if len(spec_id.split("/")) != 2 or not run._is_safe_relpath(spec_id):
        raise ValueError("Specify an exact agent/task evaluation ID")
    source = checked_path(run.EVALS_ROOT / spec_id / "eval.yaml")
    spec = run.yaml.safe_load(source.read_text(encoding="utf-8"))
    errors = run.validate_spec(spec, source)
    if errors:
        raise ValueError("; ".join(errors))
    return source, spec


def prepare(spec_id: str, output: Path, variant: str = "agent", *,
            campaign_id: str | None = None, repetition: int = 1) -> dict:
    if type(repetition) is not int or not 1 <= repetition <= 20:
        raise ValueError("Repetition must be an integer in [1, 20]")
    if campaign_id is not None and (not run.safe_relative(campaign_id) or "/" in campaign_id):
        raise ValueError("Campaign ID must be one safe path component")
    source, spec = spec_at(spec_id)
    output = checked_path(output)
    fixture = checked_path(source.parent / spec["fixture"])
    checks = checked_path(source.parent / "checks")
    fixture_inventory = inventory(fixture)
    check_inventory = inventory(checks)
    if not checks.is_dir() or not check_inventory:
        raise ValueError("A native-host case needs a nonempty trusted checks directory")
    output.mkdir(parents=True, exist_ok=False)
    workspace = output / "workspace"
    shutil.copytree(fixture, workspace)
    shutil.copytree(checks, output / "checks")
    context = run.prepare_agent_context(
        spec, workspace, execution_mode="native-host", context_variant=variant,
    )
    context_bytes = encoded(asdict(context))
    packet = (
        f"# Execution workspace\n\n{workspace}\n\n"
        f"Allowed task writes: {', '.join(spec['task'].get('allowed_writes', ['.']))}\n\n"
        "Use your available host tools directly. All task writes must stay inside\n"
        "the execution workspace and the task's allowed write scope. Evaluation\n"
        "control files outside it are not task inputs. Return a final transcript\n"
        "describing what you actually did; the caller verifies your artifacts.\n\n"
        f"# Agent instructions\n\n{context.system}\n\n"
        f"# Task and supplied workspace context\n\n{context.prompt}\n"
    ).encode("utf-8")
    (output / "context.json").write_bytes(context_bytes)
    (output / "task.md").write_bytes(packet)
    manifest = {
        "schema_version": 1,
        "attempt_id": str(uuid.uuid4()),
        "prepared_at": now(),
        "spec_id": spec_id,
        "variant": variant,
        "execution_mode": "native-host",
        "spec_sha256": digest(source.read_bytes()),
        "fixture": fixture_inventory,
        "checks": check_inventory,
        "context_file_sha256": digest(context_bytes),
        "task_file_sha256": digest(packet),
        "workspace": str(workspace),
        "isolation": "explicit writable scope; no OS sandbox supplied by this harness",
    }
    if campaign_id is not None or repetition != 1:
        manifest["experiment"] = {"campaign_id": campaign_id, "repetition": repetition}
    manifest_bytes = encoded(manifest)
    (output / "preparation.json").write_bytes(manifest_bytes)
    return {
        "attempt": str(output), "attempt_id": manifest["attempt_id"],
        "task_file": str(output / "task.md"), "workspace": str(workspace),
        "preparation_sha256": digest(manifest_bytes), "variant": variant,
        "executed": False,
        "experiment": manifest.get("experiment"),
    }


def collect(attempt: Path, expected: str, transcript_file: Path, *, host_id: str,
            outcome: str = "completed", concrete_model: str | None = None,
            model_alias: str | None = None) -> dict:
    attempt = checked_path(attempt)
    if (attempt / "result.json").exists():
        raise ValueError("This attempt already has a result; use a new preparation for another run")
    manifest_bytes = checked_path(attempt / "preparation.json").read_bytes()
    if digest(manifest_bytes) != expected:
        raise ValueError("Preparation changed after the caller recorded its digest")
    manifest = json.loads(manifest_bytes)
    source, spec = spec_at(manifest["spec_id"])
    if digest(source.read_bytes()) != manifest["spec_sha256"]:
        raise ValueError("The evaluation spec changed after preparation")
    workspace = checked_path(attempt / "workspace")
    if str(workspace) != manifest["workspace"]:
        raise ValueError("This attempt was relocated; prepare a new explicitly bound workspace")
    for name, key in [("context.json", "context_file_sha256"), ("task.md", "task_file_sha256")]:
        if digest(checked_path(attempt / name).read_bytes()) != manifest[key]:
            raise ValueError(f"Prepared {name} changed")
    if inventory(attempt / "checks") != manifest["checks"]:
        raise ValueError("Trusted checks changed after preparation")
    context = run.context_from_dict(json.loads((attempt / "context.json").read_bytes()))
    transcript_path = checked_path(transcript_file)
    if transcript_path.stat().st_size > 512 * 1024:
        raise ValueError("Transcript exceeds 512 KiB")
    transcript = transcript_path.read_text(encoding="utf-8")
    claim = checked_path(attempt / "collection.json")
    claim_bytes = encoded({
        "schema_version": 1, "token": str(uuid.uuid4()), "pid": os.getpid(),
        "started_at": now(), "attempt_id": manifest["attempt_id"],
        "host_id": host_id, "preparation_sha256": expected,
    })
    try:
        with claim.open("xb") as stream:
            stream.write(claim_bytes)
            stream.flush()
            os.fsync(stream.fileno())
    except FileExistsError as exc:
        raise ValueError("Collection is active or interrupted; inspect collection.json and its owner before recovery") from exc
    # Another collector may have completed between the initial result check and
    # this claim. The exclusive marker prevents duplicate verifier execution.
    if (attempt / "result.json").exists():
        if claim.read_bytes() == claim_bytes:
            claim.unlink()
        raise ValueError("This attempt already has a result; verification was not repeated")
    collected_at = now()
    elapsed = (datetime.fromisoformat(collected_at) - datetime.fromisoformat(manifest["prepared_at"])).total_seconds()
    result = run.AgentResult(
        transcript=transcript, exit_ok=outcome == "completed", duration_s=elapsed, model=model_alias or "",
        meta={
            "provider": "native-host", "execution_mode": "native-host", "host_handle": host_id,
            "concrete_model": concrete_model, "effective_settings": {}, "usage": None,
            "host_outcome": outcome, "duration_basis": "preparation-to-collection wall time",
        },
    )
    report = run.score_external_run(
        source, spec, workspace, result, context=context, attempt_id=manifest["attempt_id"],
        checks_root=attempt / "checks",
    )
    if inventory(attempt / "checks") != manifest["checks"]:
        raise ValueError("A verification command changed the trusted checks")
    receipt = {
        "schema_version": 1, "attempt_id": manifest["attempt_id"],
        "spec_id": manifest["spec_id"], "variant": manifest["variant"],
        "preparation_sha256": expected, "spec_sha256": manifest["spec_sha256"],
        "fixture": manifest["fixture"], "checks": manifest["checks"],
        "prepared_at": manifest["prepared_at"], "collected_at": collected_at,
        "host": result.meta, "transcript_sha256": digest(transcript.encode("utf-8")),
        "report": asdict(report),
    }
    if "experiment" in manifest:
        receipt["experiment"] = manifest["experiment"]
    temporary = checked_path(attempt / (".result-" + str(uuid.uuid4()) + ".json"))
    with temporary.open("xb") as stream:
        stream.write(encoded(receipt))
        stream.flush()
        os.fsync(stream.fileno())
    # A same-directory hard link publishes complete bytes atomically and refuses
    # to replace an existing result. Interrupted finalization retains its claim.
    os.link(temporary, checked_path(attempt / "result.json"))
    temporary.unlink()
    if claim.read_bytes() != claim_bytes:
        raise ValueError("Collection ownership changed after verification; inspect the saved result")
    claim.unlink()
    return receipt


def compare(paths: list[Path], *, minimum_repetitions: int = 1) -> dict:
    if type(minimum_repetitions) is not int or not 1 <= minimum_repetitions <= 20:
        raise ValueError("Minimum repetitions must be an integer in [1, 20]")
    if len(paths) > 400:
        raise ValueError("Comparison exceeds 400 observations")
    receipts = []
    for path in paths:
        path = checked_path(path)
        if path.stat().st_size > 8 * 1024 * 1024:
            raise ValueError("An observation exceeds the 8 MiB receipt budget")
        receipts.append(json.loads(path.read_bytes()))
    pairs, seen_attempts, identities, repeated = {}, set(), {}, {}
    campaign_ids = set()
    for receipt in receipts:
        experiment = receipt.get("experiment") or {}
        repetition = experiment.get("repetition", 1)
        if type(repetition) is not int or not 1 <= repetition <= 20:
            raise ValueError("Receipt repetition must be an integer in [1, 20]")
        campaign_ids.add(experiment.get("campaign_id"))
        attempt_id = receipt["attempt_id"]
        if attempt_id in seen_attempts:
            raise ValueError("Duplicate attempt cannot manufacture repeated support")
        seen_attempts.add(attempt_id)
        pair = pairs.setdefault((receipt["spec_id"], repetition), {})
        variant = receipt["variant"]
        if variant not in ("agent", "generic-control") or variant in pair:
            raise ValueError("Each task/repetition must have exactly one result per variant")
        evidence = receipt["report"]["evidence"]
        if (receipt["host"]["execution_mode"] != "native-host"
                or evidence["execution"]["mode"] != "native-host"
                or evidence["context"]["execution_mode"] != "native-host"):
            raise ValueError("Do not combine mock or rendered-output scores with native-host observations")
        if (receipt["report"]["status"] == "pass") != bool(evidence["acceptance"]["accepted"]):
            raise ValueError("Receipt acceptance differs from its report")
        if evidence["context"]["context_variant"] != variant:
            raise ValueError("Receipt variant differs from effective context")
        if bool(evidence["context"]["resources"]) != (variant == "agent"):
            raise ValueError("Generic and agent evidence must remain separate")
        identity = {key: receipt[key] for key in ("spec_sha256", "fixture", "checks")}
        identity.update({"model": receipt["host"]["concrete_model"],
                         "model_alias": receipt["host"].get("model_alias") or evidence["execution"].get("model_alias"),
                         "settings": receipt["host"].get("effective_settings")})
        if receipt["spec_id"] in identities and identities[receipt["spec_id"]] != identity:
            raise ValueError("Comparison inputs differ across repetitions or variants")
        identities[receipt["spec_id"]] = identity
        resource_key = (receipt["spec_id"], variant)
        resources = evidence["context"]["resources"]
        if resource_key in repeated and repeated[resource_key] != resources:
            raise ValueError("Agent resource identities differ across repetitions")
        repeated[resource_key] = resources
        pair[variant] = receipt
    if not pairs:
        raise ValueError("No observations supplied")
    if len(campaign_ids) != 1:
        raise ValueError("Do not mix observations from different campaigns")
    for pair in pairs.values():
        if set(pair) != {"agent", "generic-control"}:
            raise ValueError("Every comparison task/repetition needs both variants")
    for spec_id in identities:
        observed = sorted(repetition for task, repetition in pairs if task == spec_id)
        if len(observed) < minimum_repetitions or observed != list(range(1, len(observed) + 1)):
            raise ValueError(f"Task {spec_id} is missing the required consecutive repetitions")
    return {
        "schema_version": 1, "execution_mode": "native-host", "tasks": len(identities),
        "paired_trials": len(pairs), "minimum_repetitions": minimum_repetitions,
        "campaign_id": next(iter(campaign_ids)),
        "observations": len(receipts),
        "acceptance": {
            variant: {"passed": sum(pair[variant]["report"]["status"] == "pass" for pair in pairs.values()),
                      "total": len(pairs)}
            for variant in ("generic-control", "agent")
        },
        "critical_regressions": [
            f"{key[0]}:r{key[1]}" for key, pair in pairs.items()
            if pair["generic-control"]["report"]["status"] == "pass" and pair["agent"]["report"]["status"] != "pass"
        ],
        "results": [{"id": key[0], "repetition": key[1],
                     **{variant: item["report"]["status"] for variant, item in pair.items()}}
                    for key, pair in sorted(pairs.items())],
        "limits": [
            "Repeated observations are counted separately; this small campaign makes no statistical or general model-quality claim.",
            "The caller supplies host identity; this harness does not attest the host model or isolate its tools.",
            "Unknown token usage, cost and effective host settings remain unknown.",
            "Prepared-to-collected elapsed time includes orchestration and is not model latency.",
        ],
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    command = commands.add_parser("prepare")
    command.add_argument("--spec", required=True)
    command.add_argument("--output", required=True, type=Path)
    command.add_argument("--variant", choices=["agent", "generic-control"], default="agent")
    command.add_argument("--campaign-id")
    command.add_argument("--repetition", type=int, default=1)
    command = commands.add_parser("collect")
    command.add_argument("--attempt", required=True, type=Path)
    command.add_argument("--expected-preparation", required=True)
    command.add_argument("--transcript", required=True, type=Path)
    command.add_argument("--host-id", required=True)
    command.add_argument("--outcome", choices=["completed", "failed", "interrupted"], default="completed")
    command.add_argument("--concrete-model")
    command.add_argument("--model-alias", choices=run.SUPPORTED_MODELS)
    command = commands.add_parser("compare")
    command.add_argument("results", nargs="+", type=Path)
    command.add_argument("--minimum-repetitions", type=int, default=1)
    args = parser.parse_args(argv)
    try:
        if args.action == "prepare":
            result = prepare(args.spec, args.output, args.variant,
                             campaign_id=args.campaign_id, repetition=args.repetition)
        elif args.action == "collect":
            result = collect(args.attempt, args.expected_preparation, args.transcript,
                             host_id=args.host_id, outcome=args.outcome, concrete_model=args.concrete_model,
                             model_alias=args.model_alias)
        else:
            result = compare(args.results, minimum_repetitions=args.minimum_repetitions)
        # JSON on a Windows pipe may use a legacy console codec. Keep stdout
        # portable while on-disk evidence preserves the original UTF-8 bytes.
        print(json.dumps(result, sort_keys=True, ensure_ascii=True, indent=2))
        return 1 if args.action == "collect" and result["report"]["status"] != "pass" else 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
