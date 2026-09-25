#!/usr/bin/env python3
"""BMAD+ agent eval runner — Pillar 4 of the north-star blueprint.

Loads golden-task specs (``evals/<agent>/<task>/eval.yaml``, format documented in
``evals/schema.md``), validates them, and scores agent behavior model-agnostically.

Modes
-----
--self-check (default)
    No model calls. Validates every spec against the schema, materializes every
    fixture into a temp workspace to prove it resolves, compiles every regex,
    and emits a JUnit-style XML + JSON summary. Exits non-zero on any bad spec.
    CI also runs the separate scored.py offline replay gate.

--model <name>
    Rendered response: materialize fixture -> run_agent(spec, model, workspace) ->
    evaluate assertions -> (optional) LLM-judged rubric -> score. run_agent()
    routes through the provider-neutral gateway in ``providers.py``. The selected
    agent and explicit mandatory resources are sent as actual system input;
    this response interface does not give the model execution tools.
    Providers (mock | anthropic | openai | http) are selected via ``--provider`` or
    ``$BMAD_EVAL_PROVIDER``; the default is the deterministic offline ``mock``
    provider, so this mode NEVER hits the network unless a real provider is
    explicitly configured. See evals/_runner/README-backend.md.

Requires: Python >= 3.11, pyyaml (already pinned in mcp-server/requirements.txt).

Usage:
    python evals/_runner/run.py
    python evals/_runner/run.py --self-check --json out.json --junit out.xml
    python evals/_runner/run.py --spec shield/gdpr-ropa
    python evals/_runner/run.py --model claude                       # mock provider (offline)
    python evals/_runner/run.py --model claude --provider anthropic  # real model run

Author: Laurent Rochetta
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("error: pyyaml is required — pip install pyyaml (see mcp-server/requirements.txt)", file=sys.stderr)
    sys.exit(2)

# providers.py lives next to this file; make it importable whether run.py is
# executed as a script, imported by test_backend.py, or collected by pytest.
_RUNNER_DIR = str(Path(__file__).resolve().parent)
if _RUNNER_DIR not in sys.path:
    sys.path.insert(0, _RUNNER_DIR)
import providers  # noqa: E402  (local module, needs the sys.path fix above)
import policy  # noqa: E402
from command_capture import capture_command  # noqa: E402
from context_evidence import (  # noqa: E402
    EvidenceError, PreparedContext, MAX_CONTEXT_BYTES, MAX_RESOURCE_BYTES,
    MAX_FILES, MAX_TOTAL_BYTES, MAX_FILE_BYTES, explicit_root, manifest,
    object_hash, read_record, resolve_inside, revision, safe_relative, sha256, snapshot,
    verify_context,
)

EVALS_ROOT = Path(__file__).resolve().parent.parent  # .../evals
REPO_ROOT = EVALS_ROOT.parent

SCHEMA_VERSION = 1

# The harness is a source-maintainer tool; it reads the same registry as the
# generators instead of maintaining a second pack/model list.
_REGISTRY = policy.load_registry()
PACK_IDS = tuple(_REGISTRY["packs"])
SUPPORTED_MODELS = tuple(_REGISTRY["targets"]["models_supported"])

# kind -> required kind-specific fields
ASSERTION_KINDS = {
    "file_exists": ("path",),
    "contains": ("path", "pattern"),
    "command_succeeds": ("command",),
    "must_flag": ("pattern",),
    "must_not_flag": ("pattern",),
}

REQUIRED_TOP_FIELDS = (
    "schema_version", "id", "pack", "agent", "agent_source",
    "description", "models", "fixture", "task", "assertions", "scoring",
)


# ─────────────────────────────────────────────────────────────────────────────
# Data model
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class AgentResult:
    """Provider-neutral outcome of one agent run against a workspace."""
    transcript: str            # everything the agent said (for must_flag / must_not_flag)
    exit_ok: bool = True       # backend-level success (agent completed within budget)
    duration_s: float = 0.0
    model: str = ""
    meta: dict = field(default_factory=dict)


@dataclass
class SpecReport:
    spec_id: str
    path: str
    status: str                 # "pass" | "fail" | "error"
    errors: list = field(default_factory=list)
    score: float | None = None
    assertion_results: list = field(default_factory=list)
    duration_s: float = 0.0
    evidence: dict = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# Discovery + validation
# ─────────────────────────────────────────────────────────────────────────────

def discover_specs(root: Path = EVALS_ROOT) -> list[Path]:
    """Consume the registry suite glob; private/generated directories stay out."""
    return policy.discover(root)


def _is_safe_relpath(value: str) -> bool:
    return safe_relative(value)


def _check_regex(pattern, errors: list, where: str) -> None:
    if not isinstance(pattern, str) or not pattern:
        errors.append(f"{where}: pattern must be a non-empty string")
        return
    try:
        re.compile(pattern)
    except re.error as exc:
        errors.append(f"{where}: invalid regex ({exc})")


def validate_spec(spec: dict, spec_path: Path) -> list[str]:
    """Return a list of human-readable schema violations (empty == valid)."""
    errors: list[str] = []
    if not isinstance(spec, dict):
        return [f"{spec_path}: top level must be a mapping"]

    for f in REQUIRED_TOP_FIELDS:
        if f not in spec:
            errors.append(f"missing required field '{f}'")
    if errors:
        return errors  # can't go deeper safely

    if spec["schema_version"] != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}, got {spec['schema_version']!r}")

    expected_id = "/".join(spec_path.parent.relative_to(EVALS_ROOT).parts)
    if spec["id"] != expected_id:
        errors.append(f"id {spec['id']!r} must match directory {expected_id!r}")

    if spec["pack"] not in PACK_IDS:
        errors.append(f"pack {spec['pack']!r} not in registry pack ids {list(PACK_IDS)}")

    gates = spec.get("gates", [])
    if (not isinstance(gates, list) or any(not isinstance(gate, str) for gate in gates)
            or len(gates) != len(set(gates))):
        errors.append("gates must be a list of unique registry gate names")
    elif any(gate not in _REGISTRY.get("eval", {}).get("gates", {}) for gate in gates):
        errors.append("gates contains an unknown registry gate")
    if "replay" in spec and not safe_relative(spec["replay"]):
        errors.append("replay must be an explicit task-relative file")

    try:
        _load_agent_resources(spec, REPO_ROOT)
    except (OSError, EvidenceError) as exc:
        errors.append(f"agent context: {exc}")

    models = spec["models"]
    if not isinstance(models, list) or not models:
        errors.append("models must be a non-empty list")
    else:
        for m in models:
            if m not in SUPPORTED_MODELS:
                errors.append(f"model {m!r} not in supported models {list(SUPPORTED_MODELS)}")

    try:
        fixture = resolve_inside(spec_path.parent, spec["fixture"], kind="directory")
        if not snapshot(fixture):
            errors.append(f"fixture {spec['fixture']!r} is empty")
    except (OSError, EvidenceError) as exc:
        errors.append(f"fixture: {exc}")

    task = spec["task"]
    if not isinstance(task, dict) or not isinstance(task.get("prompt"), str) or not task["prompt"].strip():
        errors.append("task.prompt must be a non-empty string")
    if isinstance(task, dict):
        for name in ("timeout_s", "max_tokens"):
            if name in task and (type(task[name]) is not int or task[name] <= 0):
                errors.append(f"task.{name} must be a positive integer")
        try:
            _write_scope(task)
        except EvidenceError as exc:
            errors.append(str(exc))

    assertions = spec["assertions"]
    if not isinstance(assertions, list) or not assertions:
        errors.append("assertions must be a non-empty list")
        assertions = []
    assertion_ids = set()
    for i, a in enumerate(assertions):
        where = f"assertions[{i}]" + (f" ({a.get('id')})" if isinstance(a, dict) and a.get("id") else "")
        if not isinstance(a, dict):
            errors.append(f"{where}: must be a mapping")
            continue
        aid = a.get("id", f"assertion-{i}")
        if not isinstance(aid, str) or not aid or aid in assertion_ids:
            errors.append(f"{where}: assertion id must be a unique non-empty string")
        else:
            assertion_ids.add(aid)
        kind = a.get("kind")
        if kind not in ASSERTION_KINDS:
            errors.append(f"{where}: unknown kind {kind!r} (allowed: {sorted(ASSERTION_KINDS)})")
            continue
        for req in ASSERTION_KINDS[kind]:
            if req not in a:
                errors.append(f"{where}: kind '{kind}' requires field '{req}'")
        if "path" in a and not _is_safe_relpath(str(a.get("path", ""))):
            errors.append(f"{where}: path must be workspace-relative (no absolute paths, no '..')")
        if "cwd" in a and not safe_relative(a["cwd"], allow_root=True):
            errors.append(f"{where}: cwd must be workspace-relative")
        if "critical" in a and type(a["critical"]) is not bool:
            errors.append(f"{where}: critical must be boolean")
        if kind == "command_succeeds" and "command" in a:
            try:
                parse_command(a["command"])
            except EvidenceError as exc:
                errors.append(f"{where}: {exc}")
        if "timeout_s" in a and (type(a["timeout_s"]) is not int or not 0 < a["timeout_s"] <= 900):
            errors.append(f"{where}: timeout_s must be an integer in [1, 900]")
        if "pattern" in a:
            _check_regex(a["pattern"], errors, where)
        if "weight" in a and not _positive_number(a["weight"]):
            errors.append(f"{where}: weight must be a positive number")

    rubric = spec.get("rubric", [])
    if rubric is not None and not isinstance(rubric, list):
        errors.append("rubric must be a list")
        rubric = []
    for i, r in enumerate(rubric or []):
        where = f"rubric[{i}]"
        if not isinstance(r, dict) or not r.get("id") or not r.get("criterion"):
            errors.append(f"{where}: requires 'id' and 'criterion'")
            continue
        if "weight" in r and not _positive_number(r["weight"]):
            errors.append(f"{where}: weight must be a positive number")

    scoring = spec["scoring"]
    if not isinstance(scoring, dict):
        errors.append("scoring must be a mapping")
    else:
        thr = scoring.get("pass_threshold")
        if not _positive_number(thr) or not (0 < thr <= 1):
            errors.append("scoring.pass_threshold must be a number in (0, 1]")
        w = scoring.get("weights")
        if not isinstance(w, dict) or set(w) != {"assertions", "rubric"}:
            errors.append("scoring.weights must be exactly {assertions, rubric}")
        else:
            if any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 1 for v in w.values()):
                errors.append("scoring weights must be finite numbers in [0, 1]")
                return errors
            total = sum(w.values())
            if abs(total - 1.0) > 1e-6:
                errors.append(f"scoring.weights must sum to 1.0 (got {total})")
            if w.get("rubric", 0) > 0 and not (rubric or []):
                errors.append("scoring.weights.rubric > 0 but the spec has no rubric")

    return errors


# ─────────────────────────────────────────────────────────────────────────────
# Execution primitives
# ─────────────────────────────────────────────────────────────────────────────

def materialize_fixture(spec_path: Path, spec: dict, dest: Path | None = None) -> Path:
    """Copy a fully validated fixture into a fresh, empty, explicit root."""
    src = resolve_inside(spec_path.parent, spec["fixture"], kind="directory")
    records = snapshot(src)
    if not records:
        raise EvidenceError("fixture must contain at least one file")
    if dest is None:
        workspace = Path(tempfile.mkdtemp(prefix="bmad-eval-"))
    else:
        workspace = Path(dest)
        if not workspace.exists():
            parent = explicit_root(workspace.parent)
            workspace = resolve_inside(parent, workspace.name, kind="directory", missing=True)
            workspace.mkdir()
    workspace = explicit_root(workspace)
    if any(workspace.iterdir()):
        raise EvidenceError("fixture destination must be empty")
    for record in records:
        _write_file(workspace, record.path, record.content)
    return workspace


# What the model gets told about how to act on the workspace. Provider-neutral:
# any text model can follow it, so evals stay runnable on claude/gpt/gemini/local.
AGENT_SYSTEM_PROMPT = (
    "You are a BMAD+ agent under evaluation. You are given a task and a "
    "read-only snapshot of a workspace. Everything you write in your reply is "
    "your transcript and will be scored. To create or overwrite a file in the "
    "workspace, emit a file block using EXACTLY this fence format:\n"
    "--- BEGIN FILE: relative/path/to/file ---\n"
    "<full file content>\n"
    "--- END FILE ---\n"
    "Paths must be workspace-relative (no absolute paths, no '..'). "
    "Emit the complete content of each file (no diffs, no elisions). "
    "Outside file blocks, write your analysis and findings as plain text. "
    "This response interface has no execution tools. Do not claim that tests "
    "were executed here; independent checks run after the response."
)

NATIVE_SYSTEM_PROMPT = (
    "You are performing an evaluation task in an isolated workspace using the "
    "tools actually exposed by your host. Read the supplied task and workspace "
    "files, respect the declared write scope, and report observed command "
    "results accurately. Missing or blocked tools remain an explicit limitation. "
    "Do not infer acceptance from completion prose; independent checks follow."
)

FILE_BLOCK_RE = re.compile(
    r"^--- BEGIN FILE: (?P<path>[^\n]+?) ---\r?\n(?P<body>.*?)\r?\n?^--- END FILE ---\s*$",
    re.MULTILINE | re.DOTALL,
)

def _positive_number(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def _write_scope(task: dict) -> tuple[str, ...]:
    entries = task.get("allowed_writes", ["."])
    if not isinstance(entries, list) or any(not isinstance(entry, str) or not safe_relative(
            entry[:-1] if entry.endswith("/") else entry, allow_root=True) for entry in entries):
        raise EvidenceError("task.allowed_writes must list exact relative paths or directory prefixes ending '/' ('.' permits the whole workspace)")
    return tuple(entries)


def _can_write(relative: str, scope: tuple[str, ...]) -> bool:
    return any(entry == "." or relative == entry or (entry.endswith("/") and relative.startswith(entry)) for entry in scope)


def _write_file(workspace: Path, relative: str, content: str) -> None:
    target = resolve_inside(workspace, relative, missing=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Recheck after creating parents. External actors must not mutate this root
    # concurrently; path validation is not a filesystem sandbox/locking scheme.
    target = resolve_inside(workspace, relative, missing=True)
    target.write_bytes(content.encode("utf-8"))


def _load_agent_resources(spec: dict, source_root: Path):
    source = spec.get("agent_source")
    references = spec.get("agent_resources", [])
    if not safe_relative(source):
        raise EvidenceError("agent_source must be an explicit repository-relative file")
    if not isinstance(references, list) or any(not safe_relative(path) for path in references):
        raise EvidenceError("agent_resources must be an explicit list of repository-relative files")
    paths = [source, *references]
    if len(paths) != len(set(paths)):
        raise EvidenceError("agent_source/agent_resources contains duplicate paths")
    if len(paths) > MAX_FILES:
        raise EvidenceError("too many mandatory agent resources")
    records = tuple(read_record(source_root, path, limit=MAX_RESOURCE_BYTES) for path in paths)
    if sum(record.size_bytes for record in records) > MAX_CONTEXT_BYTES:
        raise EvidenceError(f"agent resources exceed {MAX_CONTEXT_BYTES} bytes")
    return records


def prepare_agent_context(spec: dict, workspace: Path, *, source_root: Path = REPO_ROOT,
                          execution_mode: str = "native-host", context_variant: str = "agent") -> PreparedContext:
    """Prepare the exact immutable inputs for a rendered response or native host.

    Explicit resources are the complete declared closure. There is no heuristic
    Markdown-link crawl, missing-resource fallback, truncation or live tool call.
    The generic-control variant is an intentional experiment, never a fallback.
    """
    if execution_mode not in ("mock", "rendered-response", "native-host"):
        raise EvidenceError("unknown execution mode")
    if context_variant not in ("agent", "generic-control"):
        raise EvidenceError("unknown context variant")
    source_root, workspace = explicit_root(source_root), explicit_root(workspace)
    # Resolve even the control's declaration: invalid experiments fail equally.
    declared = _load_agent_resources(spec, source_root)
    resources = declared if context_variant == "agent" else ()
    fixture = snapshot(workspace)
    prompt = spec.get("task", {}).get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise EvidenceError("task.prompt must be a non-empty string")
    scope = _write_scope(spec["task"])
    system = NATIVE_SYSTEM_PROMPT if execution_mode == "native-host" else AGENT_SYSTEM_PROMPT
    if resources:
        system += "\n\n## Selected agent and mandatory resources\n"
        system += "\n\n".join(f"### {record.path}\n{record.content}" for record in resources)
    parts = [prompt, "", f"Allowed writes: {json.dumps(scope)}", "", "## Workspace snapshot", ""]
    parts.extend(f"### {record.path}\n```\n{record.content}\n```" for record in fixture)
    prompt = "\n".join(parts)
    if len((system + prompt).encode("utf-8")) > MAX_TOTAL_BYTES:
        raise EvidenceError(f"complete provider input exceeds {MAX_TOTAL_BYTES} bytes")
    spec_digest = object_hash(spec)
    source_revision, baseline_revision = revision(source_root), revision(workspace)
    digest = object_hash({
        "system": system, "prompt": prompt,
        "resources": [record.evidence() for record in resources],
        "fixture": manifest(fixture), "spec_sha256": spec_digest,
        "execution_mode": execution_mode, "context_variant": context_variant,
        "source_revision": source_revision, "baseline_revision": baseline_revision,
    })
    return PreparedContext(system, prompt, resources, fixture, spec_digest, digest,
                           execution_mode, str(source_root), str(workspace), context_variant,
                           source_revision, baseline_revision)


context_from_dict = PreparedContext.from_dict


def build_agent_prompt(spec: dict, workspace: Path) -> str:
    """Compatibility helper; selected-agent content is passed as the system input."""
    return prepare_agent_context(spec, workspace, execution_mode="rendered-response").prompt


def extract_file_blocks(transcript: str, *, strict: bool = False) -> dict[str, str]:
    """Parse ``--- BEGIN FILE: path ---`` blocks out of a transcript.

    The old extraction-only API skips unsafe paths. Actual execution always uses
    strict mode and rejects the entire response before making any writes.
    """
    out: dict[str, str] = {}
    if not isinstance(transcript, str) or len(transcript.encode("utf-8")) > MAX_TOTAL_BYTES:
        raise EvidenceError("provider transcript is not text or exceeds the output budget")
    for m in FILE_BLOCK_RE.finditer(transcript):
        rel = m.group("path").strip()
        if not _is_safe_relpath(rel):
            if strict:
                raise EvidenceError(f"unsafe response file path: {rel!r}")
            continue
        if rel in out or len(m.group("body").encode("utf-8")) > MAX_FILE_BYTES:
            raise EvidenceError(f"duplicate or oversized response file: {rel}")
        out[rel] = m.group("body")
        if len(out) > MAX_FILES:
            raise EvidenceError("response contains too many files")
    return out


def run_agent(spec: dict, model: str, workspace: Path,
              provider: "providers.Provider | None" = None, *,
              context: PreparedContext | None = None, attempt_id: str | None = None) -> AgentResult:
    """Execute the agent under test against the workspace. PROVIDER-NEUTRAL SEAM.

    Contract: give the agent ``spec['task']['prompt']`` with ``workspace`` as its
    only writable root and ``spec['task'].get('timeout_s', 900)`` as wall-clock
    budget, then return an :class:`AgentResult` whose ``transcript`` contains
    everything the agent said. File-system effects stay in ``workspace``.

    Implementation: routes through the pluggable gateway in ``providers.py``
    (``get_provider()`` honors ``$BMAD_EVAL_PROVIDER``; default is the offline
    deterministic ``mock`` provider, so nothing here touches the network unless
    explicitly configured). The model's reply is the transcript; file blocks it
    emits (see :data:`AGENT_SYSTEM_PROMPT`) are materialized into ``workspace``
    so ``file_exists``/``contains``/``command_succeeds`` assertions see them.
    Keep this signature stable; CI and the Karpathy reward pipeline depend on it.
    """
    provider = provider or providers.get_provider()
    timeout_s = int(spec.get("task", {}).get("timeout_s", 900))
    max_tokens = int(spec.get("task", {}).get("max_tokens", providers.DEFAULT_MAX_TOKENS))
    metadata = provider.describe_call(model, timeout_s=timeout_s, max_tokens=max_tokens)
    context = context or prepare_agent_context(spec, workspace, execution_mode=metadata["execution_mode"])
    verify_context(context)
    if context.spec_sha256 != object_hash(spec) or manifest(snapshot(workspace)) != manifest(context.fixture_files):
        raise EvidenceError("spec or fixture changed after context preparation")
    if context.execution_mode != metadata["execution_mode"]:
        raise EvidenceError("prepared execution mode does not match provider")
    metadata.update({"attempt_id": attempt_id or uuid.uuid4().hex, "context": context.evidence()})
    t0 = time.monotonic()
    provider.last_response = {}
    transcript = provider.generate(
        context.prompt, system=context.system, model=model, timeout_s=timeout_s, max_tokens=max_tokens,
    )
    duration = time.monotonic() - t0
    written = []
    output_errors = []
    try:
        blocks = extract_file_blocks(transcript, strict=True)
        for rel in blocks:
            if not _can_write(rel, _write_scope(spec["task"])):
                raise EvidenceError(f"response file is outside task.allowed_writes: {rel}")
            resolve_inside(workspace, rel, missing=True)
        for rel, content in blocks.items():
            _write_file(workspace, rel, content)
            written.append(rel)
    except (OSError, EvidenceError) as exc:
        output_errors.append(str(exc))
    metadata.update(getattr(provider, "last_response", {}))
    metadata.update({"files_written": sorted(written), "output_errors": output_errors,
                     "transcript_sha256": sha256(transcript)})
    return AgentResult(
        transcript=transcript, exit_ok=not output_errors and metadata.get("completed", True),
        duration_s=duration, model=model, meta=metadata,
    )


# ─────────────────────────────────────────────────────────────────────────────
# LLM judge (rubric scoring) — also goes through the provider gateway
# ─────────────────────────────────────────────────────────────────────────────

JUDGE_SYSTEM_PROMPT = (
    "You are a strict, impartial evaluation judge. Score each criterion from "
    "0.0 (not met at all) to 1.0 (fully met) based ONLY on the evidence in the "
    "transcript. Respond with ONLY a JSON object mapping each criterion id to "
    "its score — no prose, no markdown fences."
)

MAX_JUDGE_TRANSCRIPT_CHARS = 24000


def judge_rubric(spec: dict, result: AgentResult,
                 judge_provider: "providers.Provider") -> dict[str, float]:
    """Score spec['rubric'] against the transcript via the gateway.

    Returns {rubric_id: score in [0,1]}. Unparseable judge output -> {} (the
    rubric contributes 0 — conservative, never crashes the suite). The default
    judge is the mock provider, whose echo output parses to {}, so tests and
    CI stay deterministic and offline.
    """
    rubric = spec.get("rubric") or []
    if not rubric:
        return {}
    transcript = result.transcript
    if len(transcript) > MAX_JUDGE_TRANSCRIPT_CHARS:
        transcript = transcript[:MAX_JUDGE_TRANSCRIPT_CHARS] + "\n[truncated]"
    criteria = "\n".join(f"- {r['id']}: {r['criterion']}" for r in rubric)
    prompt = (
        f"## Criteria\n{criteria}\n\n## Transcript under evaluation\n"
        f"{transcript}\n\n"
        "Return ONLY a JSON object like {\"<criterion-id>\": <score 0.0-1.0>, ...} "
        "with one entry per criterion id listed above."
    )
    judge_provider.last_response = {}
    result.meta["judge_evidence"] = {"prompt_sha256": sha256(prompt), "system_sha256": sha256(JUDGE_SYSTEM_PROMPT),
                                     "transcript_excerpted": len(result.transcript) > MAX_JUDGE_TRANSCRIPT_CHARS}
    try:
        raw = judge_provider.generate(prompt, system=JUDGE_SYSTEM_PROMPT, timeout_s=300)
    except providers.ProviderError:
        return {}
    result.meta["judge_evidence"]["response_sha256"] = sha256(raw)
    return _parse_judge_scores(raw, [r["id"] for r in rubric])


def _parse_judge_scores(raw: str, rubric_ids: list[str]) -> dict[str, float]:
    """Extract the first JSON object from raw text; clamp scores to [0, 1]."""
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        return {}
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, float] = {}
    for rid in rubric_ids:
        v = data.get(rid)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v):
            out[rid] = min(1.0, max(0.0, float(v)))
    return out


def parse_command(command) -> list[str]:
    """Accept portable argv (preferred) and old simple commands, never a shell."""
    if isinstance(command, str):
        if any(character in command for character in ";&|`$<>\r\n"):
            raise EvidenceError("shell syntax is not allowed in assertion commands; use argv")
        try:
            command = shlex.split(command, posix=True)
        except ValueError as exc:
            raise EvidenceError(f"invalid command quoting: {exc}") from exc
    if not isinstance(command, list) or len(command) < 2 or any(
            not isinstance(token, str) or not token or "\x00" in token or "\n" in token or "\r" in token for token in command):
        raise EvidenceError("command must contain an executable and explicit script path")
    if command[0] not in ("node", "python", "python3", sys.executable):
        raise EvidenceError("assertion executable must be node or the current Python interpreter")
    cursor = 1
    while cursor < len(command) and command[cursor].startswith("-"):
        if command[0] != "node" or command[cursor] not in ("--test", "--check"):
            raise EvidenceError("inline code, arbitrary runtime flags and module execution are not allowed")
        cursor += 1
    if cursor == len(command):
        raise EvidenceError("assertion command requires an explicit script")
    script = command[cursor]
    suffixes = (".js", ".cjs", ".mjs") if command[0] == "node" else (".py",)
    if not script.endswith(suffixes):
        raise EvidenceError("assertion command requires an explicit Node/Python script")
    for token in command[cursor:]:
        if token.startswith("{workspace}") or token.startswith("{checks}"):
            _, _, relative = token.partition("}")
            if relative and (not relative.startswith("/") or not safe_relative(relative[1:])):
                raise EvidenceError(f"unsafe command root expansion: {token!r}")
        elif "{" in token or "}" in token or "\\" in token or ":" in token or token.startswith("/") or ".." in token.split("/"):
            raise EvidenceError(f"unsafe command argument: {token!r}")
    return list(command)


def _command_input(command, workspace: Path, cwd: Path, checks_root: Path | None):
    argv = parse_command(command)
    script_index = next(i for i in range(1, len(argv)) if not argv[i].startswith("-"))
    executable = shutil.which("node") if argv[0] == "node" else sys.executable
    if not executable:
        raise EvidenceError("assertion executable is unavailable: node")
    argv[0] = str(Path(executable).resolve())
    script_record = None
    for i in range(script_index, len(argv)):
        token = argv[i]
        root = cwd
        if token.startswith("{checks}"):
            if checks_root is None:
                raise EvidenceError("assertion requires an explicit checks_root")
            root = explicit_root(checks_root)
            token = token[len("{checks}"):].removeprefix("/")
        elif token.startswith("{workspace}"):
            root = workspace
            token = token[len("{workspace}"):].removeprefix("/")
        elif i != script_index:
            # Literal script arguments are data, passed unchanged without a shell.
            continue
        if not token:
            if i == script_index:
                raise EvidenceError("assertion script cannot be a directory")
            argv[i] = str(root)
        else:
            target = resolve_inside(root, token, kind="file" if i == script_index else "any")
            argv[i] = str(target)
            if i == script_index:
                script_record = read_record(root, token).evidence()
                script_record["root"] = "checks" if checks_root and root == explicit_root(checks_root) else "workspace"
    return argv, script_record


def _changed_files(before, after) -> list[str]:
    old = {record.path: record.sha256 for record in before}
    new = {record.path: record.sha256 for record in after}
    return sorted(path for path in old.keys() | new.keys() if old.get(path) != new.get(path))


def check_environment() -> dict:
    """Do not pass provider credentials or interpreter preload hooks to checks."""
    allowed = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR"}
    if os.name == "nt":
        allowed.update({"HOMEDRIVE", "HOMEPATH", "LOGONSERVER", "SYSTEMDRIVE", "USERDOMAIN", "USERNAME", "USERPROFILE"})
    values = {key.upper(): value for key, value in sorted(os.environ.items()) if key.upper() in allowed}
    values.update({"LANG": "C", "LC_ALL": "C", "TZ": "UTC", "PYTHONNOUSERSITE": "1",
                   "PYTHONSAFEPATH": "1", "PYTHONDONTWRITEBYTECODE": "1", "NODE_V8_COVERAGE": ""})
    return {"policy": "minimal-local-v1", "values": values, "sha256": object_hash(values)}


def evaluate_assertions(spec: dict, workspace: Path, result: AgentResult, *,
                        checks_root: Path | None = None) -> list[dict]:
    """Evaluate every assertion against the post-run workspace + transcript."""
    out = []
    for i, a in enumerate(spec["assertions"]):
        kind = a["kind"]
        aid = a.get("id", f"assertion-{i}")
        weight = float(a.get("weight", 1))
        critical = a.get("critical", True)
        passed, detail = False, ""
        evidence = {"transcript_sha256": sha256(result.transcript)}
        started = time.monotonic()
        try:
            if kind == "file_exists":
                evidence["file"] = read_record(workspace, a["path"]).evidence()
                passed = True
                detail = "" if passed else f"missing file: {a['path']}"
            elif kind == "contains":
                record = read_record(workspace, a["path"])
                evidence["file"] = record.evidence()
                passed = re.search(a["pattern"], record.content) is not None
                detail = "" if passed else f"pattern {a['pattern']!r} not found in {a['path']}"
            elif kind == "command_succeeds":
                cwd = resolve_inside(workspace, a.get("cwd", "."), kind="directory")
                argv, script_record = _command_input(a["command"], workspace, cwd, checks_root)
                before = snapshot(workspace)
                checks_before = snapshot(checks_root) if checks_root else ()
                timeout_s = a.get("timeout_s", 300)
                if type(timeout_s) is not int or not 0 < timeout_s <= 900:
                    raise EvidenceError("assertion timeout must be an integer in [1, 900]")
                evidence.update({"command": argv, "command_sha256": object_hash(a["command"]),
                                 "cwd": a.get("cwd", "."), "script": script_record,
                                 "timeout_s": timeout_s, "before": manifest(before),
                                 "checks_before": manifest(checks_before)})
                environment = check_environment()
                evidence["environment"] = environment
                capture = capture_command(argv, cwd=cwd, env=environment["values"], timeout_s=timeout_s)
                if capture["capture_failure"] is not None:
                    critical = True  # incomplete collection cannot become a diagnostic-only pass
                after = snapshot(workspace)
                checks_after = snapshot(checks_root) if checks_root else ()
                evidence.update({**capture, "after": manifest(after), "checks_after": manifest(checks_after)})
                passed = (capture["exit_code"] == 0 and capture["capture_failure"] is None
                          and capture["output_capture_complete"] and capture["direct_child_reaped"])
                detail = "" if passed else (
                    f"{capture['capture_failure'] or 'command failure'}; exit {capture['exit_code']}: "
                    f"{(capture.get('stderr') or capture.get('stdout') or '')[-500:]}"
                )
                if _changed_files(before, after) or _changed_files(checks_before, checks_after):
                    passed, detail = False, "assertion mutated workspace or held-out checks; evidence is not reusable"
            elif kind == "must_flag":
                passed = re.search(a["pattern"], result.transcript) is not None
                detail = "" if passed else f"transcript never matched {a['pattern']!r}"
            elif kind == "must_not_flag":
                m = re.search(a["pattern"], result.transcript)
                passed = m is None
                detail = "" if passed else f"transcript matched forbidden {a['pattern']!r}: {m.group(0)[:120]!r}"
        except Exception as exc:  # assertion machinery must never crash the suite
            passed, detail = False, f"assertion error: {exc}"
            if isinstance(exc, subprocess.TimeoutExpired):
                evidence.update({"exit_code": None, "timed_out": True,
                                 "stdout_sha256": sha256(exc.stdout or b""),
                                 "stderr_sha256": sha256(exc.stderr or b"")})
        out.append({"id": aid, "kind": kind, "weight": weight, "passed": passed, "detail": detail,
                    "critical": critical, "evidence": evidence,
                    "duration_s": time.monotonic() - started})
    return out


def score_run(spec: dict, assertion_results: list[dict], rubric_scores: dict | None = None) -> float:
    """Weighted score per evals/schema.md#scoring. rubric_scores: {rubric_id: 0..1}."""
    w = spec["scoring"]["weights"]
    total_aw = sum(r["weight"] for r in assertion_results) or 1.0
    assertion_score = sum(r["weight"] for r in assertion_results if r["passed"]) / total_aw
    rubric = spec.get("rubric") or []
    if rubric and rubric_scores:
        total_rw = sum(float(r.get("weight", 1)) for r in rubric) or 1.0
        rubric_score = sum(float(r.get("weight", 1)) * float(rubric_scores.get(r["id"], 0.0)) for r in rubric) / total_rw
    else:
        rubric_score = 0.0
    return w["assertions"] * assertion_score + w["rubric"] * rubric_score


def score_external_run(spec_path: Path, spec: dict, workspace: Path, result: AgentResult, *,
                       context: PreparedContext, attempt_id: str, checks_root: Path | None = None,
                       rubric_scores: dict | None = None) -> SpecReport:
    """Score a host-owned attempt; this API does not launch or authenticate hosts.

    The caller owns the attempt ledger, its sealed context/checks, host handle,
    transcript collection and lifecycle. A digest detects drift, not forgery by
    somebody who can rewrite the ledger. Held-out code remains outside inputs.
    """
    started = time.monotonic()
    evidence = {"attempt_id": attempt_id, "task_id": spec.get("id"),
                "observed_at": datetime.now(timezone.utc).isoformat()}
    try:
        verify_context(context)
        if not isinstance(attempt_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", attempt_id):
            raise EvidenceError("attempt_id must be an explicit stable identifier")
        if context.spec_sha256 != object_hash(spec):
            raise EvidenceError("spec differs from the prepared acceptance declaration")
        workspace = explicit_root(workspace)
        if workspace != explicit_root(Path(context.workspace_root)):
            raise EvidenceError("result workspace differs from the prepared attempt root")
        if result.meta.get("execution_mode") != context.execution_mode:
            raise EvidenceError("reported execution mode differs from prepared inputs")
        if result.meta.get("attempt_id", attempt_id) != attempt_id:
            raise EvidenceError("result belongs to a different attempt")
        if not isinstance(result.transcript, str) or len(result.transcript.encode("utf-8")) > MAX_TOTAL_BYTES:
            raise EvidenceError("transcript must be bounded UTF-8 text")
        if rubric_scores is not None and (not isinstance(rubric_scores, dict) or any(
                type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1
                for value in rubric_scores.values())):
            raise EvidenceError("rubric scores must be finite numbers in [0, 1]")
        before_checks = snapshot(workspace)
        held_out_before = snapshot(checks_root) if checks_root else ()
        changed = _changed_files(context.fixture_files, before_checks)
        scope = _write_scope(spec["task"])
        violations = [path for path in changed if not _can_write(path, scope)]
        keys = ("provider", "model_alias", "concrete_model", "effective_settings", "usage", "cost",
                "host_handle", "host_outcome", "duration_basis", "response_id", "response_model",
                "stop_reason", "replay", "output_errors")
        execution = {key: result.meta.get(key) for key in keys}
        execution.update({"mode": context.execution_mode, "exit_ok": result.exit_ok is True,
                          "duration_s": result.duration_s, "model_alias": result.model or result.meta.get("model_alias")})
        evidence.update({"context": context.evidence(), "execution": execution,
                         "provider_inputs": {"system": context.system, "prompt": context.prompt},
                         "transcript": result.transcript, "transcript_sha256": sha256(result.transcript),
                         "result_revision": revision(workspace), "before_checks": manifest(before_checks),
                         "changed_files": changed,
                         "outputs": [{**record.evidence(), "content": record.content} for record in before_checks if record.path in changed],
                         "deleted_files": [record.path for record in context.fixture_files
                                           if record.path not in {entry.path for entry in before_checks}],
                         "rubric_scores": rubric_scores or {}})
        assertion_results = evaluate_assertions(spec, workspace, result, checks_root=checks_root)
        after_checks = snapshot(workspace)
        held_out_after = snapshot(checks_root) if checks_root else ()
        evidence["after_checks"] = manifest(after_checks)
        evidence["held_out_checks"] = {"before": manifest(held_out_before), "after": manifest(held_out_after)}
        if manifest(before_checks) != manifest(after_checks):
            violations.append("assertion commands changed the result workspace")
        if manifest(held_out_before) != manifest(held_out_after):
            violations.append("assertion commands changed held-out checks")
        if violations:
            assertion_results.append({"id": "write-scope", "kind": "write_scope", "weight": 0.0,
                                      "passed": False, "critical": True, "detail": "; ".join(violations)})
        score = score_run(spec, assertion_results, rubric_scores)
        critical_pass = all(entry["passed"] for entry in assertion_results if entry.get("critical", True))
        accepted = result.exit_ok is True and critical_pass and score >= spec["scoring"]["pass_threshold"]
        evidence["acceptance"] = {"execution_ok": result.exit_ok is True, "critical_checks_pass": critical_pass,
                                  "threshold_met": score >= spec["scoring"]["pass_threshold"], "accepted": accepted}
        errors = [f"{entry['id']}: {entry['detail']}" for entry in assertion_results if not entry["passed"]]
        if result.exit_ok is not True:
            errors.insert(0, "agent execution did not complete successfully")
        return SpecReport(spec["id"], str(spec_path), "pass" if accepted else "fail", errors,
                          score, assertion_results, time.monotonic() - started, evidence)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        return SpecReport(spec.get("id", "?"), str(spec_path), "error", [str(exc)],
                          duration_s=time.monotonic() - started, evidence=evidence)


def run_eval(spec_path: Path, spec: dict, model: str,
             provider: "providers.Provider | None" = None,
             judge_provider: "providers.Provider | None" = None, *,
             checks_root: Path | None = None) -> SpecReport:
    """Single-response pipeline for one spec, with explicit mock/live evidence.

    ``provider`` runs the agent; ``judge_provider`` scores the rubric (only
    consulted when scoring.weights.rubric > 0). Both default via
    ``providers.get_provider()`` -> $BMAD_EVAL_PROVIDER -> mock (offline).
    """
    t0 = time.monotonic()
    workspace = None
    attempt_id = uuid.uuid4().hex
    context = None
    try:
        workspace = materialize_fixture(spec_path, spec)
        if checks_root is None and any(
                a["kind"] == "command_succeeds" and any(token.startswith("{checks}") for token in parse_command(a["command"]))
                for a in spec["assertions"]):
            checks_root = resolve_inside(spec_path.parent, "checks", kind="directory")
        prepared_checks = manifest(snapshot(checks_root)) if checks_root else None
        provider = provider or providers.get_provider()
        context = prepare_agent_context(spec, workspace, execution_mode="mock" if provider.name == "mock" else "rendered-response")
        result = run_agent(spec, model, workspace, provider=provider, context=context, attempt_id=attempt_id)
        if checks_root and manifest(snapshot(checks_root)) != prepared_checks:
            raise EvidenceError("held-out checks changed during provider execution")
        rubric_scores: dict[str, float] = {}
        weights = spec["scoring"]["weights"]
        if weights.get("rubric", 0) > 0 and (spec.get("rubric") or []):
            judge = judge_provider or providers.get_provider(
                os.environ.get("BMAD_EVAL_JUDGE_PROVIDER") or None
            )
            rubric_scores = judge_rubric(spec, result, judge)
        report = score_external_run(spec_path, spec, workspace, result, context=context,
                                    attempt_id=attempt_id, rubric_scores=rubric_scores, checks_root=checks_root)
        report.evidence["prepared_checks"] = prepared_checks
        if weights.get("rubric", 0) > 0 and (spec.get("rubric") or []):
            report.evidence["judge"] = judge.describe_call(timeout_s=300)
            report.evidence["judge"].update(getattr(judge, "last_response", {}))
            report.evidence["judge"].update(result.meta.get("judge_evidence", {}))
            report.evidence["judge"]["independence_verified"] = False
        report.duration_s = time.monotonic() - t0
        return report
    except (NotImplementedError, providers.ProviderError, OSError, ValueError, TypeError) as exc:
        return SpecReport(spec["id"], str(spec_path), "error", [str(exc)],
                          None, [], time.monotonic() - t0,
                          {"attempt_id": attempt_id, "task_id": spec["id"],
                           "context": context.evidence() if context else None,
                           "execution": provider.describe_call(
                               model, timeout_s=spec.get("task", {}).get("timeout_s", 900),
                               max_tokens=spec.get("task", {}).get("max_tokens", providers.DEFAULT_MAX_TOKENS),
                           ) if provider else {"provider": None, "model_alias": model},
                           "execution_mode": "mock" if provider and provider.name == "mock" else "rendered-response"})
    finally:
        if workspace and workspace.name.startswith("bmad-eval-") and workspace.parent.resolve() == Path(tempfile.gettempdir()).resolve():
            shutil.rmtree(workspace, ignore_errors=True)


# ─────────────────────────────────────────────────────────────────────────────
# Self-check (CI mode today — no model calls)
# ─────────────────────────────────────────────────────────────────────────────

def self_check_spec(spec_path: Path) -> SpecReport:
    """Validate one spec: YAML parse, schema, fixture materialization."""
    t0 = time.monotonic()
    rel = str(spec_path.relative_to(REPO_ROOT))
    try:
        spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        return SpecReport("?", rel, "error", [f"YAML parse error: {exc}"], duration_s=time.monotonic() - t0)

    errors = validate_spec(spec, spec_path)
    spec_id = spec.get("id", "?") if isinstance(spec, dict) else "?"
    if not errors:
        workspace = None
        try:
            workspace = materialize_fixture(spec_path, spec)
            n_files = sum(1 for p in workspace.rglob("*") if p.is_file())
            if n_files == 0:
                errors.append("fixture materialized to an empty workspace")
            prepare_agent_context(spec, workspace, execution_mode="mock")
        except (OSError, ValueError) as exc:
            errors.append(f"fixture materialization failed: {exc}")
        finally:
            if workspace:
                shutil.rmtree(workspace, ignore_errors=True)
    status = "pass" if not errors else "fail"
    return SpecReport(spec_id, rel, status, errors, duration_s=time.monotonic() - t0,
                      evidence={"execution_mode": "self-check", "executed": False,
                                "behavior_measured": False})


# ─────────────────────────────────────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────────────────────────────────────

def to_json_summary(reports: list[SpecReport], mode: str, provider: str | None = None) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "provider": provider,
        "behavior_measured": mode != "self-check" and provider != "mock",
        "total": len(reports),
        "passed": sum(1 for r in reports if r.status == "pass"),
        "failed": sum(1 for r in reports if r.status != "pass"),
        "specs": [
            {
                "id": r.spec_id, "path": r.path, "status": r.status,
                "score": r.score, "errors": r.errors,
                "assertions": r.assertion_results, "duration_s": round(r.duration_s, 3),
                "evidence": r.evidence,
            }
            for r in reports
        ],
    }


def to_junit_xml(reports: list[SpecReport], mode: str) -> str:
    suite = ET.Element("testsuite", {
        "name": f"bmad-evals-{mode}",
        "tests": str(len(reports)),
        "failures": str(sum(1 for r in reports if r.status == "fail")),
        "errors": str(sum(1 for r in reports if r.status == "error")),
        "time": f"{sum(r.duration_s for r in reports):.3f}",
    })
    for r in reports:
        case = ET.SubElement(suite, "testcase", {
            "classname": r.spec_id.split("/")[0] if "/" in r.spec_id else "evals",
            "name": r.spec_id, "time": f"{r.duration_s:.3f}",
        })
        if r.status != "pass":
            tag = "failure" if r.status == "fail" else "error"
            el = ET.SubElement(case, tag, {"message": f"{len(r.errors)} problem(s)"})
            el.text = "\n".join(r.errors)
    ET.indent(suite)
    return ET.tostring(suite, encoding="unicode", xml_declaration=True)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="BMAD+ agent eval runner (Pillar 4)")
    ap.add_argument("--self-check", "--dry-run", action="store_true", dest="self_check",
                    help="validate specs + fixtures without calling any model (default mode)")
    ap.add_argument("--model", choices=SUPPORTED_MODELS,
                    help="score a rendered response (mock by default; not native tool execution)")
    ap.add_argument("--provider", choices=sorted(providers.PROVIDERS), default=None,
                    help="model backend (default: $BMAD_EVAL_PROVIDER or 'mock' — offline). "
                         "See evals/_runner/README-backend.md")
    ap.add_argument("--spec", default="", help="only specs whose id contains this substring")
    ap.add_argument("--json", metavar="PATH", help="write JSON summary here")
    ap.add_argument("--junit", metavar="PATH", help="write JUnit XML here")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    spec_paths = [p for p in discover_specs() if args.spec in "/".join(p.parent.relative_to(EVALS_ROOT).parts)]
    if not spec_paths:
        print(f"error: no specs found under {EVALS_ROOT} matching {args.spec!r}", file=sys.stderr)
        return 2

    mode = "self-check" if (args.self_check or not args.model) else f"model:{args.model}"
    provider = None
    if mode != "self-check":
        try:
            provider = providers.get_provider(args.provider)
        except providers.ProviderConfigError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2

    reports: list[SpecReport] = []
    for p in spec_paths:
        if mode == "self-check":
            reports.append(self_check_spec(p))
        else:
            spec = yaml.safe_load(p.read_text(encoding="utf-8"))
            errs = validate_spec(spec, p)
            if errs:
                reports.append(SpecReport(spec.get("id", "?"), str(p), "fail", errs))
            else:
                reports.append(run_eval(p, spec, args.model, provider=provider))

    if not args.quiet:
        for r in reports:
            mark = "OK  " if r.status == "pass" else ("FAIL" if r.status == "fail" else "ERR ")
            score = f" score={r.score:.2f}" if r.score is not None else ""
            print(f"[{mark}] {r.spec_id}{score}  ({r.path})")
            for e in r.errors:
                print(f"        - {e}")
        ok = sum(1 for r in reports if r.status == "pass")
        via = f" (provider: {provider.name})" if provider else ""
        print(f"\n{mode}{via}: {ok}/{len(reports)} specs pass")

    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        summary = to_json_summary(reports, mode, provider.name if provider else None)
        Path(args.json).write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if args.junit:
        Path(args.junit).parent.mkdir(parents=True, exist_ok=True)
        Path(args.junit).write_text(to_junit_xml(reports, mode), encoding="utf-8")

    return 0 if all(r.status == "pass" for r in reports) else 1


if __name__ == "__main__":
    sys.exit(main())
