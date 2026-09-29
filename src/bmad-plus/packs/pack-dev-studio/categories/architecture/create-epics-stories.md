---
name: bmad-create-epics-and-stories
description: Turn requirements into traceable epics and implementable stories.
---

# Create epics and stories

Read the [execution guide](../../shared/execution.md) and
[Bezalel's role](architect-agent.md).

## Inputs

At least one explicit requirements artifact. Read any supplied architecture,
UX decisions and existing backlog. Determine the intended outcome from their
contents; file names alone do not establish requirements or readiness.

## Procedure

1. Inventory the requested outcomes and constraints. Preserve existing requirement,
   epic and story identifiers. If inputs have no identifiers, assign local stable
   IDs and record their source passages so later edits remain traceable.
2. Inspect the existing backlog and implementation where available. Separate work
   already evidenced from proposed work; do not infer completion from a title or
   change a manually maintained status.
3. Group related outcomes into epics with an observable benefit and a boundary.
   Make stories small coherent increments that can be reviewed and tested.
   Necessary infrastructure work should state the capability it enables and an
   observable acceptance condition, rather than masquerading as a user journey.
4. Define each story's intent, affected behavior, requirement references,
   prerequisites, acceptance examples, exclusions and evidence needed to accept
   it. Include failure or permission cases when they belong to the behavior.
   Do not invent file paths before inspecting the relevant code.
5. Order dependencies and check for cycles. Identify external prerequisites and
   decisions that prevent a story from being actionable. Distinguish a useful
   sequence from a hard dependency; avoid making independent stories wait without
   a reason.
6. Reconcile the set with the requirements. Find omitted constraints, duplicate
   outcomes and acceptance criteria that cannot be observed. Revise the slices or
   record the unresolved issue with the affected IDs.
7. Deliver the backlog and recommend the first actionable slice. If capacity or
   delivery dates are unknown, leave scheduling uncommitted rather than inventing
   velocity or assigning people.

## Output and acceptance

Write the report for create-epics-stories with an epic overview, story records,
dependency list and coverage table:

| Requirement ID | Source | Story IDs | Acceptance evidence | Gap |
| --- | --- | --- | --- | --- |
| Use actual IDs | File and section | Existing or newly assigned IDs | Observable check | None or unresolved dependency |

Each story record includes its stable ID, outcome, scope, dependencies and
acceptance examples. Each in-scope requirement must map to a story or an explained
deferral. A story is actionable only when its essential decisions and inputs are
available. Report coverage gaps explicitly; a completed backlog is not completed
implementation.

## Continue

Compare the current inputs and backlog with the saved input ledger. Preserve IDs,
human status values and annotations. Add or revise affected stories, recording
splits, merges and superseded IDs so existing references remain understandable.
Recheck dependencies and coverage only for changes and their consequences.
