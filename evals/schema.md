# BMAD+ Eval Spec Schema (v1)

Golden-task specs that declare acceptance for agent tasks. The evidence class
determines whether behavior was actually measured or authored output was replayed. One spec = one
directory `evals/<agent-dir>/<task-dir>/` containing an `eval.yaml` plus a `fixture/`
workspace. The runner (`evals/_runner/run.py`) validates, executes, and scores specs;
CI gates on the results (see `evals/README.md`).

Model-agnostic by contract: the same spec runs against every entry in `models:`
(matching `targets.models_supported` in the root `registry.yaml`).

## Directory layout

```
evals/
├── schema.md                     # this file
├── README.md                     # how evals feed the Karpathy reward + gate upgrades
├── _runner/
│   └── run.py                    # validator + runner (dirs starting with "_" are not specs)
└── <agent-dir>/                  # lowercase persona/agent key: forge, shield, sentinel, ...
    └── <task-dir>/               # kebab-case task id: scaffold-api, gdpr-ropa, ...
        ├── eval.yaml             # the spec (this schema)
        └── fixture/              # seed workspace copied to a temp dir before the run
```

## Top-level fields

| Field            | Type     | Req | Description |
|------------------|----------|-----|-------------|
| `schema_version` | int      | yes | Must be `1`. |
| `id`             | string   | yes | `<agent-dir>/<task-dir>` — must match the spec's path. |
| `pack`           | string   | yes | Pack id from the registry SSOT: one of `core, osint, maker, shield, seo, memory, dev-studio, backup, animated` (mirrors `PACK_ORDER` in `tools/cli/lib/packs.js`). |
| `agent`          | string   | yes | Agent key under test (e.g. `agent-architect-dev`, `gdpr-agent`, `agent-quality`). |
| `agent_source`   | string   | yes | Exact, case-sensitive repo-relative path to the selected agent. Its complete UTF-8 bytes are loaded into the provider's system input and hashed. Missing, linked, unsafe or oversized sources fail before execution. |
| `agent_resources` | string[] | no | Ordered, explicit mandatory resource closure, relative to the same source root. Every listed file is loaded and hashed with the agent; duplicates fail. Defaults to an empty list. Authors must declare activation/workflow resources needed by the chosen task; the runner does not infer dependencies by crawling Markdown links. |
| `persona`        | string   | no  | Human persona name (Forge, Sentinel, ...). Display only. |
| `description`    | string   | yes | What this golden task proves. |
| `models`         | string[] | yes | Non-empty subset of `[claude, gpt, gemini, local]`. The suite runs once per model; regressions are per-model. |
| `fixture`        | string   | yes | Path (relative to the spec dir) of the seed workspace directory. Copied verbatim into a fresh temp workspace before the agent runs. Must exist and be non-empty. |
| `task`           | object   | yes | See [task](#task). |
| `assertions`     | object[] | yes | Non-empty. See [assertions](#assertions). Deterministic, machine-checked. |
| `rubric`         | object[] | no  | See [rubric](#rubric). LLM-as-judge criteria (skipped in `--self-check`). |
| `scoring`        | object   | yes | See [scoring](#scoring). |
| `tags`           | string[] | no  | Free-form (e.g. `karpathy:G2`, `compliance:GDPR`). Used to slice reward signals. |
| `gates`          | string[] | no  | Unique gate names from `registry.yaml`. `pr` selects the case for the scored replay gate; omission keeps historical/native-only cases outside that lane. |
| `replay`         | string   | no  | Exact task-relative replay JSON; required for a selected replay gate. No shared fallback response is used. |

## Replay and registry gate policy

`eval.suite_glob` controls discovery under `evals/`; pack identity comes from
each spec's `pack` field, not its agent directory. Directories starting `_` or `.`
are excluded. Pack IDs and supported model aliases come from the same registry.
Structured gates declare `mode` (`replay` or `native-host`), boolean `blocking`,
optional `require_all_packs`, `controls`, `minimum_repetitions` and
`require_paired_variants`. Legacy boolean declarations remain explicit policies;
they do not select or execute a model.

A replay uses `schema_version: 1`, `kind: maintainer-authored-replay`, a nonempty
`transcript`, and `files: [{path, content, sha256}]`. Paths obey the declared write
scope. `bindings` seals the exact spec bytes and complete fixture, checker and
selected agent/resource inventories. `review_note` and `sealed_at` describe the
explicit maintainer reseal. Changing any bound input fails until reviewed and
resealed; the gate never changes those bindings automatically.

Replay gate cases need zero rubric weight and an independent critical command
under `{checks}`. Successful completion prose alone cannot pass. Both
`completion-only` and `interrupted` controls are mandatory for a blocking replay
gate. The artifact scorecard labels `execution_mode: deterministic-replay`,
`behavior_measured: false`, and zero model calls. Agent instructions are loaded
and hashed, but replay is not evidence that a model followed those instructions.

The native campaign controller seals its declared task/variant/repetition matrix.
Each observation has a unique attempt and recorded repetition; absent outcomes
remain incomplete. Comparison requires identical spec, fixture, check, model and
settings identities, plus unchanged agent resources across repetitions. Unknown
model identity stays null. A repeated receipt cannot manufacture repeated support.

## task

| Field       | Type   | Req | Description |
|-------------|--------|-----|-------------|
| `prompt`    | string | yes | The exact instruction given to the agent, verbatim. It must reference only files inside the fixture workspace. |
| `timeout_s` | int    | no  | Wall-clock budget for the agent run (default 900). |
| `max_tokens` | int | no | Requested rendered-response output budget (default 8192); not a monetary-spend guarantee. Native-host limits belong to the host's declared configuration. |
| `allowed_writes` | string[] | no | Exact workspace-relative file paths or directory prefixes ending `/`. `['.']` (the compatibility default) permits the whole workspace; `[]` is read-only. Example: `['review/', 'tests/']`. The response writer rejects an out-of-scope block before writing, and the collector independently checks baseline/result file hashes. |

## assertions

Each assertion is an object with a `kind` plus kind-specific fields. Common optional
fields: `id` (stable name for reporting), `weight` (positive finite number, default
`1`), `description`, `critical` (boolean, default `true`). Failed critical checks
block acceptance independently of the weighted score. Use `critical: false` only
for a deliberately diagnostic criterion; integrity violations still block acceptance.

All `path` values are **relative to the workspace root** and may not be absolute or
contain `..` (the runner rejects escaping paths). All `pattern` values are Python/ECMA
compatible regexes (keep to the common subset), matched **case-sensitively** by default.
For case-insensitive matching, start the pattern with the inline flag group `(?i)` —
it must appear at the very start (the JS validator strips a leading `(?i...)` group
before compiling; anywhere else is a spec error).

| kind               | Fields             | Passes when |
|--------------------|--------------------|-------------|
| `file_exists`      | `path`             | The file exists in the workspace after the agent run. |
| `contains`         | `path`, `pattern`  | The file exists AND the regex matches its content. |
| `command_succeeds` | `command`, `cwd?`, `timeout_s?` | The explicit Node/Python script exits 0 without modifying the evaluated workspace or held-out checks. `command` is an argv array (preferred) or a legacy simple string parsed without a shell. `cwd` is relative to the workspace; timeout is an integer from 1 to 900 seconds (default 300). |
| `must_flag`        | `pattern`          | The regex matches the agent **transcript** (everything the agent said). Use to require that a risk/bug/gap was surfaced. |
| `must_not_flag`    | `pattern`          | The regex does NOT match the transcript. Use to catch false positives and forbidden claims ("fully compliant", "skipping tests"). |

Assertion commands accept `node` with optional `--test`/`--check`, or the current
Python interpreter (`python`, `python3`), followed by an explicit script path.
Shell syntax, inline evaluation, arbitrary executable names, runtime injection
flags and paths outside the declared roots are rejected. Legacy examples such as
`node --check src/server.js` remain supported. Use arrays for paths with spaces.

Held-out checks use an explicit root supplied by the evaluator, outside the
worker's writable workspace:

```yaml
- id: held-out-behavior
  kind: command_succeeds
  command: [node, '{checks}/verify.cjs', '{workspace}']
  critical: true
```

The check code is not included in the provider prompt. The host must seal its
inventory before launch and verify it again before collection; the assertion
engine also hashes the actual executed script and checks for mutation during
verification. Command argument arrays and validated roots are harness controls,
not an OS sandbox for the executed code. Run only trusted checks and use host
isolation where untrusted generated code requires it.

## rubric

Qualitative criteria scored 0.0–1.0 by an LLM judge (a *different* model than the one
under test) once the model-execution backend lands. Each entry:

| Field       | Type   | Req | Description |
|-------------|--------|-----|-------------|
| `id`        | string | yes | Stable criterion id. |
| `criterion` | string | yes | What the judge evaluates, phrased as a verifiable statement. |
| `weight`    | number | no  | Positive, default `1`. |

## scoring

| Field            | Type   | Req | Description |
|------------------|--------|-----|-------------|
| `pass_threshold` | number | yes | Finite number in `(0, 1]`. A pass requires successful execution, every critical check passing, and `score >= pass_threshold`. |
| `weights`        | object | yes | `{assertions: a, rubric: r}` with `a + r ≈ 1.0`. If the spec has no rubric, set `{assertions: 1.0, rubric: 0.0}`. |

Final score:

```
assertion_score = Σ(weight of passed assertions) / Σ(weight of all assertions)
rubric_score    = Σ(weight_i × judge_i)          / Σ(weight of all rubric items)   # 0 if no rubric
score           = weights.assertions × assertion_score + weights.rubric × rubric_score
accepted        = execution_ok AND all_critical_checks_pass AND score >= pass_threshold
```

The score remains available for diagnosis after rejection. A completion claim,
a task-ID mention, successful file generation or a high rubric score cannot
override a failed implementation check or unsuccessful host execution. A judge
scores only the provided transcript; the runner does not claim judge independence
or infer that tests ran from prose.

## Runner modes

```
python evals/_runner/run.py                     # default: --self-check
python evals/_runner/run.py --self-check       # validate every spec, materialize fixtures, no model calls
python evals/_runner/run.py --spec forge       # filter by id substring
python evals/_runner/run.py --json out.json --junit out.xml
python evals/_runner/run.py --model claude --provider mock  # offline scripted/replayed response; no agent-quality evidence
```

`--self-check` validates declarations, resource loading and fixture materialization;
it does not execute the task. A configured live provider runs one rendered
response with file blocks, without tool execution by the model. Native-host
execution uses the separate prepare/collect API described in
[README-backend.md](_runner/README-backend.md). Reports label these modes separately.

The optional `generic-control` preparation variant intentionally omits the selected
agent/resource text while preserving the task, fixture and tool wrapper. Its
resource list is empty and its variant and input digest differ. It is an explicit
experimental control, never a missing-resource fallback. Compare only the same
versioned task, fixture, checks, host settings and model identity; unknown values
remain unknown. One observation is not a model-quality benchmark.

## Input and evidence contract

- Agent resources: at most 128 KiB each, 512 KiB combined. Workspace: at most 200
  UTF-8 files, 256 KiB each and 2 MiB combined. Complete system/prompt inputs and
  rendered transcripts are capped at 2 MiB. Inputs fail instead of being truncated.
- Portable paths use `/`. Case mismatches, symlinks/junctions/reparse points,
  Windows drive/UNC/alternate-stream/device aliases and `..` are rejected on all
  platforms. Present invalid text/configuration is not silently replaced.
- Each executed report records a unique attempt, spec and exact provider-input
  hashes, source/resource and fixture inventories, declared/effective provider
  model/settings, execution mode, transcript and changed outputs, actual check
  commands/script hashes/exit codes/output hashes, before/after manifests, elapsed
  time and available observed usage. Unknown usage/cost stays `null`; no estimate
  is invented. Replayed mock output stays labelled `mock` with a replay marker.
- Baseline/source/result Git revisions are recorded only for actual Git roots;
  plain fixture workspaces use their byte-hash inventories and a `null` revision.
  Immutable contexts can be serialized and validated on collection. Their hashes
  detect drift; the caller must protect its attempt ledger from worker writes.

Exit codes: `0` all specs valid/passed · `1` at least one invalid/failed · `2` environment error (missing pyyaml, no specs found).

## Minimal example

```yaml
schema_version: 1
id: forge/hello
pack: core
agent: agent-architect-dev
agent_source: src/bmad-plus/agents/agent-architect-dev/SKILL.md
description: Smoke — agent creates one file.
models: [claude, local]
fixture: fixture
task:
  prompt: "Create hello.txt containing 'hello'."
assertions:
  - { kind: file_exists, path: hello.txt }
  - { kind: contains, path: hello.txt, pattern: "hello" }
scoring:
  pass_threshold: 1.0
  weights: { assertions: 1.0, rubric: 0.0 }
```
