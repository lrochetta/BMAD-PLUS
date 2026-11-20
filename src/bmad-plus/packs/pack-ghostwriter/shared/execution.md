# Running a Ghostwriter review

## Choose how to work

In a chat, the author can request a draft, revision or review of the supplied text directly. Answer in that conversation unless the user selected a destination. With project guidance enabled, an agent can invoke the installed skill for selected prose. Loading an instruction file or preparing a brief provides no evidence that an editor saw the finished document.

For a governed delivery, the controller must identify an artifact on disk, the scope and policy that select it, and the actual producer, reviewer and attempt. Use a supported execution backend and its observed records. Host instruction adapters can describe the skill without supplying an executable backend. If the configured reviewer cannot run, report the missing observation and preserve the draft. Never turn a second persona in the writer's session into evidence of a separate reviewer.

## Prepare

1. Resolve the current request and [intake](../intake.yaml). Reuse supplied context. List any unresolved facts that constrain the assignment. Keep private voice samples in the project's authorized storage.
2. Materialize the input, source references, selected units, protected regions, policy and any approved profile versions. Bind the identifiers and content hashes actually observed to the run. Restrict output to the authorized destinations. A declared write scope does not confine an arbitrary child process.
3. Select the [workflow](catalog.json) for the request. Track each file in a batch and each section of a long piece. A file outside the selected scope stays untouched. If scope, permissions or trustworthy parsing are missing, stop at a suggested edit or an incomplete result.

## Run the selected draft through Nexus

The `agent-output-review` workflow supports an orchestrated run on one materialized draft. Install the optional Ghostwriter pack on the execution host. That host needs a working Codex CLI on its executable search path, or an absolute executable path supplied to `run` with `--codex`. The process that launches Nexus needs access to an already authorized Codex authentication location and to the configured provider. Running the two sessions uses that provider's quota. With a project policy file, set its mode to `orchestrated` before preparing the run.

From the installed project directory, prepare the draft and copy the returned run ID. Replace `RUN_ID` below with that value.

```sh
bmad-plus ghostwriter prepare --workflow agent-output-review --input draft.md --mode orchestrated --json
bmad-plus ghostwriter run RUN_ID --json
bmad-plus ghostwriter collect RUN_ID --attempt attempt-1 --json
bmad-plus ghostwriter gate RUN_ID --json
```

Open the candidate at the `output_path` in the report when the gate returns `accepted`. If the CLI reports a missing Codex executable, correct its path on the execution host and repeat `run` using the same ID. This error happens before an attempt is reserved. A gate exit code of 2 means evidence is incomplete. Read `gate.reasons` and `coverage.missing_units` to identify what is still missing.

The 0.25.0 integration tests used a protocol simulator to exercise separate editor and reviewer sessions, collection, acceptance and stale evidence. The release tests did not exercise an authenticated Codex provider. On your execution host, a completed provider run supplies its own receipts. A host assistant can also apply the editorial guidance directly in conversation. That route relies on the host and does not produce Nexus receipts.

## Produce and assess

When a project needs a persisted brief, use the existing `bmad-plus-intake` skill and a fresh project-owned answers path for the assignment. For example, the native planner accepts `bmad-plus intake plan --intake .agents/skills/pack-ghostwriter/intake.yaml --answers _bmad-output/ghostwriter/brief-001/answers.json --json`. Record explicit answers from the request or the owner. Keep the basis for an inference in the working notes. The intake records `answered`, `defaulted` or `unknown`, so do not record an inference as an explicit answer. When ready, use `bmad-plus intake render` with the same `--intake` and `--answers` values and a new `--out` brief path.

Invoke the selected working skill with the brief. Keep the source draft and materialize its proposed replacement separately. A preview, command line or generated plan is preparation only. For the reviewer, supply the exact assembled output, inputs, protected elements and applicable criteria. Record the jobs that really ran and their scope. Track unavailable model or token-usage details as unknown.

Verify mechanical preservation, compare the meaning of both versions, report evidence for factual claims when requested, and judge editorial quality in the requested language. Record material issues by passage. An alternate output may be shorter while dropping a condition. A structurally identical output may still be wrong about the world.

## Accept or recover

The controller accepts the version identified by the evidence only when all selected units and required checks have completed, its policy is satisfied and no blocking finding remains. A worker's self-report, a model score or a successful process exit cannot substitute for these conditions. Recompute current artifact/resource identities at acceptance time. Changes to a bound input, profile, policy or output invalidate the earlier evidence. Record partial or missing proof as incomplete and retain the draft for recovery.

Use the run's existing attempt bound. A revision to address findings is a new attempt with new evidence; preserve the previous record. After an interruption, reconcile the outstanding attempt and its possible writes before any retry. Reuse a current complete review when the same bound version is handed to another agent. Deliver the copy, report and necessary unresolved items to the project. Publication, repurposing private examples and external sharing require their own authorization.
