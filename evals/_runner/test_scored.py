"""Offline replay/policy controls. These tests never execute a model."""
from __future__ import annotations

import copy
import json
import shutil

import pytest

import policy
import providers
import run
import scored


@pytest.fixture
def case(tmp_path, monkeypatch):
    root = tmp_path.resolve() / "evals"
    source = root / "forge/customized-slug/eval.yaml"
    shutil.copytree(run.EVALS_ROOT / "forge/customized-slug", source.parent)
    monkeypatch.setattr(run, "EVALS_ROOT", root)
    spec = run.yaml.safe_load(source.read_text(encoding="utf-8"))
    scored.seal(source, "Controller fixture copied without changing authored artifacts.")
    registry = copy.deepcopy(policy.load_registry())
    registry["eval"]["gates"]["pr"]["require_all_packs"] = False
    return source, spec, registry


def test_positive_replay_runs_real_customized_caller_without_a_provider(case, monkeypatch):
    source, spec, _ = case
    def forbidden(*args, **kwargs):
        raise AssertionError("No model provider may be constructed by replay")
    monkeypatch.setattr(providers, "get_provider", forbidden)
    report = scored.replay_run(source, spec)
    assert report.status == "pass", report.errors
    assert report.score == 1
    assert report.evidence["behavior_measured"] is False
    assert report.evidence["model_called"] is False
    assert report.evidence["execution"]["provider"] == "replay"
    assert report.assertion_results[0]["evidence"]["exit_code"] == 0


def test_rendered_response_uses_the_same_sibling_checks_without_calling_a_live_provider(case):
    source, spec, _ = case
    replay, _ = scored.replay_at(source, spec)
    response = "\n".join("--- BEGIN FILE: " + item["path"] + " ---\n" + item["content"] + "--- END FILE ---\n"
                         for item in replay["files"])
    report = run.run_eval(source, spec, "gpt", provider=providers.MockProvider(script=lambda *_args, **_kwargs: response))
    assert report.status == "pass", report.errors
    assert report.evidence["prepared_checks"]["files"][0]["path"] == "check.cjs"
    assert report.evidence["execution"]["mode"] == "mock"


def test_rendered_provider_cannot_replace_the_prepared_held_out_check(case):
    source, spec, _ = case
    def mutate(*_args, **_kwargs):
        (source.parent / "checks/check.cjs").write_text("process.exit(0);\n", encoding="utf-8")
        return "The task is complete."
    report = run.run_eval(source, spec, "gpt", provider=providers.MockProvider(script=mutate))
    assert report.status == "error"
    assert any("held-out checks changed" in error for error in report.errors)


@pytest.mark.parametrize("control", ["completion-only", "interrupted"])
def test_claimed_completion_and_interrupted_correct_artifacts_cannot_pass(case, control):
    source, spec, _ = case
    report = scored.replay_run(source, spec, control=control)
    assert report.status == "fail"
    assert report.evidence["acceptance"]["accepted"] is False
    if control == "completion-only":
        assert not report.evidence["acceptance"]["critical_checks_pass"]
    else:
        assert report.evidence["acceptance"]["critical_checks_pass"]
        assert not report.evidence["acceptance"]["execution_ok"]


def test_bad_artifact_replay_stays_red_even_after_explicit_reseal(case):
    source, spec, _ = case
    target = source.parent / "replay.json"
    value = json.loads(target.read_bytes())
    artifact = next(item for item in value["files"] if item["path"] == "src/slug.cjs")
    artifact["content"] = "exports.slug = () => 'wrong';\n"
    artifact["sha256"] = run.sha256(artifact["content"])
    target.write_text(json.dumps(value), encoding="utf-8")
    scored.seal(source, "Deliberately wrong mutation, testing failed behavioral acceptance.")
    report = scored.replay_run(source, spec)
    assert report.status == "fail"
    assert report.score == 0


@pytest.mark.parametrize("key", ["NODE_OPTIONS", "node_options"])
def test_inherited_node_preload_cannot_turn_a_failed_check_green(case, monkeypatch, tmp_path, key):
    source, spec, _ = case
    preload = tmp_path / "exit-success.cjs"
    preload.write_text("process.exit(0);\n", encoding="utf-8")
    monkeypatch.setenv(key, '--require "' + str(preload) + '"')
    report = scored.replay_run(source, spec, control="completion-only")
    assert report.status == "fail"
    environment = report.assertion_results[0]["evidence"]["environment"]
    assert "NODE_OPTIONS" not in environment["values"]
    assert "node_options" not in environment["values"]


def test_provider_credentials_are_not_inherited_by_acceptance_code(case, monkeypatch):
    source, spec, _ = case
    monkeypatch.setenv("BMAD_FAKE_PROVIDER_SECRET", "controller-only-not-a-real-secret")
    checker = source.parent / "checks/check.cjs"
    checker.write_text("if (process.env.BMAD_FAKE_PROVIDER_SECRET) process.exit(9);\n", encoding="utf-8")
    scored.seal(source, "Controller environment regression, no provider credential may reach artifact code.")
    report = scored.replay_run(source, spec)
    assert report.status == "pass"
    assert "BMAD_FAKE_PROVIDER_SECRET" not in report.assertion_results[0]["evidence"]["environment"]["values"]


@pytest.mark.parametrize("changed", ["fixture/src/caller.cjs", "checks/check.cjs", "eval.yaml"])
def test_changed_inputs_do_not_reuse_an_old_green_seal(case, changed):
    source, spec, _ = case
    target = source.parent / changed
    target.write_bytes(target.read_bytes() + b"\n")
    with pytest.raises(ValueError, match="bindings are stale"):
        scored.replay_at(source, spec)


def test_changed_selected_agent_requires_review_before_replay(case, monkeypatch, tmp_path):
    source, spec, _ = case
    selected = tmp_path / "agent-source"
    target = selected / spec["agent_source"]
    target.parent.mkdir(parents=True)
    target.write_bytes((run.REPO_ROOT / spec["agent_source"]).read_bytes())
    monkeypatch.setattr(run, "REPO_ROOT", selected)
    scored.replay_at(source, spec)
    target.write_bytes(target.read_bytes() + b"\nNew distinctive instruction.\n")
    with pytest.raises(ValueError, match="bindings are stale"):
        scored.replay_at(source, spec)


@pytest.mark.parametrize("mutation", ["hash", "traversal", "outside-scope", "duplicate", "rubric"])
def test_invalid_replay_is_rejected_before_workspace_writes(case, mutation):
    source, spec, _ = case
    target = source.parent / "replay.json"
    value = json.loads(target.read_bytes())
    if mutation == "hash":
        value["files"][0]["sha256"] = "0" * 64
    elif mutation == "traversal":
        value["files"][0]["path"] = "../outside.cjs"
    elif mutation == "outside-scope":
        value["files"][0]["path"] = ".agents/project-rules.md"
    elif mutation == "duplicate":
        value["files"].append(value["files"][0])
    else:
        spec["scoring"]["weights"] = {"assertions": 0.7, "rubric": 0.3}
    target.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError):
        scored.replay_at(source, spec)


def test_gate_is_driven_by_registry_glob_and_requires_pack_coverage(case, monkeypatch):
    source, _, registry = case
    monkeypatch.setattr(policy, "load_registry", lambda _path=None: registry)
    report = scored.gate(root=source.parents[2])
    assert report["status"] == "pass", report["errors"]
    assert report["acceptance"] == {"passed": 1, "total": 1}
    assert report["negative_controls"] == {"rejected": 2, "total": 2}
    registry["eval"]["gates"]["pr"]["require_all_packs"] = True
    report = scored.gate(root=source.parents[2])
    assert report["blocking_failure"] is True
    assert "osint" in next(error["packs"] for error in report["errors"] if "packs" in error)
    registry["eval"]["suite_glob"] = "evals/absent/*/eval.yaml"
    report = scored.gate(root=source.parents[2])
    assert report["acceptance"]["total"] == 0
    assert report["status"] == "fail"


def test_missing_declared_replay_cannot_silently_drop_a_case(case, monkeypatch):
    source, _, registry = case
    monkeypatch.setattr(policy, "load_registry", lambda _path=None: registry)
    (source.parent / "replay.json").unlink()
    report = scored.gate(root=source.parents[2])
    assert report["blocking_failure"] is True
    assert any("missing file" in error.get("error", "") for error in report["errors"])


def test_gate_exports_machine_report_and_returns_nonzero_on_a_real_failure(case, monkeypatch, tmp_path):
    source, _, registry = case
    monkeypatch.setattr(policy, "load_registry", lambda _path=None: registry)
    (source.parent / "checks/check.cjs").write_text("process.exit(7);\n", encoding="utf-8")
    scored.seal(source, "Deliberate broken grader verifies CI failure propagation.")
    output, junit = tmp_path / "scorecard.json", tmp_path / "scorecard.xml"
    assert scored.main(["--json", str(output), "--junit", str(junit)]) == 1
    report = json.loads(output.read_bytes())
    assert report["status"] == "fail"
    assert report["cases"][0]["report"]["score"] == 0
    assert 'failures="1"' in junit.read_text(encoding="utf-8")


@pytest.mark.parametrize("setting,value", [("blocking", "true"), ("controls", []), ("minimum_repetitions", 0), ("mode", "guess")])
def test_bad_gate_policy_fails_explicitly(setting, value):
    registry = copy.deepcopy(policy.load_registry())
    registry["eval"]["gates"]["pr"][setting] = value
    with pytest.raises(ValueError):
        policy.gate_policy(registry, "pr")


def test_boolean_gate_compatibility_is_explicit():
    registry = copy.deepcopy(policy.load_registry())
    registry["eval"]["gates"]["pr"] = True
    policy_value = policy.gate_policy(registry, "pr")
    assert policy_value["mode"] == "replay"
    assert policy_value["controls"] == ["completion-only", "interrupted"]


@pytest.mark.parametrize("glob", ["../evals/*/eval.yaml", "evals/{pack}/**/*.yaml", "evals/../private/eval.yaml"])
def test_unsafe_or_obsolete_discovery_pattern_is_not_silently_reinterpreted(glob):
    registry = copy.deepcopy(policy.load_registry())
    registry["eval"]["suite_glob"] = glob
    with pytest.raises(ValueError):
        policy.discovery_pattern(registry)
