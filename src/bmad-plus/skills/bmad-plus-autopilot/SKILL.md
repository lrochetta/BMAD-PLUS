---
name: bmad-plus-autopilot
description: Launch autopilot mode — Nexus orchestrates the full pipeline from project idea to delivery with configurable checkpoints.
---

# BMAD+ Autopilot

## Overview

This skill enables full autopilot mode where the Orchestrator (Nexus) manages the entire development pipeline from a project idea to final delivery. The user provides a project concept, and Nexus sequences all agents through Discovery → Build → Ship phases with configurable checkpoints.

## How It Works

### Input
A project idea or brief description. Examples:
- "A SaaS for invoice management for SMBs"
- "Add a notification system to the existing app"
- "Refactor the authentication module to use OAuth2"

### Pipeline

Inspect the request and existing project evidence before selecting stages. Small
changes use the relevant implementation/review steps directly; missing contracts
or consequential uncertainty justify deeper planning. Preserve the task's prior
authorization and completed artifacts when adjusting the route.

For a project requiring the full pipeline:

#### Phase 1: Discovery
1. **Strategist (Analyst role)** → Brainstorming & domain research
2. **Strategist (PM role)** → Product brief
3. **Strategist (PM role)** → PRD creation
4. **Quality (UX role)** → UX design spec
5. 🔴 **CHECKPOINT** → User reviews PRD + UX spec

#### Phase 2: Build
6. **Architect-Dev (Architect role)** → Architecture document
7. 🔴 **CHECKPOINT** → User reviews architecture
8. **Orchestrator (SM role)** → Epics & stories breakdown
9. **Orchestrator (SM role)** → Sprint planning
10. **For each story (parallelizable if independent):**
    - **Architect-Dev (Dev role)** → Implement story
    - **Quality (QA role)** → Test story
    - **Quality (Recette role)** → Draft the acceptance steps for the criteria a person can observe, with the on-screen labels copied from the code and the witness each step relies on. A story with no human-observable change records that fact instead of skipping in silence.
    - If checks fail → preserve evidence, repair within the recorded task attempt limit, then verify current artifacts
    - 🟡 **NOTIFY** → Story completion status

#### Phase 3: Ship
11. **Quality (QA role)** → Full code review
12. **Quality (UX role)** → UX review
13. **Architect-Dev (Tech Writer role)** → Documentation
14. **Quality (Recette role)** → Finalize the acceptance recipe: re-run the witness queries read-only, `bmad-plus uat lint --src`, `build`, and `order` when several recipes share an environment
15. **Quality (Recette role)** → Deliver the page and tell the tester the link, the duration, the steps that write for real, and the play order
16. **Quality (Recette role)** → On results: `uat read`, classify every failure (product / recipe / data / undecided), confirm each passed writing step read-only, then `uat gate`
17. **Orchestrator (SM role)** → Retrospective
18. 🔴 **CHECKPOINT** → User reviews final deliverable, with the run quoted: figures, tester, what stays open

### Human acceptance (recette)

Read `uat` from `_bmad/config.yaml`. `advisory` (default) builds and offers the page at every
delivery and never blocks; `gate` makes the delivery checkpoint wait for `bmad-plus uat gate` to
pass; `off` produces no recipe, and the delivery report says so. The page is produced whatever
the answer will be — nothing about it waits for the tester to be available.

Failures classified `product` open a fix task carrying the run and the triage entry as resources,
and a replay step in the next version's recipe. Failures classified `recipe` amend the spec and
rebuild it — no product change, and the report says that plainly. A tick on a step that writes is
confirmed read-only before it counts; an undecided failure asks the tester and keeps the gate red.

### Checkpoint Behavior

Before starting, read `execution_mode` and `checkpoints` from `_bmad/config.yaml`. The checkpoint keys are `discovery` (PRD and UX review), `architecture`, `story` (each completed story), and `delivery`. Apply the configured behavior at each stage:

- **require_approval** (🔴 STOP): Establish whether prior user authorization covers the concrete next action. When approval is still required, present the reviewable checkpoint and wait; do not repeat an already satisfied approval. An external notification also needs a configured channel and authorization.
- **notify_only** (🟡 INFO): Report progress in the session and continue. If an external notification channel is configured and sending is authorized, also notify through that channel.
- **auto** (🟢 AUTO): Continue automatically. Log for audit trail.

### State Management

Use the Nexus agent's durable attempt protocol (`bmad-plus nexus create`,
`start`, `launch`, `inspect`, `collect`, `record`, `verify`, `accept`, `cancel`, `reconcile`, `retry`).
It persists authoritative task/attempt/evidence state under
`.bmad-plus/nexus/runs/`. Existing host tools retain their own execution. A task
with an explicit `execution` contract can instead use `launch` to run a protected
foreground command or the installed Codex CLI; follow Nexus's concrete examples.
Separate clients inspect and collect the exact attempt, then run verification.
No daemon schedules work and no Git merge is performed.

The optional `.bmad-plus/orchestrator-state.yaml` summarizes pipeline navigation:

```yaml
pipeline:
  project: "Invoice SaaS"
  started: "2026-03-17T12:00:00Z"
  current_phase: build
  current_step: 10
  status: running
  
completed_steps:
  - step: 1
    agent: strategist
    role: analyst
    output: brainstorming-report.md
    completed: "2026-03-17T12:05:00Z"
  # ...

parallel_tasks:
  - story: auth-api
    status: completed
  - story: dashboard
    status: running
```

To resume, inspect the intended durable run and the host's actual state. Reconcile
an interrupted attempt before retrying. YAML completion labels cannot establish
current acceptance, prove that a process stopped or replace verifier receipts.
There is no standalone `bmad-plus-autopilot --resume` executable.
For executable tasks, `launch --input retry.json` with `{"retry":true}` creates
a new attempt only after the old effects are reconciled and the retry budget
permits it. Keep original foreground supervisors alive while their children run.

## Invocation

```
bmad-plus-autopilot
```

Or via the Orchestrator capabilities menu: `AP`

## Error Handling

- **Test failure**: Retain actual failed checks, repair within the task's `maxAttempts` limit, and reverify the changed artifacts. A completion claim cannot pass a failing check.
- **Agent error**: Preserve partial work and its attempt identity; report what remains uncertain. Do not proceed with dependent tasks until acceptance is established.
- **Conflict in parallel execution**: Stop assigning overlapping work, inspect the owners, reconcile their attempts and preserve user changes before a new retry.
- **Lost host or interrupted verifier**: Keep the attempt unresolved until its owner and possible effects are inspected. Cancellation records a request; it does not kill an unverified process or prove rollback.
- **User timeout at checkpoint**: Keep the pipeline paused. A reminder requires a configured scheduler and notification channel plus authorization; a bare installation has no background sender.
