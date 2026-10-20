#!/usr/bin/env python3
"""Run an offline, scored replay gate. No model is called or measured here."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import policy
import run
from context_evidence import EvidenceError, manifest, object_hash, read_record, resolve_inside, sha256, snapshot


def bindings(spec_path: Path, spec: dict) -> dict:
    return {
        "spec_sha256": sha256(spec_path.read_bytes()),
        "fixture": manifest(snapshot(resolve_inside(spec_path.parent, spec["fixture"], kind="directory"))),
        "checks": manifest(snapshot(resolve_inside(spec_path.parent, "checks", kind="directory"))),
        "agent_resources": manifest(run._load_agent_resources(spec, run.REPO_ROOT)),
    }


def replay_at(spec_path: Path, spec: dict, *, verify=True) -> tuple[dict, dict]:
    source = read_record(spec_path.parent, spec.get("replay", ""), limit=run.MAX_TOTAL_BYTES)
    value = json.loads(source.content)
    if (not isinstance(value, dict) or value.get("schema_version") != 1
            or value.get("kind") != "maintainer-authored-replay"):
        raise EvidenceError("Replay must declare schema_version 1 and maintainer-authored-replay")
    if not isinstance(value.get("transcript"), str) or not value["transcript"].strip():
        raise EvidenceError("Replay transcript must be nonempty text")
    files = value.get("files")
    if not isinstance(files, list) or not files or len(files) > run.MAX_FILES:
        raise EvidenceError("Replay needs a bounded nonempty list of artifact files")
    seen = set()
    for record in files:
        if (not isinstance(record, dict) or set(record) != {"path", "content", "sha256"}
                or not run.safe_relative(record["path"]) or record["path"] in seen
                or not isinstance(record["content"], str) or "\x00" in record["content"]
                or len(record["content"].encode("utf-8")) > run.MAX_FILE_BYTES
                or record["sha256"] != sha256(record["content"])):
            raise EvidenceError("Replay artifacts need unique safe paths and exact UTF-8 hashes")
        if not run._can_write(record["path"], run._write_scope(spec["task"])):
            raise EvidenceError(f"Replay artifact outside allowed writes: {record['path']}")
        seen.add(record["path"])
    if spec["scoring"]["weights"]["rubric"] != 0:
        raise EvidenceError("Replay gate cannot invent model-judged rubric scores")
    if not any(a["kind"] == "command_succeeds" and a.get("critical", True)
               and isinstance(a["command"], list) and any("{checks}/" in part for part in a["command"])
               for a in spec["assertions"]):
        raise EvidenceError("Replay needs an independent critical held-out command check")
    current = bindings(spec_path, spec)
    if verify and value.get("bindings") != current:
        raise EvidenceError("Replay bindings are stale: inspect agent, spec, fixture and checker changes before explicitly resealing")
    if verify and (not isinstance(value.get("review_note"), str) or not value["review_note"].strip()):
        raise EvidenceError("Replay seal needs a maintainer review note")
    return value, source.evidence()


def seal(spec_path: Path, reason: str) -> dict:
    """Explicit maintainer operation; the gate never updates stale bindings."""
    if not reason.strip():
        raise EvidenceError("An explicit review reason is required")
    spec = run.yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    errors = run.validate_spec(spec, spec_path)
    if errors:
        raise EvidenceError("; ".join(errors))
    replay, _ = replay_at(spec_path, spec, verify=False)
    replay.update({"bindings": bindings(spec_path, spec), "review_note": reason,
                   "sealed_at": datetime.now(timezone.utc).isoformat()})
    target = resolve_inside(spec_path.parent, spec["replay"])
    # newline="" keeps LF on every platform. A seal written with CRLF differs from the
    # same seal written on Linux, and these trees are pinned to LF for that reason.
    with target.open("w", encoding="utf-8", newline="") as handle:
        handle.write(json.dumps(replay, ensure_ascii=False, indent=2) + "\n")
    return {"spec_id": spec["id"], "replay_sha256": sha256(target.read_bytes()), "bindings": replay["bindings"]}


def replay_run(spec_path: Path, spec: dict, *, control: str | None = None) -> run.SpecReport:
    replay, source = replay_at(spec_path, spec)
    workspace = run.materialize_fixture(spec_path, spec)
    try:
        context = run.prepare_agent_context(spec, workspace, execution_mode="mock")
        if control != "completion-only":
            for artifact in replay["files"]:
                run._write_file(workspace, artifact["path"], artifact["content"])
        transcript = (f"Completed {spec['id']}. All requirements and checks pass."
                      if control == "completion-only" else replay["transcript"])
        attempt_id = uuid.uuid4().hex
        result = run.AgentResult(transcript, exit_ok=control != "interrupted", meta={
            "execution_mode": "mock", "provider": "replay", "attempt_id": attempt_id,
            "replay": {"kind": replay["kind"], "source": source, "bindings": replay["bindings"],
                       "control": control, "review_note": replay["review_note"]},
            "effective_settings": {"network": False, "model_calls": 0},
        })
        report = run.score_external_run(spec_path, spec, workspace, result, context=context,
                                       attempt_id=attempt_id, checks_root=spec_path.parent / "checks")
        report.evidence.update({"evidence_class": "deterministic-replay", "behavior_measured": False,
                                "model_called": False})
        return report
    finally:
        # materialize_fixture created this private temporary directory. No user
        # path is computed for deletion and no worker is running in this mode.
        shutil.rmtree(workspace)


def gate(name="pr", *, registry_path: Path | None = None, root: Path | None = None) -> dict:
    registry = policy.load_registry(registry_path)
    contract = policy.gate_policy(registry, name)
    if contract["mode"] != "replay":
        raise EvidenceError("This command executes replay gates only; native-host campaigns need actual host receipts")
    errors, cases = [], []
    coverage = {pack: {"structural": 0, "scored": 0, "accepted": 0} for pack in registry["packs"]}
    sources = policy.discover(root or run.EVALS_ROOT, registry)
    seen = set()
    for source in sources:
        try:
            spec = run.yaml.safe_load(source.read_text(encoding="utf-8"))
            issues = run.validate_spec(spec, source)
            if issues:
                raise EvidenceError("; ".join(issues))
            if spec["id"] in seen:
                raise EvidenceError(f"Duplicate spec ID: {spec['id']}")
            seen.add(spec["id"])
            coverage[spec["pack"]]["structural"] += 1
            if name not in spec.get("gates", []):
                continue
            report = replay_run(source, spec)
            controls = []
            for control in contract.get("controls", []):
                negative = replay_run(source, spec, control=control)
                rejected = negative.status == "fail"
                controls.append({"id": control, "rejected": rejected, "observed_status": negative.status,
                                 "observed_score": negative.score, "errors": negative.errors,
                                 "assertions": negative.assertion_results,
                                 "execution": negative.evidence.get("execution")})
            accepted = report.status == "pass" and all(control["rejected"] for control in controls)
            coverage[spec["pack"]]["scored"] += 1
            coverage[spec["pack"]]["accepted"] += int(accepted)
            cases.append({"id": spec["id"], "pack": spec["pack"], "threshold": spec["scoring"]["pass_threshold"],
                          "gate_passed": accepted, "report": asdict(report), "controls": controls})
        except (OSError, ValueError, KeyError, TypeError, run.yaml.YAMLError) as exc:
            errors.append({"path": str(source), "error": str(exc)})
    if not sources or not cases:
        errors.append({"error": "Gate discovered no scored cases"})
    missing = [pack for pack, counts in coverage.items() if not counts["scored"]]
    if missing and contract.get("require_all_packs", False):
        errors.append({"error": "Missing scored pack coverage", "packs": missing})
    passed = not errors and all(case["gate_passed"] for case in cases)
    return {
        "schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(),
        "gate": name, "policy": contract, "policy_sha256": object_hash(registry["eval"]),
        "execution_mode": "deterministic-replay", "behavior_measured": False,
        "model_calls": 0, "usage": None, "cost": None,
        "status": "pass" if passed else "fail", "blocking_failure": contract["blocking"] and not passed,
        "acceptance": {"passed": sum(case["gate_passed"] for case in cases), "total": len(cases)},
        "negative_controls": {"rejected": sum(c["rejected"] for case in cases for c in case["controls"]),
                              "total": sum(len(case["controls"]) for case in cases)},
        "coverage": coverage, "errors": errors, "cases": cases,
        "limits": ["Maintainer-authored artifact replay tests the grader and its failure controls, not model adherence.",
                   "A changed selected agent invalidates the seal; resealing is an explicit review, not a new agent run.",
                   "Pack coverage means one bounded task per pack, not exhaustive capability or compliance coverage."],
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gate", default="pr")
    parser.add_argument("--json", type=Path)
    parser.add_argument("--junit", type=Path)
    parser.add_argument("--seal", metavar="AGENT/TASK")
    parser.add_argument("--reason", default="")
    args = parser.parse_args(argv)
    try:
        if args.seal:
            if not run.safe_relative(args.seal) or len(args.seal.split("/")) != 2:
                raise EvidenceError("--seal needs an exact agent/task ID")
            result = seal(resolve_inside(run.EVALS_ROOT, f"{args.seal}/eval.yaml"), args.reason)
        else:
            result = gate(args.gate)
        if args.json:
            args.json.parent.mkdir(parents=True, exist_ok=True)
            args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if args.junit and not args.seal:
            reports = [run.SpecReport(case["id"], case["report"]["path"], "pass" if case["gate_passed"] else "fail",
                                      case["report"]["errors"], case["report"]["score"])
                       for case in result["cases"]]
            reports += [run.SpecReport("gate-input", error.get("path", "registry"), "error", [str(error)])
                        for error in result["errors"]]
            args.junit.parent.mkdir(parents=True, exist_ok=True)
            args.junit.write_text(run.to_junit_xml(reports, "deterministic-replay"), encoding="utf-8")
        print(json.dumps({k: v for k, v in result.items() if k != "cases"}, ensure_ascii=True, indent=2))
        return 1 if result.get("blocking_failure") else 0
    except (OSError, ValueError, KeyError, TypeError, run.yaml.YAMLError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
