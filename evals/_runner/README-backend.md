# Eval Backend — Provider-Neutral Model Gateway (Pillar 4)

`run.py --model <name>` scores a rendered model response. Its default provider
is the offline mock. A configured API provider receives the actual selected
agent, every explicitly required resource and the complete task/fixture snapshot.
The text response has no execution tools; the harness materializes declared file
blocks and then runs independent assertions. Native tool execution uses a separate
prepare/collect seam. These three evidence classes must not be pooled as an agent
quality score.

```
eval.yaml ──> run.py ──> run_agent() ──> providers.get_provider() ──> Provider.generate()
                              │                                          mock | anthropic | openai | http
                              └──> file blocks -> workspace -> assertions -> (judge) -> score
```

## Providers

| Name | Backend | Required env | Optional env |
|---|---|---|---|
| `mock` *(default)* | Deterministic offline echo/canned text. Used by tests, CI, `--self-check`. **No network, ever.** | — | `BMAD_EVAL_MOCK_RESPONSE_FILE` (replay a saved transcript verbatim) |
| `anthropic` | Anthropic Messages API (stdlib `urllib`, no SDK) | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` (default `claude-opus-4-8`), `ANTHROPIC_BASE_URL` |
| `openai` | OpenAI Chat Completions | `OPENAI_API_KEY`, `OPENAI_MODEL` | `OPENAI_BASE_URL` (default `https://api.openai.com/v1`) |
| `http` | Any OpenAI-compatible chat endpoint — Gemini OpenAI-compat, Ollama, vLLM, LM Studio, llama.cpp server, internal gateways | `BMAD_EVAL_HTTP_URL` | `BMAD_EVAL_HTTP_KEY`, `BMAD_EVAL_HTTP_MODEL` |

Selection order: `--provider` flag > `$BMAD_EVAL_PROVIDER` > `mock`.
A missing provider credential/endpoint fails at construction. Some model aliases
are resolved at request time; a missing concrete model then produces an error
report. No fallback provider is selected after a failure.

No vendor SDK is imported anywhere; adapters are ~40 lines of stdlib `urllib`
each, which keeps the harness dependency-free and neutral (audit rule: no
feature that works with only one vendor).

## Model aliases vs concrete model ids

Specs declare generic aliases (`models: [claude, gpt, gemini, local]`). Each
provider maps the alias to a concrete vendor model id:

1. `BMAD_EVAL_MODEL_<ALIAS>` (e.g. `BMAD_EVAL_MODEL_CLAUDE=claude-haiku-4-5`,
   `BMAD_EVAL_MODEL_GEMINI=gemini-2.5-pro`) — highest priority, works on any
   provider.
2. The provider's own default env (`ANTHROPIC_MODEL`, `OPENAI_MODEL`,
   `BMAD_EVAL_HTTP_MODEL`).
3. Provider hard default (`anthropic` only: `claude-opus-4-8`; `openai`
   requires an explicit id so the repo never ships a stale one; local `http`
   servers often ignore the field).

This keeps the multi-model upgrade-gate matrix intact: same suite, one flag
(`--model`) per run, one env var to pin the exact model id per alias.

## Usage

```bash
# Offline, deterministic — what CI runs today (unchanged)
python evals/_runner/run.py --self-check

# Offline scored run through the whole pipeline (mock provider, no network)
python evals/_runner/run.py --model claude --spec shield

# Real run against Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python evals/_runner/run.py --model claude --provider anthropic --junit out/claude.xml

# Real run against a local model via Ollama's OpenAI-compatible endpoint
export BMAD_EVAL_HTTP_URL=http://localhost:11434/v1/chat/completions
export BMAD_EVAL_HTTP_MODEL=qwen2.5-coder:32b
python evals/_runner/run.py --model local --provider http

# Gemini via its OpenAI-compat endpoint
export BMAD_EVAL_HTTP_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
export BMAD_EVAL_HTTP_KEY=$GEMINI_API_KEY
export BMAD_EVAL_HTTP_MODEL=gemini-2.5-pro
python evals/_runner/run.py --model gemini --provider http

# Replay a saved transcript through scoring (offline debugging of assertions)
export BMAD_EVAL_MOCK_RESPONSE_FILE=./saved-transcript.txt
python evals/_runner/run.py --model claude --spec shield/gdpr-ropa
```

The JSON summary (`--json`) records provider and execution mode per attempt,
concrete configured/observed model IDs where available, non-secret request
settings, complete input/resource hashes, fixture/result manifests, transcripts,
changed file contents, actual check evidence and elapsed time. API usage is the
provider's reported usage object; unknown usage and cost remain `null`. Mock and
replay results are labelled and cannot establish actual agent behavior.

## How a text model acts on the workspace

Plain-text models can't run tools, so the contract is file blocks: the agent
system prompt (`AGENT_SYSTEM_PROMPT` in `run.py`) instructs the model to emit

```
--- BEGIN FILE: relative/path.md ---
<full content>
--- END FILE ---
```

`run_agent()` prepares the selected agent and declared `agent_resources` in the
system input, and the task/fixture in the user input. Mandatory sources are exact
case-sensitive paths under the explicit source root. Missing, linked, non-UTF-8
or oversized inputs fail before the provider is called. No source is silently
replaced or truncated. Sources are bounded to 128 KiB per file/512 KiB total;
workspaces to 200 UTF-8 files/256 KiB each/2 MiB total; complete system plus prompt
and rendered transcripts to 2 MiB.

After one request, every file block is validated against the explicit workspace
and `task.allowed_writes` before writing any blocks. A bad path, duplicate file,
case mismatch or oversized output rejects execution. `file_exists` / `contains` /
`command_succeeds` assertions run against the workspace, `must_flag` /
`must_not_flag` run against the full transcript.

Commands use argv and `shell=False`, with a validated workspace cwd and explicit
Node/Python script under the workspace or supplied held-out root. They record the
script/input/output hashes and real exit code. They use an explicit minimal
environment with recorded values/hash, excluding provider credentials and Node/
Python preload hooks regardless of variable casing. Shell/inline evaluation and unsafe
paths fail. A verification command that modifies its inputs invalidates acceptance.
These checks bound the harness's operations; they do not sandbox arbitrary code
or isolate an external host's tools.

## Native-host integration API

The host launcher is independent from the single-response provider interface:

```python
context = run.prepare_agent_context(
    spec, workspace, source_root=repository,
    execution_mode="native-host", context_variant="agent",
)
saved_context = context.to_dict()  # also compatible with dataclasses.asdict
# Caller seals context/check inventories and the task packet before host launch.
# Host receives context.system and context.prompt and uses its available tools.
context = run.context_from_dict(saved_context)  # validates complete input hashes
result = run.AgentResult(
    transcript=observed_transcript,
    exit_ok=observed_success, duration_s=observed_elapsed,
    model=observed_alias or "",
    meta={"execution_mode": "native-host", "provider": "native-host",
          "host_handle": observed_host_id, "concrete_model": observed_model_id,
          "effective_settings": observed_settings, "usage": observed_usage},
)
report = run.score_external_run(
    spec_path, spec, workspace, result,
    context=context, attempt_id=owned_attempt_id, checks_root=trusted_checks,
)
```

The context is immutable. Collection rejects a changed spec, workspace binding,
execution mode or supplied attempt ID. It hashes current artifacts and executes
the declared checks; it does not treat a host's completion claim as acceptance.
Every assertion is critical by default. Failed execution, critical checks,
out-of-scope edits or changed verification inputs block acceptance regardless of
the weighted score or rubric. The caller owns host identity, lifecycle and a
protected attempt ledger; digests alone do not authenticate worker-supplied claims.

`context_variant="generic-control"` is an intentional comparison arm: the same
wrapper, task and fixture without selected-agent/resource instructions. It has its
own variant/input hash and empty source list. It is never used to recover from a
missing agent file. Keep held-out scripts outside the provider inputs and worker
write scope, seal them before launch, and compare them again before collection.
`{checks}/verify.cjs` and `{workspace}` in command arrays expand only to explicitly
supplied roots. The [spec schema](../schema.md) documents the command contract.

## LLM judge (rubric)

When a spec's `scoring.weights.rubric > 0`, `run_eval()` asks a judge provider
to score each rubric criterion 0.0–1.0 and expects a bare JSON object back.
The judge goes through the same gateway:

- `BMAD_EVAL_JUDGE_PROVIDER` selects it (e.g. run the agent on `http`/local
  but judge with `anthropic`); unset, it falls back to the same resolution as
  the agent provider — which defaults to `mock`.
- Unparseable judge output contributes `{}` (rubric scores 0). Conservative:
  a broken judge can never inflate a score, and the offline mock judge is
  deterministic — tests and CI never need a network for rubric specs.
- Reports explicitly leave judge independence unverified. The transcript-only
  rubric is secondary evidence; it cannot override a critical deterministic failure.

## Testing

```bash
python evals/_runner/test_backend.py          # stdlib unittest, offline
python -m pytest evals/_runner/
```

The offline regression suite covers selection, exact selected-agent propagation,
mandatory resources, case/escape/link/size/UTF-8 rejection, immutable input drift,
explicit control contexts, write scope, withheld check evidence, failed commands,
the completion-claim/critical-failure counterexample, failed host execution and
provider metadata. API responses are injected; no live or paid API call is made.
Symlink cases skip explicitly on hosts without permission to create a link.
`--self-check` remains structural validation, not evidence of task acceptance.

The separate `scored.py --gate pr` lane resolves per-spec authored replay files,
verifies sealed input identities, applies bounded artifacts and runs independent
checks. It never constructs a model provider, invokes a judge or imports model
scores. Its `completion-only` and `interrupted` controls must fail. See
[the gate contract](../schema.md#replay-and-registry-gate-policy).

`campaign.py` prepares a native matrix and compares every planned receipt. It
cannot launch a host or enforce its deadline itself; the orchestrator owns that
execution. `host.py prepare --campaign-id ID --repetition N` seals repetition
identity, and `host.py compare --minimum-repetitions 2 RESULTS...` rejects missing
pairs, duplicate attempts, incompatible inputs or mixed execution modes. Use the
campaign comparison for a complete experiment: it also prevents dropping a
failed or uncollected task from the declared matrix. See [campaign procedure](../campaigns/README.md).

## Adding a provider

1. Subclass `Provider` in `providers.py`, implement `generate()` (read config
   from `env` in `__init__`, raise `ProviderConfigError` if incomplete —
   never at import time, never `Date.now`-style side effects at import).
   Override `describe_call()` when concrete model/settings are available and
   record only observed response usage; never copy credentials into metadata.
2. Register it in `PROVIDERS`.
3. Add a construction fail-fast case + any parsing tests to
   `test_backend.py` (no network in tests — inject scripted responses).
4. Document its env vars in the table above.
