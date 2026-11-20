---
name: bmad-correct-course
description: Adapt a delivery plan to an evidenced change while preserving commitments and decisions.
---

# Correct course

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

A request or supplied artifact describing the changed requirement, discovered
constraint or delivery problem. Read the affected plan, requirements, decisions
and actual project state. Determine whether the user requested analysis, a
proposal or implementation of the adjustment.

## Procedure

1. Describe the trigger and its evidence. State the previous assumption or
   commitment and what is now different. Separate an observed constraint from a
   proposed preference change.
2. Trace impact through requirements, interfaces, stories, tests, deployment and
   completed work as applicable. Identify unaffected work that can continue and
   preserve existing manual statuses.
3. Consider realistic responses, including a small correction, a changed sequence
   or an explicit scope revision. Compare behavior, compatibility, dependencies,
   recovery and effort uncertainty. Avoid inventing estimates or alternatives
   that cannot satisfy the user's goal.
4. Recommend an option and state the decisions or authorization still needed.
   Existing user authorization covers work within that scope; do not introduce
   a new approval ritual. When only a proposal was requested, prepare the concrete
   changes and their consequences without silently applying them.
5. For an authorized adjustment, update only the affected artifacts and code.
   Preserve requirement/story IDs where possible; record replacements and
   superseded decisions. Reconcile the plan with ongoing or already delivered
   work rather than resetting it.
6. Validate the revised dependency order, acceptance criteria and compatibility.
   Run the checks appropriate to any implementation change. Record open risks,
   external prerequisites and a recovery path for consequential state changes.

## Output and acceptance

Write the report for correct-course with trigger, previous assumptions, impact
map, options considered, selected or proposed decision, artifact changes and
verification evidence.

The adjustment is complete when its authorized changes are consistent and
reviewable, affected commitments are explicit, and required checks have evidence.
A proposal remains a proposal until the relevant decision is established.
Unresolved effects should identify the exact dependent work they prevent.

## Continue

Compare the trigger and affected artifacts with current state. Preserve decisions
already acted on and inspect whether their assumptions still hold. Resume at the
first unresolved impact or unapplied authorized change; never reapply a migration
or reverse human work from a stale plan.
