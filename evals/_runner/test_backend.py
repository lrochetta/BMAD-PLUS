#!/usr/bin/env python3
"""Backend self-check for the eval provider gateway (Pillar 4).

Runs entirely offline with the deterministic mock provider — NO network, NO
API keys, NO vendor SDKs. Exercises: provider selection, mock determinism,
config-error fail-fast for the real adapters (construction only — never a
request), file-block extraction, run_agent -> assertions -> scoring end to
end, judge parsing, and the CLI in --model mode with --provider mock.

Run:
    python evals/_runner/test_backend.py          # stdlib unittest
    python -m pytest evals/_runner/test_backend.py

Author: Laurent Rochetta
"""

from __future__ import annotations

import json
import os
import shutil
import signal
import sys
import tempfile
import time
import unittest
import uuid
from dataclasses import FrozenInstanceError
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import providers  # noqa: E402
import run as runner  # noqa: E402
import context_evidence as evidence  # noqa: E402
import command_capture  # noqa: E402


def make_spec(tmp: Path, assertions: list[dict], rubric=None, weights=None) -> tuple[Path, dict]:
    """Build a minimal on-disk fixture + in-memory spec for run_eval()."""
    fixture = tmp / "fixture"
    fixture.mkdir(parents=True, exist_ok=True)
    (fixture / "docs").mkdir(exist_ok=True)
    (fixture / "docs" / "input.md").write_text("seed inventory: zenith-corp\n", encoding="utf-8")
    spec = {
        "schema_version": 1,
        "id": "test/backend",
        "pack": "core",
        "agent": "agent-architect-dev",
        "agent_source": "README.md",
        "description": "synthetic spec for backend tests",
        "models": ["claude"],
        "fixture": "fixture",
        "task": {"prompt": "Analyze docs/input.md and produce out/report.md.", "timeout_s": 60},
        "assertions": assertions,
        "scoring": {
            "pass_threshold": 0.8,
            "weights": weights or {"assertions": 1.0, "rubric": 0.0},
        },
    }
    if rubric:
        spec["rubric"] = rubric
    return tmp / "eval.yaml", spec


SCRIPTED_TRANSCRIPT = (
    "Findings: the inventory names zenith-corp and is MISSING a DPA.\n"
    "--- BEGIN FILE: out/report.md ---\n"
    "# Report\n\nzenith-corp: missing DPA (Art. 28).\n"
    "--- END FILE ---\n"
    "Done.\n"
)


class TestProviderSelection(unittest.TestCase):
    def test_default_is_mock(self):
        p = providers.get_provider(env={})
        self.assertIsInstance(p, providers.MockProvider)
        self.assertEqual(p.name, "mock")

    def test_env_selection(self):
        p = providers.get_provider(env={"BMAD_EVAL_PROVIDER": "mock"})
        self.assertIsInstance(p, providers.MockProvider)

    def test_explicit_name_beats_env(self):
        # env says a broken provider; explicit name wins and works
        p = providers.get_provider("mock", env={"BMAD_EVAL_PROVIDER": "openai"})
        self.assertIsInstance(p, providers.MockProvider)

    def test_unknown_provider_raises(self):
        with self.assertRaises(providers.ProviderConfigError):
            providers.get_provider("skynet", env={})

    def test_registry_is_the_expected_gateway(self):
        self.assertEqual(set(providers.PROVIDERS), {"mock", "anthropic", "openai", "http"})

    def test_real_adapters_fail_fast_without_config(self):
        # Construction only — never sends a request. Empty env => loud config error.
        for name in ("anthropic", "openai", "http"):
            with self.assertRaises(providers.ProviderConfigError, msg=name):
                providers.get_provider(name, env={})


class TestMockProvider(unittest.TestCase):
    def test_deterministic_echo(self):
        p = providers.MockProvider(env={})
        a = p.generate("hello world", model="claude")
        b = p.generate("hello world", model="claude")
        self.assertEqual(a, b)
        self.assertIn("hello world", a)
        self.assertNotEqual(a, p.generate("different prompt", model="claude"))

    def test_scripted_string_and_callable(self):
        self.assertEqual(providers.MockProvider(script="canned", env={}).generate("x"), "canned")
        p = providers.MockProvider(script=lambda prompt: f"saw:{len(prompt)}", env={})
        self.assertEqual(p.generate("abc"), "saw:3")

    def test_response_file(self):
        with tempfile.TemporaryDirectory() as td:
            f = Path(td) / "transcript.txt"
            f.write_text("replayed transcript", encoding="utf-8")
            p = providers.MockProvider(env={"BMAD_EVAL_MOCK_RESPONSE_FILE": str(f)})
            self.assertEqual(p.generate("ignored"), "replayed transcript")


class TestFileBlocks(unittest.TestCase):
    def test_extracts_safe_blocks_and_skips_unsafe(self):
        text = (
            "--- BEGIN FILE: a/b.txt ---\ncontent B\n--- END FILE ---\n"
            "prose in between\n"
            "--- BEGIN FILE: ../evil.txt ---\nnope\n--- END FILE ---\n"
            "--- BEGIN FILE: c.md ---\nline1\nline2\n--- END FILE ---\n"
        )
        blocks = runner.extract_file_blocks(text)
        self.assertEqual(set(blocks), {"a/b.txt", "c.md"})
        self.assertEqual(blocks["a/b.txt"], "content B")
        self.assertEqual(blocks["c.md"], "line1\nline2")

    def test_no_blocks(self):
        self.assertEqual(runner.extract_file_blocks("just prose"), {})


class TestRunAgentAndEval(unittest.TestCase):
    def test_run_agent_writes_files_and_returns_transcript(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            spec_path, spec = make_spec(tmp, assertions=[])
            workspace = runner.materialize_fixture(spec_path, spec)
            try:
                mock = providers.MockProvider(script=SCRIPTED_TRANSCRIPT, env={})
                result = runner.run_agent(spec, "claude", workspace, provider=mock)
                self.assertEqual(result.meta["provider"], "mock")
                self.assertEqual(result.meta["files_written"], ["out/report.md"])
                self.assertIn("MISSING a DPA", result.transcript)
                report = (workspace / "out" / "report.md").read_text(encoding="utf-8")
                self.assertIn("zenith-corp", report)
            finally:
                shutil.rmtree(workspace, ignore_errors=True)

    def test_run_eval_end_to_end_pass(self):
        with tempfile.TemporaryDirectory() as td:
            spec_path, spec = make_spec(Path(td), assertions=[
                {"id": "report-exists", "kind": "file_exists", "path": "out/report.md"},
                {"id": "cites-art-28", "kind": "contains", "path": "out/report.md",
                 "pattern": r"Art\.? ?28"},
                {"id": "flags-dpa", "kind": "must_flag", "pattern": "(?i)missing a dpa"},
                {"id": "no-rubber-stamp", "kind": "must_not_flag",
                 "pattern": "(?i)fully compliant"},
            ])
            mock = providers.MockProvider(script=SCRIPTED_TRANSCRIPT, env={})
            report = runner.run_eval(spec_path, spec, "claude", provider=mock)
            self.assertEqual(report.errors, [])
            self.assertEqual(report.status, "pass")
            self.assertEqual(report.score, 1.0)
            self.assertEqual(len(report.assertion_results), 4)

    def test_run_eval_end_to_end_fail(self):
        with tempfile.TemporaryDirectory() as td:
            spec_path, spec = make_spec(Path(td), assertions=[
                {"id": "missing-file", "kind": "file_exists", "path": "never/made.md"},
            ])
            mock = providers.MockProvider(script="no file blocks here", env={})
            report = runner.run_eval(spec_path, spec, "claude", provider=mock)
            self.assertEqual(report.status, "fail")
            self.assertEqual(report.score, 0.0)

    def test_run_eval_with_rubric_uses_judge_via_gateway(self):
        with tempfile.TemporaryDirectory() as td:
            spec_path, spec = make_spec(
                Path(td),
                assertions=[{"id": "flags-dpa", "kind": "must_flag",
                             "pattern": "(?i)missing a dpa"}],
                rubric=[{"id": "accuracy", "criterion": "Findings are accurate.", "weight": 1}],
                weights={"assertions": 0.5, "rubric": 0.5},
            )
            agent = providers.MockProvider(script=SCRIPTED_TRANSCRIPT, env={})
            judge = providers.MockProvider(script='{"accuracy": 1.0}', env={})
            report = runner.run_eval(spec_path, spec, "claude",
                                     provider=agent, judge_provider=judge)
            self.assertEqual(report.status, "pass")
            self.assertEqual(report.score, 1.0)

    def test_provider_error_becomes_error_report_not_crash(self):
        class Boom(providers.Provider):
            name = "boom"
            def generate(self, prompt, **kw):
                raise providers.ProviderError("backend exploded")
        with tempfile.TemporaryDirectory() as td:
            spec_path, spec = make_spec(Path(td), assertions=[
                {"id": "x", "kind": "must_flag", "pattern": "anything"},
            ])
            report = runner.run_eval(spec_path, spec, "claude", provider=Boom())
            self.assertEqual(report.status, "error")
            self.assertIn("backend exploded", report.errors[0])


class TestJudgeParsing(unittest.TestCase):
    RUBRIC = [{"id": "a", "criterion": "c1"}, {"id": "b", "criterion": "c2"}]

    def _judge(self, script):
        spec = {"rubric": self.RUBRIC}
        result = runner.AgentResult(transcript="t")
        return runner.judge_rubric(spec, result, providers.MockProvider(script=script, env={}))

    def test_valid_json_clamped(self):
        scores = self._judge('prose before {"a": 0.5, "b": 7, "ghost": 1} after')
        self.assertEqual(scores, {"a": 0.5, "b": 1.0})

    def test_garbage_returns_empty(self):
        self.assertEqual(self._judge("no json at all"), {})
        self.assertEqual(self._judge('{"a": "not-a-number"}'), {})

    def test_default_mock_echo_is_conservative(self):
        # The default (unscripted) mock echoes the prompt; judge parsing must
        # not be fooled into fabricated scores by the echoed instructions.
        spec = {"rubric": self.RUBRIC}
        result = runner.AgentResult(transcript="t")
        scores = runner.judge_rubric(spec, result, providers.MockProvider(env={}))
        for v in scores.values():
            self.assertTrue(0.0 <= v <= 1.0)


class TestActualAgentContext(unittest.TestCase):
    def prepare(self, root, *, mode="mock", variant="agent"):
        spec_path, spec = make_spec(root, assertions=[{"kind": "must_flag", "pattern": "done"}])
        (root / "Agent.md").write_text("DISTINCTIVE-AGENT: cite observed evidence only.\r\n", encoding="utf-8", newline="")
        (root / "resource.md").write_text("MANDATORY-RESOURCE: preserve customized files.\n", encoding="utf-8")
        spec["agent_source"] = "Agent.md"
        spec["agent_resources"] = ["resource.md"]
        context = runner.prepare_agent_context(spec, root / "fixture", source_root=root,
                                               execution_mode=mode, context_variant=variant)
        return spec_path, spec, context

    def test_exact_agent_and_resource_reach_provider_and_changes_change_input(self):
        class Capture(providers.MockProvider):
            def generate(self, prompt, **kwargs):
                self.received = (prompt, kwargs)
                return "done"
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec, context = self.prepare(root)
            provider = Capture(env={})
            result = runner.run_agent(spec, "claude", root / "fixture", provider, context=context)
            self.assertIn("DISTINCTIVE-AGENT", provider.received[1]["system"])
            self.assertIn("MANDATORY-RESOURCE", provider.received[1]["system"])
            self.assertEqual(provider.received[0], context.prompt)
            self.assertIn("\r\n", context.resources[0].content)
            self.assertEqual(result.meta["context"]["resources"][0]["sha256"], evidence.sha256((root / "Agent.md").read_bytes()))
            (root / "Agent.md").write_text("CHANGED-AGENT", encoding="utf-8")
            changed = runner.prepare_agent_context(spec, root / "fixture", source_root=root, execution_mode="mock")
            self.assertNotEqual(context.context_sha256, changed.context_sha256)
            runner.run_agent(spec, "claude", root / "fixture", provider, context=changed)
            self.assertIn("CHANGED-AGENT", provider.received[1]["system"])

    def test_missing_declared_resource_fails_before_provider_call(self):
        with tempfile.TemporaryDirectory() as td:
            spec_path, spec = make_spec(Path(td), assertions=[{"kind": "must_flag", "pattern": "done"}])
            spec["agent_resources"] = ["definitely-not-an-agent-resource.md"]
            provider = providers.MockProvider(env={})
            with patch.object(provider, "generate") as generate:
                report = runner.run_eval(spec_path, spec, "claude", provider=provider)
            self.assertEqual(report.status, "error")
            self.assertIn("missing file", report.errors[0])
            generate.assert_not_called()

    def test_missing_case_mismatch_and_cross_platform_path_escapes_fail(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec, _ = self.prepare(root)
            for path in ("missing.md", "agent.md", "../Agent.md", "/Agent.md", "C:/Agent.md", "a\\..\\Agent.md", "Agent.md:stream"):
                with self.subTest(path=path), self.assertRaises(evidence.EvidenceError):
                    runner.prepare_agent_context({**spec, "agent_source": path}, root / "fixture", source_root=root)

    def test_oversize_and_invalid_utf8_resources_are_not_truncated(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec, _ = self.prepare(root)
            for raw in (b"x" * (evidence.MAX_RESOURCE_BYTES + 1), b"\xff", b"nul\x00content"):
                (root / "resource.md").write_bytes(raw)
                with self.assertRaises(evidence.EvidenceError):
                    runner.prepare_agent_context(spec, root / "fixture", source_root=root)

    def test_linked_agent_and_fixture_are_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec, _ = self.prepare(root)
            linked = root / "linked.md"
            try:
                linked.symlink_to(root / "Agent.md")
            except OSError as exc:
                self.skipTest(f"symlink privilege unavailable on this host: {exc}")
            with self.assertRaises(evidence.EvidenceError):
                runner.prepare_agent_context({**spec, "agent_source": "linked.md"}, root / "fixture", source_root=root)
            (root / "fixture" / "linked.md").symlink_to(root / "Agent.md")
            with self.assertRaises(evidence.EvidenceError):
                runner.prepare_agent_context(spec, root / "fixture", source_root=root)

    def test_roundtrip_is_immutable_and_tampering_fails(self):
        with tempfile.TemporaryDirectory() as td:
            _, _, context = self.prepare(Path(td))
            self.assertEqual(runner.context_from_dict(context.to_dict()), context)
            with self.assertRaises(FrozenInstanceError):
                context.resources[0].content = "overwritten"
            for mutate in (lambda data: data.update(prompt="changed"),
                           lambda data: data["resources"][0].update(content="changed"),
                           lambda data: data["fixture_files"][0].update(sha256="0" * 64)):
                data = context.to_dict()
                mutate(data)
                with self.assertRaises(evidence.EvidenceError):
                    runner.context_from_dict(data)

    def test_generic_control_is_explicit_and_has_same_task_fixture_wrapper(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec, agent = self.prepare(root, mode="native-host")
            control = runner.prepare_agent_context(spec, root / "fixture", source_root=root,
                                                    execution_mode="native-host", context_variant="generic-control")
            self.assertEqual(agent.prompt, control.prompt)
            self.assertEqual(control.resources, ())
            self.assertNotIn("DISTINCTIVE-AGENT", control.system)
            self.assertTrue(agent.system.startswith(control.system))
            self.assertNotEqual(agent.context_sha256, control.context_sha256)
            self.assertEqual(control.evidence()["context_variant"], "generic-control")

    def test_stale_fixture_is_rejected_before_a_provider_receives_context(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec, context = self.prepare(root)
            (root / "fixture" / "docs" / "input.md").write_text("changed", encoding="utf-8")
            provider = providers.MockProvider(env={})
            with patch.object(provider, "generate") as generate, self.assertRaises(evidence.EvidenceError):
                runner.run_agent(spec, "claude", root / "fixture", provider, context=context)
            generate.assert_not_called()


class TestAcceptanceEvidence(unittest.TestCase):
    def test_completion_claim_and_task_id_cannot_outweigh_a_critical_failure(self):
        with tempfile.TemporaryDirectory() as td:
            spec_path, spec = make_spec(Path(td), assertions=[
                {"id": "implementation", "kind": "file_exists", "path": "missing.js", "weight": 1},
                {"id": "task-id", "kind": "must_flag", "pattern": "test/backend", "weight": 99},
            ], rubric=[{"id": "complete", "criterion": "Is the task done?"}],
                weights={"assertions": 0.1, "rubric": 0.9})
            report = runner.run_eval(spec_path, spec, "claude",
                                     provider=providers.MockProvider(script="test/backend: everything is complete", env={}),
                                     judge_provider=providers.MockProvider(script='{"complete": 1}', env={}))
            self.assertGreater(report.score, spec["scoring"]["pass_threshold"])
            self.assertEqual(report.status, "fail")
            self.assertFalse(report.evidence["acceptance"]["critical_checks_pass"])

    def test_nonzero_execution_cannot_pass_even_when_all_checks_pass(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            spec_path, spec = make_spec(root, assertions=[{"kind": "must_flag", "pattern": "done"}])
            workspace = root / "fixture"
            context = runner.prepare_agent_context(spec, workspace)
            result = runner.AgentResult("done", exit_ok=False, meta={"execution_mode": "native-host"})
            report = runner.score_external_run(spec_path, spec, workspace, result, context=context, attempt_id="attempt-1")
            self.assertEqual(report.score, 1)
            self.assertEqual(report.status, "fail")
            self.assertFalse(report.evidence["acceptance"]["execution_ok"])

    def test_mismatched_attempt_mode_and_acceptance_spec_fail(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            spec_path, spec = make_spec(root, assertions=[{"kind": "must_flag", "pattern": "done"}])
            workspace = root / "fixture"
            context = runner.prepare_agent_context(spec, workspace)
            for metadata in ({"execution_mode": "mock"}, {"execution_mode": "native-host", "attempt_id": "other"}):
                report = runner.score_external_run(spec_path, spec, workspace, runner.AgentResult("done", meta=metadata),
                                                   context=context, attempt_id="attempt-1")
                self.assertEqual(report.status, "error")
            spec["assertions"].append({"kind": "must_flag", "pattern": "new"})
            report = runner.score_external_run(spec_path, spec, workspace,
                                               runner.AgentResult("done", meta={"execution_mode": "native-host"}),
                                               context=context, attempt_id="attempt-1")
            self.assertEqual(report.status, "error")

    def test_failed_command_records_exit_script_and_stream_hashes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec = make_spec(root, assertions=[{"id": "reject", "kind": "command_succeeds", "command": ["python", "check.py"]}])
            workspace = root / "fixture"
            (workspace / "check.py").write_text("import sys\nprint('observed failure')\nsys.exit(7)\n", encoding="utf-8")
            checks = runner.evaluate_assertions(spec, workspace, runner.AgentResult("complete"))
            self.assertFalse(checks[0]["passed"])
            record = checks[0]["evidence"]
            self.assertEqual(record["exit_code"], 7)
            self.assertEqual(record["script"]["sha256"], evidence.sha256((workspace / "check.py").read_bytes()))
            self.assertIn("observed failure", record["stdout"])
            self.assertEqual(record["before"], record["after"])

    def test_held_out_checker_is_not_in_prompt_and_runs_at_explicit_root(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            spec_path, spec = make_spec(root, assertions=[{"kind": "command_succeeds", "command": ["python", "{checks}/verify.py", "{workspace}"]}])
            checks = root / "checks"
            checks.mkdir()
            (checks / "verify.py").write_text("import pathlib, sys\nassert (pathlib.Path(sys.argv[1]) / 'docs/input.md').is_file()\nprint('PRIVATE-CHECK-OK')\n", encoding="utf-8")
            workspace = root / "fixture"
            context = runner.prepare_agent_context(spec, workspace)
            self.assertNotIn("PRIVATE-CHECK-OK", context.system + context.prompt)
            report = runner.score_external_run(spec_path, spec, workspace,
                                               runner.AgentResult("done", meta={"execution_mode": "native-host", "provider": "native-host"}),
                                               context=context, attempt_id="attempt-1", checks_root=checks)
            self.assertEqual(report.status, "pass", report.errors)
            self.assertIsNone(report.evidence["execution"]["usage"])
            self.assertEqual(report.assertion_results[0]["evidence"]["script"]["root"], "checks")

    def test_command_mutation_invalidates_the_result_even_if_check_is_diagnostic(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            spec_path, spec = make_spec(root, assertions=[
                {"kind": "command_succeeds", "command": ["python", "mutate.py"], "critical": False, "weight": 1},
                {"kind": "must_flag", "pattern": "done", "weight": 99}])
            workspace = root / "fixture"
            (workspace / "mutate.py").write_text("from pathlib import Path\nPath('new-file.txt').write_text('mutated')\n", encoding="utf-8")
            context = runner.prepare_agent_context(spec, workspace)
            report = runner.score_external_run(spec_path, spec, workspace,
                                               runner.AgentResult("done", meta={"execution_mode": "native-host"}),
                                               context=context, attempt_id="attempt-1")
            self.assertEqual(report.status, "fail")
            self.assertGreater(report.score, 0.8)
            self.assertIn("write-scope", [check["id"] for check in report.assertion_results])

    def test_unsafe_cwd_and_shell_or_inline_commands_never_execute(self):
        cases = [
            {"command": "python check.py; echo injected"},
            {"command": ["python", "-c", "print('injected')"]},
            {"command": ["node", "--eval", "process.exit(0)"]},
            {"command": ["python", "../check.py"]},
            {"command": ["python", "check.py"], "cwd": "../"},
            {"command": ["python", "check.py"], "cwd": "C:/outside"},
        ]
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec = make_spec(root, assertions=[])
            for case in cases:
                spec["assertions"] = [{"kind": "command_succeeds", **case}]
                with self.subTest(case=case), patch.object(runner, "capture_command") as command:
                    checks = runner.evaluate_assertions(spec, root / "fixture", runner.AgentResult("done"))
                    self.assertFalse(checks[0]["passed"])
                    command.assert_not_called()

    def test_response_write_scope_and_unsafe_paths_reject_before_any_file_write(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec = make_spec(root, assertions=[])
            spec["task"]["allowed_writes"] = ["review/"]
            for path in ("../outside.md", "docs/input.md", "C:/outside.md", "review/../../outside.md"):
                transcript = f"--- BEGIN FILE: review/good.md ---\ngood\n--- END FILE ---\n--- BEGIN FILE: {path} ---\nbad\n--- END FILE ---\n"
                result = runner.run_agent(spec, "claude", root / "fixture", providers.MockProvider(script=transcript, env={}))
                self.assertFalse(result.exit_ok)
                self.assertFalse((root / "fixture" / "review" / "good.md").exists())


class TestProviderEvidence(unittest.TestCase):
    def test_effective_model_and_observed_usage_without_network_or_secrets(self):
        env = {"OPENAI_API_KEY": "DO-NOT-RECORD", "OPENAI_MODEL": "configured-model",
               "BMAD_EVAL_MODEL_GPT": "alias-model"}
        provider = providers.OpenAIProvider(env=env)
        description = provider.describe_call("gpt", timeout_s=17, max_tokens=321)
        self.assertEqual(description["concrete_model"], "alias-model")
        self.assertEqual(description["effective_settings"]["max_tokens"], 321)
        self.assertNotIn("DO-NOT-RECORD", json.dumps(description))
        response = {"id": "response-1", "model": "observed-model", "usage": {"prompt_tokens": 10, "completion_tokens": 5},
                    "choices": [{"message": {"content": "done"}, "finish_reason": "stop"}]}
        with patch.object(providers, "_post_json", return_value=response) as post:
            self.assertEqual(provider.generate("prompt", model="gpt", system="actual agent", max_tokens=321), "done")
        self.assertEqual(post.call_args.args[1]["model"], "alias-model")
        self.assertEqual(provider.last_response["usage"], response["usage"])
        self.assertIsNone(provider.last_response["cost"])

    def test_truncated_response_is_not_successful_execution(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _, spec = make_spec(root, assertions=[])
            provider = providers.HTTPProvider(env={"BMAD_EVAL_HTTP_URL": "https://never-called.invalid"})
            response = {"choices": [{"message": {"content": "done"}, "finish_reason": "length"}]}
            with patch.object(providers, "_post_json", return_value=response):
                result = runner.run_agent(spec, "local", root / "fixture", provider)
            self.assertFalse(result.exit_ok)
            self.assertEqual(result.meta["execution_mode"], "rendered-response")
            self.assertIsNone(result.meta["usage"])


class TestBoundedCommandCapture(unittest.TestCase):
    def capture(self, root, code, *, limit=command_capture.MAX_OUTPUT_BYTES, timeout=2):
        script = root / "capture.py"
        script.write_text(code, encoding="utf-8")
        return command_capture.capture_command([sys.executable, str(script)], cwd=root,
                                               env=dict(os.environ), timeout_s=timeout,
                                               output_limit_bytes=limit)

    def test_exact_combined_limit_retains_complete_stream_digests(self):
        with tempfile.TemporaryDirectory() as td:
            result = self.capture(Path(td), "import os\nos.write(1, b'x' * 31)\nos.write(2, b'y' * 33)\n", limit=64)
        self.assertEqual(result["exit_code"], 0)
        self.assertIsNone(result["capture_failure"])
        self.assertTrue(result["output_capture_complete"])
        self.assertEqual(result["stdout_sha256"], evidence.sha256(b"x" * 31))
        self.assertEqual(result["stderr_sha256"], evidence.sha256(b"y" * 33))
        self.assertEqual(result["stdout_digest_scope"], "complete-stream")
        self.assertEqual(result["stderr_digest_scope"], "complete-stream")
        self.assertTrue(result["direct_child_reaped"])

    def test_limit_is_combined_across_streams_not_a_separate_cap_per_pipe(self):
        with tempfile.TemporaryDirectory() as td:
            result = self.capture(Path(td), "import os\nos.write(1, b'x' * 4096)\nos.write(2, b'y' * 4096)\n", limit=6144)
        self.assertTrue(result["output_limit_exceeded"])
        self.assertFalse(result["output_capture_complete"])
        self.assertEqual(result["stdout_captured_bytes"] + result["stderr_captured_bytes"], 6144)
        self.assertEqual(result["stdout_observed_bytes"] + result["stderr_observed_bytes"], 6145)
        self.assertEqual(result["stdout_sha256"], evidence.sha256(b"x" * result["stdout_captured_bytes"]))
        self.assertEqual(result["stderr_sha256"], evidence.sha256(b"y" * result["stderr_captured_bytes"]))
        self.assertTrue(result["direct_child_reaped"])

    def test_real_16_mib_output_fails_acceptance_with_bounded_capture(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            spec_path, spec = make_spec(root, assertions=[
                {"id": "noisy", "kind": "command_succeeds", "command": ["python", "noisy.py"],
                 "critical": False, "timeout_s": 5},
                {"id": "completion-claim", "kind": "must_flag", "pattern": "done", "weight": 99},
            ])
            workspace = root / "fixture"
            (workspace / "noisy.py").write_text("import os\nfor _ in range(4096):\n    os.write(1, b'x' * 4096)\n", encoding="utf-8")
            context = runner.prepare_agent_context(spec, workspace)
            started = time.monotonic()
            report = runner.score_external_run(spec_path, spec, workspace,
                                               runner.AgentResult("done", meta={"execution_mode": "native-host"}),
                                               context=context, attempt_id="noisy-attempt")
            elapsed = time.monotonic() - started
        self.assertEqual(report.status, "fail")
        self.assertGreater(report.score, 0.8)
        check = report.assertion_results[0]
        self.assertTrue(check["critical"])
        self.assertFalse(check["passed"])
        result = check["evidence"]
        self.assertEqual(result["capture_failure"], "output-limit")
        self.assertLessEqual(result["stdout_captured_bytes"] + result["stderr_captured_bytes"], command_capture.MAX_OUTPUT_BYTES)
        self.assertLessEqual(result["stdout_observed_bytes"] + result["stderr_observed_bytes"], command_capture.MAX_OUTPUT_BYTES + 1)
        self.assertEqual(result["stdout_sha256"], evidence.sha256(b"x" * result["stdout_captured_bytes"]))
        self.assertEqual(result["stdout_digest_scope"], "captured-prefix")
        self.assertLessEqual(len(result["stdout"]), 4000)
        self.assertTrue(result["direct_child_kill_attempted"])
        self.assertTrue(result["direct_child_reaped"])
        self.assertFalse(result["descendant_termination_verified"])
        self.assertLess(elapsed, 5)

    def test_timeout_kills_and_reaps_only_the_owned_direct_child(self):
        with tempfile.TemporaryDirectory() as td:
            started = time.monotonic()
            result = self.capture(Path(td), "import time\nprint('before-timeout', flush=True)\ntime.sleep(30)\n", timeout=0.5)
            elapsed = time.monotonic() - started
        self.assertTrue(result["timed_out"])
        self.assertFalse(result["output_capture_complete"])
        self.assertEqual(result["stdout_digest_scope"], "captured-prefix")
        self.assertEqual(result["stdout_sha256"], evidence.sha256(result["stdout"].encode("utf-8")))
        self.assertTrue(result["direct_child_kill_attempted"])
        self.assertTrue(result["direct_child_reaped"])
        self.assertFalse(result["descendant_termination_verified"])
        self.assertLess(elapsed, 2)

    def _finish_owned_descendant(self, root, nonce):
        """Cooperatively stop the exact test child, then verify its process exit.

        The PID comes from a nonce-bound receipt in our fresh private temp root.
        No process-name enumeration or termination of unrelated PIDs is used.
        """
        receipt = json.loads((root / "child.json").read_text(encoding="utf-8"))
        self.assertEqual(receipt["nonce"], nonce)
        pid = receipt["pid"]
        self.assertIs(type(pid), int)
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes

            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
            kernel.OpenProcess.restype = wintypes.HANDLE
            kernel.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
            kernel.WaitForSingleObject.restype = wintypes.DWORD
            kernel.TerminateProcess.argtypes = (wintypes.HANDLE, wintypes.UINT)
            kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
            handle = kernel.OpenProcess(0x00100001, False, pid)  # synchronize + terminate
            self.assertTrue(handle, "the nonce-owned descendant must still be running")
            try:
                (root / f"stop-{nonce}").write_text("stop", encoding="utf-8")
                status = kernel.WaitForSingleObject(handle, 3000)
                if status != 0:  # preserve cleanup even if the cooperative regression fails
                    kernel.TerminateProcess(handle, 1)
                    kernel.WaitForSingleObject(handle, 3000)
                self.assertEqual(status, 0, "owned descendant did not exit cooperatively")
            finally:
                kernel.CloseHandle(handle)
        else:
            (root / f"stop-{nonce}").write_text("stop", encoding="utf-8")
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                try:
                    os.kill(pid, 0)
                    status = Path(f"/proc/{pid}/stat")
                    if status.exists() and status.read_text().rsplit(") ", 1)[1].split()[0] == "Z":
                        return  # stopped; orphan reaping belongs to this host's init
                except ProcessLookupError:
                    return
                time.sleep(0.02)
            command_line = Path(f"/proc/{pid}/cmdline").read_bytes()
            if nonce.encode("utf-8") in command_line and str(root / "holder.py").encode("utf-8") in command_line:
                os.kill(pid, signal.SIGKILL)
            self.fail("owned descendant did not exit cooperatively")

    def test_timeout_returns_when_a_descendant_retains_both_pipe_handles(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            nonce = uuid.uuid4().hex
            (root / "holder.py").write_text(
                "import json, os, sys, time\nfrom pathlib import Path\n"
                "root = Path(__file__).parent\nnonce = sys.argv[1]\n"
                "(root / 'child.json').write_text(json.dumps({'pid': os.getpid(), 'nonce': nonce}))\n"
                "deadline = time.monotonic() + 15\n"
                "while not (root / ('stop-' + nonce)).exists() and time.monotonic() < deadline:\n    time.sleep(0.02)\n",
                encoding="utf-8")
            code = (
                "import subprocess, sys\nfrom pathlib import Path\n"
                f"subprocess.Popen([sys.executable, str(Path(__file__).with_name('holder.py')), '{nonce}'])\n"
                "print('parent exited; child owns inherited pipes', flush=True)\n"
            )
            started = time.monotonic()
            try:
                result = self.capture(root, code, timeout=0.75)
                elapsed = time.monotonic() - started
                self.assertTrue(result["timed_out"])
                self.assertEqual(result["exit_code"], 0)
                self.assertFalse(result["direct_child_kill_attempted"])
                self.assertTrue(result["direct_child_reaped"])
                self.assertFalse(result["descendant_termination_verified"])
                self.assertFalse(result["output_capture_complete"])
                self.assertLess(elapsed, 2)
            finally:
                # Wait only for the receipt created by our exact launched child,
                # then stop it even if an assertion above failed.
                deadline = time.monotonic() + 2
                while not (root / "child.json").exists() and time.monotonic() < deadline:
                    time.sleep(0.02)
                self._finish_owned_descendant(root, nonce)


class TestCli(unittest.TestCase):
    def test_self_check_still_default_and_green(self):
        self.assertEqual(runner.main(["--self-check", "--quiet"]), 0)

    def test_model_mode_runs_offline_with_mock(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "summary.json"
            rc = runner.main([
                "--model", "claude", "--provider", "mock",
                "--spec", "shield", "--quiet", "--json", str(out),
            ])
            self.assertIn(rc, (0, 1))  # scored run, not an error/crash (rc 2)
            summary = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(summary["mode"], "model:claude")
            self.assertEqual(summary["provider"], "mock")
            self.assertGreaterEqual(summary["total"], 1)
            for s in summary["specs"]:
                self.assertIn(s["status"], ("pass", "fail"))
                self.assertIsInstance(s["score"], float)
                self.assertTrue(s["assertions"])  # assertions were evaluated

    def test_no_matching_spec_exits_2(self):
        self.assertEqual(runner.main(["--model", "claude", "--provider", "mock",
                                      "--spec", "no-such-spec", "--quiet"]), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
