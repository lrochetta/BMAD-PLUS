"""Native-host controller contract tests; fixtures below are not model runs."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

import host
import run


@pytest.fixture
def case(tmp_path, monkeypatch):
    local_root = tmp_path.resolve() / "cases"
    destination = local_root / "forge" / "cache-values"
    shutil.copytree(run.EVALS_ROOT / "forge" / "cache-values", destination)
    monkeypatch.setattr(run, "EVALS_ROOT", local_root)
    return tmp_path.resolve(), destination


def prepare(case, variant="agent"):
    root, _ = case
    result = host.prepare("forge/cache-values", root / variant, variant)
    transcript = root / (variant + "-transcript.txt")
    transcript.write_text("Controller test fixture, not a model execution.", encoding="utf-8")
    return result, transcript


def collect(prepared, transcript, **kwargs):
    return host.collect(Path(prepared["attempt"]), prepared["preparation_sha256"], transcript,
                        host_id="unit-fixture-not-a-model", **kwargs)


def materialize_correct_fixture(prepared):
    workspace = Path(prepared["workspace"])
    code = workspace / "src/cache.cjs"
    code.write_text(code.read_text(encoding="utf-8").replace("if (values.get(key))", "if (values.has(key))"), encoding="utf-8")
    (workspace / "tests/empty.test.cjs").write_text(
        "const test=require('node:test');const assert=require('node:assert/strict');"
        "const {createLookup}=require('../src/cache.cjs');"
        "test('empty result is cached',()=>{let calls=0;"
        "const read=createLookup(()=>{calls++;return '';});read('a');read('a');assert.equal(calls,1);});\n",
        encoding="utf-8",
    )
    (workspace / "result.md").write_text("Fixture implements the contract; grading executes the real caller.\n", encoding="utf-8")


def test_actual_agent_packet_excludes_the_held_out_checker(case):
    prepared, _ = prepare(case)
    attempt = Path(prepared["attempt"])
    packet = (attempt / "task.md").read_text(encoding="utf-8")
    assert "# Forge" in packet
    assert "Allowed task writes: src/cache.cjs, tests/, result.md" in packet
    assert "assert.equal(reads, 1, 'successful values" not in packet
    assert run.context_from_dict(json.loads((attempt / "context.json").read_bytes())).resources


def test_control_omits_agent_but_keeps_identical_task_fixture(case):
    prepared, _ = prepare(case, "generic-control")
    context = run.context_from_dict(json.loads((Path(prepared["attempt"]) / "context.json").read_bytes()))
    assert not context.resources
    assert "# Forge" not in context.system
    assert "The label picker repeatedly fetches" in context.prompt


@pytest.mark.parametrize("changed", ["checks/check.cjs", "task.md", "context.json", "preparation.json"])
def test_changed_control_input_is_rejected_before_any_grading(case, changed):
    prepared, transcript = prepare(case)
    target = Path(prepared["attempt"]) / changed
    target.write_bytes(target.read_bytes() + b"\n")
    with pytest.raises(ValueError, match="changed"):
        collect(prepared, transcript)
    assert not (Path(prepared["attempt"]) / "result.json").exists()


def test_spec_drift_is_not_scored_against_different_acceptance(case):
    prepared, transcript = prepare(case)
    _, spec_dir = case
    spec = spec_dir / "eval.yaml"
    spec.write_bytes(spec.read_bytes() + b"\n# changed after preparation\n")
    with pytest.raises(ValueError, match="spec changed"):
        collect(prepared, transcript)


def test_completion_claim_cannot_pass_missing_outputs_or_broken_behavior(case):
    prepared, transcript = prepare(case)
    transcript.write_text("forge/cache-values is completed. All tests passed.", encoding="utf-8")
    result = collect(prepared, transcript)
    assert result["report"]["status"] == "fail"
    assert result["report"]["evidence"]["acceptance"]["critical_checks_pass"] is False
    assert result["host"]["usage"] is None


def test_real_checks_pass_correct_fixture_and_refuse_repeat_collection(case):
    prepared, transcript = prepare(case)
    materialize_correct_fixture(prepared)
    result = collect(prepared, transcript)
    assert result["report"]["status"] == "pass", result["report"]["errors"]
    with pytest.raises(ValueError, match="already has a result"):
        collect(prepared, transcript)


def test_cli_collects_unicode_agent_context_with_legacy_windows_stdout(case):
    prepared, transcript = prepare(case)
    materialize_correct_fixture(prepared)
    completed = subprocess.run(
        [sys.executable, str(Path(host.__file__)), "collect", "--attempt", prepared["attempt"],
         "--expected-preparation", prepared["preparation_sha256"], "--transcript", str(transcript),
         "--host-id", "controller-test-fixture"],
        capture_output=True, timeout=20, env={**os.environ, "PYTHONIOENCODING": "cp1252"},
    )
    assert completed.returncode == 0, completed.stderr
    receipt = json.loads(completed.stdout.decode("ascii"))
    assert receipt["report"]["status"] == "pass"
    assert json.loads((Path(prepared["attempt"]) / "result.json").read_bytes()) == receipt


def test_interrupted_execution_cannot_pass_even_with_correct_artifacts(case):
    prepared, transcript = prepare(case)
    materialize_correct_fixture(prepared)
    result = collect(prepared, transcript, outcome="interrupted")
    assert result["report"]["status"] == "fail"
    assert result["report"]["evidence"]["acceptance"]["execution_ok"] is False


def test_out_of_scope_edit_fails_despite_passing_behavior(case):
    prepared, transcript = prepare(case)
    materialize_correct_fixture(prepared)
    (Path(prepared["workspace"]) / "docs/contract.md").write_text("Replaced contract", encoding="utf-8")
    result = collect(prepared, transcript)
    assert result["report"]["status"] == "fail"
    assert any(item["id"] == "write-scope" and not item["passed"] for item in result["report"]["assertion_results"])


def test_comparison_requires_equal_inputs_and_explicit_pairs(case):
    agent, agent_transcript = prepare(case)
    control, control_transcript = prepare(case, "generic-control")
    for prepared, transcript in [(agent, agent_transcript), (control, control_transcript)]:
        materialize_correct_fixture(prepared)
        collect(prepared, transcript)
    paths = [Path(value["attempt"]) / "result.json" for value in (agent, control)]
    result = host.compare(paths)
    assert result["acceptance"]["agent"] == {"passed": 1, "total": 1}
    assert result["critical_regressions"] == []
    with pytest.raises(ValueError, match="both variants"):
        host.compare(paths[:1])
    changed = json.loads(paths[1].read_bytes())
    changed["fixture"][0]["sha256"] = "0" * 64
    paths[1].write_bytes(host.encoded(changed))
    with pytest.raises(ValueError, match="inputs differ"):
        host.compare(paths)


def test_concurrent_collectors_execute_the_verifier_once(case):
    root, spec_dir = case
    marker = root / "checker-invocations.txt"
    checker = spec_dir / "checks/check.cjs"
    original = checker.read_text(encoding="utf-8")
    checker.write_text(
        "require('node:fs').appendFileSync(" + json.dumps(str(marker)) + ",String(process.pid)+'\\n');\n"
        "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,400);\n" + original,
        encoding="utf-8",
    )
    prepared, transcript = prepare(case)
    materialize_correct_fixture(prepared)
    args = [sys.executable, str(Path(host.__file__)), "collect", "--attempt", prepared["attempt"],
            "--expected-preparation", prepared["preparation_sha256"], "--transcript", str(transcript),
            "--host-id", "concurrent-controller-fixture"]
    children = [subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE) for _ in range(2)]
    results = []
    try:
        for child in children:
            stdout, stderr = child.communicate(timeout=20)
            results.append((child.returncode, stdout, stderr))
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
                child.communicate(timeout=5)
    assert sorted(code for code, _, _ in results) == [0, 2]
    loser = next(stderr for code, _, stderr in results if code == 2)
    assert b"Collection is active or interrupted" in loser or b"already has a result" in loser
    assert not (Path(prepared["attempt"]) / "collection.json").exists()
    assert json.loads((Path(prepared["attempt"]) / "result.json").read_bytes())["report"]["status"] == "pass"
    assert len(marker.read_text(encoding="utf-8").splitlines()) == 1


def test_interrupted_collection_never_reexecutes_checks_implicitly(case, monkeypatch):
    prepared, transcript = prepare(case)
    def interrupted(*args, **kwargs):
        raise RuntimeError("simulated controller interruption")
    monkeypatch.setattr(run, "score_external_run", interrupted)
    with pytest.raises(RuntimeError, match="controller interruption"):
        collect(prepared, transcript)
    assert (Path(prepared["attempt"]) / "collection.json").is_file()
    with pytest.raises(ValueError, match="Collection is active or interrupted"):
        collect(prepared, transcript)
    assert not (Path(prepared["attempt"]) / "result.json").exists()
