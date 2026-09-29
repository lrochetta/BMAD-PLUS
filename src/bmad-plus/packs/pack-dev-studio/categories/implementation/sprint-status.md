---
name: bmad-sprint-status
description: Report actual sprint progress, evidence gaps and the next useful action.
---

# Sprint status

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

An explicit sprint or backlog artifact, or a request identifying the project and
sprint to inspect. Read the actual ledger, relevant stories and available delivery
evidence. Report the absence of a ledger rather than inventing a sprint.

## Procedure

1. Establish the reporting scope, source revision and observation time. Read
   current tracking files while preserving their exact status vocabulary and
   human notes.
2. Inventory work by stable ID. Count items by their reported statuses and
   distinguish committed scope, carryover, newly added work and deferred work
   where the source supports those distinctions.
3. Inspect relevant acceptance reports, checks or code evidence for material
   completion claims. Note contradictions such as a done status with a failing
   required check, or an old blocker whose dependency now has evidence.
4. Identify dependency bottlenecks, stale evidence and unknown ownership or
   capacity. State how each affects the next action; do not turn missing estimates
   into an invented delivery date.
5. Recommend the next actionable item or the smallest step to remove a blocker.
   Keep source status and assessed evidence in separate columns. A read-only
   status request does not authorize rewriting the ledger.
6. Produce a concise report with source-backed counts and evidence limits.
   Explain what cannot be concluded from the available artifacts.

## Output and acceptance

Write the report for sprint-status with scope, source timestamps or hashes,
status counts, exceptions and next actions.

| Item | Reported status | Evidence inspected | Assessment | Next action |
| --- | --- | --- | --- | --- |
| Actual ID | Preserve source value | Specific artifact or check | Supported, contradicted or unknown | Bounded action |

Counts must reconcile with the inspected item set. Unknown work is not completed,
and an uninspected check is not passed. Clearly label a partial snapshot when
some tracking sources are unavailable.

## Continue

Reload tracking sources and compare them with the prior report. Recompute changed
items and dependency consequences. Preserve the old observation as history when
useful; never overwrite manually maintained states just to align them with the
assistant's assessment.
