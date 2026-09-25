# BMAD+ agent evaluations

Versioned tasks and checks for actual supplied agent instructions. Reports
distinguish structural validation, deterministic mock/replay, rendered model
responses and tool-using native hosts. A passing spec validator does not establish
agent quality, and a model's completion claim cannot pass a failed critical check.

## What lives here

```
evals/
├── schema.md                    # the eval-spec format (read this first)
├── _runner/run.py               # validator + runner + JUnit/JSON reporter
├── _runner/host.py              # sealed task preparation and native-host collection
├── forge/cache-values/          # preserve falsy values through an existing caller
├── forge/stale-consumer/        # reverify a changed helper through its actual CLI
├── forge/scaffold-api/          # Forge: story-driven impl, tests green, AC ids cited
├── shield/gdpr-ropa/            # Shield GDPR agent: Art. 30 RoPA + planted-gap detection
├── sentinel/find-bug/           # Sentinel: planted bug and a correct decoy
└── sentinel/guarded-route/      # reachable bug, guarded route, red/green counterfactual
```

Each spec = `eval.yaml` (task + machine-checked `assertions` + LLM-judged `rubric`
+ `scoring`) and a `fixture/` seed workspace. Assertion kinds: `file_exists`,
`contains`, `command_succeeds`, `must_flag`, `must_not_flag` — see `schema.md`.

## Running

```bash
# Structural gate — no model calls
python evals/_runner/run.py --self-check --json evals/_runs/structural.json

# Scored, blocking PR gate — authored artifact replay, no model calls
python evals/_runner/scored.py --gate pr --json evals/_runs/scorecard.json --junit evals/_runs/scorecard.xml

# filter
python evals/_runner/run.py --spec shield

# Offline provider plumbing; this is a mock, not a model measurement
python evals/_runner/run.py --model gpt --provider mock --json evals/_out.json

# Evaluator and native-host controller regression tests; no model calls
python -m pytest evals/_runner/ -q
```

Dependency: `pyyaml` (already pinned in `mcp-server/requirements.txt`). The Jest
suite additionally cross-checks every spec against `tools/cli/lib/packs.js`
(`tests/unit/evals-specs.test.js`), so a spec referencing a nonexistent pack or
agent fails `npm test` immediately — no Python needed.

## Scored offline gate and pack coverage

`registry.yaml` supplies discovery (`eval.suite_glob`), pack/model identities and
gate policy. The PR gate selects specs declaring `gates: [pr]`, requires a scored
case for every registered pack, and rejects a missing replay. The six earlier
specs remain structurally checked; the nine cases below add deterministic scored
coverage without changing the September 9 native pilot inputs.

| Pack | Scored case | Bounded acceptance |
| --- | --- | --- |
| Core | `forge/customized-slug` | Actual caller honors handwritten identifier rules. |
| OSINT | `osint/missing-scope` | Fictional ambiguous identity and missing scope stay blocked; no enrichment. |
| Maker | `maker/scoped-agent` | Self-contained entry, capabilities, activation and write limits. |
| Shield | `shield/evidence-status` | Fictional current check, stale evidence and narrative claims stay distinct. |
| SEO | `seo/incomplete-observations` | Verified canonical finding; absent observations produce null scores. |
| Memory | `memory/current-decision` | Bilingual current decision, missing source and unresolved contradiction. |
| Dev Studio | `dev-studio/missing-acceptance` | Missing behavior blocks implementation and preserves custom state. |
| Backup | `backup/rotation-plan` | Pure deletion plan preserves unknown, duplicate and unverified backups. |
| Animated | `animated/reduced-motion` | Real caller respects reduced motion, clamping and missing frames. |

Each `replay.json` is a **maintainer-authored artifact example**, bound to the
exact selected-agent/resource, spec, fixture and checker bytes. The grader loads
the agent context, applies only allowed example outputs, and independently runs
the checks. This measures regression plumbing, not whether a model follows the
agent. A changed instruction fails the seal; it cannot retain an unexplained old
green result. After reviewing a deliberate change, explicitly reseal that case:

```sh
python evals/_runner/scored.py --seal forge/customized-slug --reason "Reviewed the changed input and artifact contract; this is still an offline fixture."
```

The gate also scores two negative controls per case: completion prose with no
artifact work, and an interrupted execution with correct artifacts. Both must
fail acceptance. The scorecard exposes case thresholds, scores, critical checks,
execution evidence, per-pack coverage and rejected controls. `behavior_measured`
is false, `model_calls` is zero, and model usage/cost stay null. Unknown packs,
stale seals, missing coverage or an accidentally accepted negative control make
the blocking gate return nonzero. Advisory gate policy remains explicit.

## Inputs and acceptance

The evaluator reads `agent_source` and explicitly declared `agent_resources`
from the selected source root, supplies their actual text to the provider, and
records SHA-256 digests. It rejects missing, linked, escaping, malformed UTF-8
and oversized inputs. Mandatory resources must be declared; it does not infer a
complete dynamic skill graph from natural-language links. Preparation includes
the complete bounded fixture and fails instead of silently truncating context.

By default every assertion is critical. Acceptance requires successful execution,
all critical checks and the score threshold. Use `critical: false` only for an
explicitly diagnostic observation. Commands use literal argument arrays without
a shell, execute current artifacts, and record actual exits, output and hashes.
Allowed write scope and unchanged verifier inputs are checked independently of
the worker's narrative. See [the schema](schema.md) and
[provider details](_runner/README-backend.md).

Reports retain attempt, source/fixture/output/check identity and available
provider metadata. Unknown model usage or cost stays unknown. Mock scores and
missing judge output are not evidence of an agent's quality. These reports do
not automatically rewrite prompts, install updates or reinforce global memory.

## Native-host comparison

The native-host controller launches no model. It prepares a task for an existing
coding assistant and independently checks the resulting workspace. Its trusted
check directory stays outside the worker's declared writable workspace. The
caller must keep the preparation digest outside worker control and use their
host's permission/isolation facilities; this harness is not an OS sandbox.

```sh
python evals/_runner/host.py prepare --spec forge/cache-values --output evals/_runs/cache-agent --variant agent
python evals/_runner/host.py prepare --spec forge/cache-values --output evals/_runs/cache-control --variant generic-control
```

For each preparation, retain `preparation_sha256` from the command result. Give
an independent host instance only the returned `task_file`, its workspace and
declared scope. Preserve its actual final transcript outside the task workspace.
The `generic-control` variant deliberately omits agent instructions while
retaining the identical task/fixture; it is never a missing-resource fallback.

```sh
python evals/_runner/host.py collect --attempt evals/_runs/cache-agent --expected-preparation DIGEST --transcript transcript.txt --host-id ACTUAL_HOST_HANDLE
python evals/_runner/host.py compare evals/_runs/cache-agent/result.json evals/_runs/cache-control/result.json
```

Use `--outcome interrupted` or `failed` when appropriate. Supply `--model-alias`
and `--concrete-model` only when known; host identity/settings are caller reports,
not attested by this controller. An exclusive `collection.json` claim is acquired
before any grading, and complete result bytes are published atomically without
replacement. Concurrent collectors cannot run the verifier twice. If collection
is interrupted, retain its claim, inspect the recorded owner and any executed
effects, and reconcile manually before another evaluation; elapsed time does not
prove that no check ran. A result can be collected once. Changed specs,
task packets, context or held-out checks reject collection. Comparison requires
matching task, fixture and check identities for both variants. Wall time includes
orchestration and queueing; it is not model latency.

The three paired pilot tasks exercise a real cache/caller correction, a stale
helper pass with a broken CLI consumer, and a review with an executable red/green
counterfactual and a guarded-path decoy. The hidden checks require behavior,
preserved scope and genuine tests. A single pair per task is a small observation,
not a statistical benchmark or proof of superiority over another model.

## How this gates model upgrades

Every spec declares supported model aliases. A configured comparison can execute
the same versioned tasks and settings for a baseline and candidate:

1. Baseline: run the full suite against the current default model, archive `summary.json`.
2. Candidate: run against the new model id (one flag: `--model`).
3. Review critical regressions, task acceptance, false positives and actual costs
   before changing a model policy. A summary score alone cannot approve an upgrade.

Current CI runs `--self-check`, the scored replay gate and Python/JavaScript
regressions, and uploads the machine scorecard/JUnit result. It does not run
paid model comparisons or native agents on every PR. Live provider calls require
an explicit model matrix and spend/time limits; no credentials or network calls
are needed for structural and controller tests.

The root Jest suite excludes `evals/`: its Node fixtures deliberately contain
bugs and use `node:test`, not Jest. Python controller tests execute their trusted
acceptance checks; generated native-run workspaces are also outside Jest discovery.

## Adding a spec

1. `mkdir -p evals/<agent-dir>/<task-id>/fixture` and write `eval.yaml` per `schema.md`.
2. Plant the ground truth in the fixture (a bug, a compliance gap, a story file) —
   make the public contract clear without giving the worker a solution or the
   held-out assertions. Put trusted native-host checks in a sibling `checks/`
   directory and use `['node', '{checks}/check.cjs', '{workspace}']` for its command.
3. `python evals/_runner/run.py --spec <task-id>` until self-check passes.
4. `npx jest tests/unit/evals-specs.test.js --coverage=false` — cross-check against packs.js.
5. For PR coverage, declare `gates: [pr]` and `replay: replay.json`, add an
   independent critical held-out command check and a bounded authored output,
   then seal it with `scored.py --seal`. Run the gate, including negative controls.

All 9 packs are in scope (`core, osint, maker, shield, seo, memory, dev-studio,
backup, animated`). Each now has a bounded scored replay case; that is not
exhaustive coverage or a live-model result for every pack. This maintainer
harness is kept in the source repository, outside the npm runtime payload.
