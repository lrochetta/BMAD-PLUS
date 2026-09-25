#!/usr/bin/env python3
"""Prepare a declared native-host matrix and compare every planned receipt.

No agents are launched here. The orchestrating host owns scheduling, actual
deadlines, cancellation and access to tools. Missing receipts remain incomplete.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import host
import policy
import run


def load_plan(source: Path) -> dict:
    source = host.checked_path(source)
    if source.stat().st_size > 64 * 1024:
        raise ValueError("Campaign plan exceeds 64 KiB")
    value = json.loads(source.read_bytes())
    if value.get("schema_version") != 1 or value.get("execution_mode") != "native-host":
        raise ValueError("Campaign plan needs schema_version 1 and native-host mode")
    identifier = value.get("id")
    if not run.safe_relative(identifier) or "/" in identifier:
        raise ValueError("Campaign needs a safe ID")
    if value.get("variants") != ["generic-control", "agent"]:
        raise ValueError("Campaign needs explicit paired generic-control and agent variants")
    repeats = value.get("repetitions")
    contract = policy.gate_policy(policy.load_registry(), "model_upgrade")
    if type(repeats) is not int or not contract.get("minimum_repetitions", 1) <= repeats <= 20:
        raise ValueError("Repetitions do not meet the declared registry policy")
    specs = value.get("specs")
    if (not isinstance(specs, list) or not specs or any(not isinstance(item, str) for item in specs)
            or len(specs) != len(set(specs)) or len(specs) * repeats * 2 > 400):
        raise ValueError("Campaign needs unique spec IDs within 400 observations")
    budget = value.get("budget", {})
    if budget.get("separate_paid_api_calls") is not False:
        raise ValueError("This native-host campaign does not authorize separate paid API calls")
    if budget.get("maximum_attempts") != len(specs) * repeats * 2:
        raise ValueError("Attempt budget must equal the predeclared matrix size")
    if type(budget.get("per_attempt_timeout_s")) is not int or not 1 <= budget["per_attempt_timeout_s"] <= 900:
        raise ValueError("Campaign needs a bounded per-attempt deadline")
    model = value.get("host_model", {})
    if model.get("alias") not in run.SUPPORTED_MODELS or not isinstance(model.get("selection"), str):
        raise ValueError("Predeclare the host model alias and selection method")
    for spec_id in specs:
        host.spec_at(spec_id)
    return value


def prepare(plan_path: Path, output: Path) -> dict:
    plan = load_plan(plan_path)
    output = host.checked_path(output)
    output.mkdir(parents=True, exist_ok=False)
    attempts = []
    # Alternate arm order across repetitions to avoid always scheduling one
    # configuration first. This is deterministic counterbalancing, not randomization.
    for repetition in range(1, plan["repetitions"] + 1):
        variants = plan["variants"] if repetition % 2 else list(reversed(plan["variants"]))
        for spec_id in plan["specs"]:
            for variant in variants:
                directory = output / (spec_id.replace("/", "--") + f"--r{repetition}--{variant}")
                prepared = host.prepare(spec_id, directory, variant, campaign_id=plan["id"], repetition=repetition)
                attempts.append({"spec_id": spec_id, **prepared})
    manifest = {"schema_version": 1, "prepared_at": host.now(), "plan": plan,
                "plan_sha256": host.digest(host.checked_path(plan_path).read_bytes()),
                "executed": False, "attempts": attempts,
                "budget_enforcement": "The orchestrating host must enforce attempt deadlines and launch limits; preparation is not execution."}
    target = output / "campaign.json"
    target.write_bytes(host.encoded(manifest))
    return {"campaign": str(target), "campaign_sha256": host.digest(target.read_bytes()),
            "observations_prepared": len(attempts), "executed": False, "attempts": attempts}


def compare(campaign: Path, expected: str) -> dict:
    campaign = host.checked_path(campaign)
    raw = campaign.read_bytes()
    if host.digest(raw) != expected:
        raise ValueError("Campaign changed after the caller recorded its digest")
    manifest = json.loads(raw)
    paths, pending = [], []
    for attempt in manifest["attempts"]:
        directory = host.checked_path(Path(attempt["attempt"]))
        result_path = directory / "result.json"
        if not result_path.is_file():
            pending.append({"attempt_id": attempt["attempt_id"], "spec_id": attempt["spec_id"],
                            "variant": attempt["variant"], "repetition": attempt["experiment"]["repetition"]})
            continue
        result = json.loads(result_path.read_bytes())
        if (result["attempt_id"] != attempt["attempt_id"]
                or result["preparation_sha256"] != attempt["preparation_sha256"]
                or result["spec_id"] != attempt["spec_id"] or result["variant"] != attempt["variant"]
                or result.get("experiment") != attempt["experiment"]):
            raise ValueError("Result does not belong to the planned attempt")
        if result["host"].get("concrete_model") != manifest["plan"]["host_model"].get("concrete_model"):
            raise ValueError("Observed model identity differs from the predeclared campaign")
        paths.append(result_path)
    if pending:
        return {"status": "incomplete", "execution_mode": "native-host", "pending": pending,
                "collected": len(paths), "planned": len(manifest["attempts"]),
                "acceptance": None, "limit": "Missing observations cannot be dropped from the comparison."}
    comparison = host.compare(paths, minimum_repetitions=manifest["plan"]["repetitions"])
    comparison.update({"status": "complete", "campaign_sha256": expected,
                       "plan_sha256": manifest["plan_sha256"], "plan": manifest["plan"],
                       "receipt_hashes": [{"path": str(path), "sha256": host.digest(path.read_bytes())} for path in paths]})
    return comparison


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    command = commands.add_parser("prepare")
    command.add_argument("--plan", required=True, type=Path)
    command.add_argument("--output", required=True, type=Path)
    command = commands.add_parser("compare")
    command.add_argument("--campaign", required=True, type=Path)
    command.add_argument("--expected", required=True)
    command.add_argument("--json", type=Path)
    args = parser.parse_args(argv)
    try:
        result = prepare(args.plan, args.output) if args.action == "prepare" else compare(args.campaign, args.expected)
        if getattr(args, "json", None):
            args.json.parent.mkdir(parents=True, exist_ok=True)
            args.json.write_bytes(host.encoded(result))
        print(json.dumps(result, ensure_ascii=True, indent=2))
        return 1 if result.get("status") == "incomplete" else 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
