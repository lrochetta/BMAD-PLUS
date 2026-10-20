"""Controller fixtures for repetitions; no model behavior is measured."""
from __future__ import annotations

import copy
import json
import shutil
from pathlib import Path

import pytest

import campaign
import host
import run


@pytest.fixture
def case(tmp_path, monkeypatch):
    root = tmp_path.resolve() / "evals"
    source = root / "osint/missing-scope"
    shutil.copytree(run.EVALS_ROOT / "osint/missing-scope", source)
    monkeypatch.setattr(run, "EVALS_ROOT", root)
    plan = {
        "schema_version": 1, "id": "controller-fixture", "execution_mode": "native-host",
        "specs": ["osint/missing-scope"], "variants": ["generic-control", "agent"], "repetitions": 2,
        "host_model": {"alias": "gpt", "concrete_model": None, "selection": "Controller fixture, not a model"},
        "budget": {"maximum_attempts": 4, "per_attempt_timeout_s": 300, "separate_paid_api_calls": False},
    }
    plan_path = tmp_path / "plan.json"
    plan_path.write_bytes(host.encoded(plan))
    return tmp_path, source, plan_path


def finish(prepared, source, *, outcome="completed"):
    directory = Path(prepared["attempt"])
    replay = json.loads((source / "replay.json").read_bytes())
    for artifact in replay["files"]:
        run._write_file(directory / "workspace", artifact["path"], artifact["content"])
    transcript = directory / "transcript.txt"
    transcript.write_text("Controller-written fixture; not an agent or model run.", encoding="utf-8")
    return host.collect(directory, prepared["preparation_sha256"], transcript,
                        host_id="controller-" + prepared["attempt_id"], outcome=outcome, model_alias="gpt")


def test_campaign_prepares_counterbalanced_pairs_with_immutable_repetition(case):
    root, _, plan = case
    prepared = campaign.prepare(plan, root / "campaign")
    attempts = prepared["attempts"]
    assert [attempt["variant"] for attempt in attempts] == ["generic-control", "agent", "agent", "generic-control"]
    assert [attempt["experiment"]["repetition"] for attempt in attempts] == [1, 1, 2, 2]
    assert len({attempt["attempt_id"] for attempt in attempts}) == 4
    assert prepared["executed"] is False
    for attempt in attempts:
        manifest = Path(attempt["attempt"]) / "preparation.json"
        assert host.digest(manifest.read_bytes()) == attempt["preparation_sha256"]
        packet = Path(attempt["task_file"]).read_text(encoding="utf-8")
        assert "const assert = require" not in packet
        assert '"bindings"' not in packet


def test_missing_receipt_stays_incomplete_and_is_not_dropped(case):
    root, source, plan = case
    prepared = campaign.prepare(plan, root / "campaign")
    for attempt in prepared["attempts"][:-1]:
        finish(attempt, source)
    result = campaign.compare(Path(prepared["campaign"]), prepared["campaign_sha256"])
    assert result["status"] == "incomplete"
    assert result["collected"] == 3
    assert result["planned"] == 4
    assert result["acceptance"] is None
    finish(prepared["attempts"][-1], source, outcome="interrupted")
    result = campaign.compare(Path(prepared["campaign"]), prepared["campaign_sha256"])
    assert result["status"] == "complete"
    assert result["observations"] == 4
    assert result["acceptance"]["generic-control"] == {"passed": 1, "total": 2}
    assert result["acceptance"]["agent"] == {"passed": 2, "total": 2}


def test_repeated_comparison_refuses_duplicate_or_insufficient_evidence(case):
    root, source, plan = case
    prepared = campaign.prepare(plan, root / "campaign")
    for attempt in prepared["attempts"]:
        finish(attempt, source)
    paths = [Path(attempt["attempt"]) / "result.json" for attempt in prepared["attempts"]]
    result = host.compare(paths, minimum_repetitions=2)
    assert result["tasks"] == 1
    assert result["paired_trials"] == 2
    with pytest.raises(ValueError, match="Duplicate attempt"):
        host.compare(paths + paths[:1], minimum_repetitions=2)
    with pytest.raises(ValueError, match="required consecutive repetitions"):
        host.compare(paths[:2], minimum_repetitions=2)
    with pytest.raises(ValueError, match="both variants"):
        host.compare(paths[:3], minimum_repetitions=2)


@pytest.mark.parametrize("changed", ["checks", "model", "mode", "resources", "campaign", "variant", "acceptance"])
def test_incompatible_repetitions_are_not_combined(case, changed):
    root, source, plan = case
    prepared = campaign.prepare(plan, root / "campaign")
    for attempt in prepared["attempts"]:
        finish(attempt, source)
    paths = [Path(attempt["attempt"]) / "result.json" for attempt in prepared["attempts"]]
    value = json.loads(paths[2].read_bytes())
    if changed == "checks":
        value["checks"][0]["sha256"] = "0" * 64
    elif changed == "model":
        value["host"]["concrete_model"] = "different-observed-model"
    elif changed == "mode":
        value["report"]["evidence"]["execution"]["mode"] = "mock"
    elif changed == "resources":
        value["report"]["evidence"]["context"]["resources"][0]["sha256"] = "0" * 64
    elif changed == "campaign":
        value["experiment"]["campaign_id"] = "different-campaign"
    elif changed == "variant":
        value["report"]["evidence"]["context"]["context_variant"] = "generic-control"
    else:
        value["report"]["evidence"]["acceptance"]["accepted"] = False
    paths[2].write_bytes(host.encoded(value))
    with pytest.raises(ValueError):
        host.compare(paths, minimum_repetitions=2)


def test_campaign_rejects_moved_or_changed_attempt_identity(case):
    root, source, plan = case
    prepared = campaign.prepare(plan, root / "campaign")
    for attempt in prepared["attempts"]:
        finish(attempt, source)
    path = Path(prepared["attempts"][0]["attempt"]) / "result.json"
    value = json.loads(path.read_bytes())
    value["preparation_sha256"] = "0" * 64
    path.write_bytes(host.encoded(value))
    with pytest.raises(ValueError, match="planned attempt"):
        campaign.compare(Path(prepared["campaign"]), prepared["campaign_sha256"])
    with pytest.raises(ValueError, match="Campaign changed"):
        campaign.compare(Path(prepared["campaign"]), "0" * 64)


@pytest.mark.parametrize("mutation", ["paid", "repeat", "duplicate", "attempt-budget", "variants", "deadline"])
def test_campaign_rejects_ambiguous_or_unbounded_plan(case, mutation):
    _, _, path = case
    plan = copy.deepcopy(json.loads(path.read_bytes()))
    if mutation == "paid":
        plan["budget"]["separate_paid_api_calls"] = True
    elif mutation == "repeat":
        plan["repetitions"] = 1
    elif mutation == "duplicate":
        plan["specs"] *= 2
    elif mutation == "attempt-budget":
        plan["budget"]["maximum_attempts"] = 100
    elif mutation == "variants":
        plan["variants"] = ["agent"]
    else:
        plan["budget"]["per_attempt_timeout_s"] = 0
    path.write_bytes(host.encoded(plan))
    with pytest.raises(ValueError):
        campaign.load_plan(path)
