---
name: bmad-code-review
description: Review a scoped code change using reproducible findings and explicit evidence limits.
---

# Code review

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md). This page is the complete review procedure.

## Inputs

An explicit diff, change artifact or review request identifying the relevant
project changes. Inspect the repository with host tools. Establish a base revision,
target revision or working-tree snapshot rather than silently reviewing an
arbitrary branch. Read the intended behavior and applicable project constraints.

## Procedure

1. Define the review scope and baseline. Inventory changed paths, related callers,
   tests and requirements. Preserve existing edits and record unavailable context.
   A supplied diff may omit the surrounding behavior needed to evaluate it.
2. Review the intended behavior, invariants and relevant failure boundaries.
   Check control flow, data changes, interface compatibility and test assertions.
   Add concurrency, permissions, input validation, recovery or UX perspectives
   where the change makes them relevant.
3. Use actual independent reviewers only when the host supports them and the
   scoped work benefits from delegation. Give each a bounded question and the
   same baseline; record returned evidence. Otherwise perform sequential
   perspectives and identify them as one assistant's work. Never invent a
   teammate or treat an absent response as a clean review.
4. Test each suspected defect against the code and requirements. Seek a concrete
   triggering case and inspect counterevidence. Run a focused reproduction when
   practical and within the task. Do not alter product code during a review
   unless fixes are also authorized.
5. Triage the results. Remove duplicates, distinguish defects from preferences,
   and retain the reason when a suspicion is refuted. For a retained issue,
   provide file/line, trigger, consequence, supporting evidence, confidence and a
   proportionate fix direction. Severity follows impact and likelihood, not tone.
6. Reconcile acceptance coverage and review limitations. Record checks actually
   run, unresolved disputes and missing reviewer or environment evidence. A
   missing required review makes that coverage incomplete.
7. Deliver findings in impact order, followed by the scoped conclusion and
   evidence limits. Zero findings is valid after inspection; it means no
   actionable defect was found within that reviewed scope.

## Output and acceptance

Write the report for code-review with baseline and scope, inspected evidence,
findings, refuted suspicions, acceptance coverage and next actions. Each retained
finding must distinguish an observed defect from a supported inference. Speculation
without enough evidence belongs in open questions, not an asserted failure.

Use a disposition of findings, no-actionable-findings, or incomplete, and explain
the scope of that disposition. List partial findings even when coverage is
incomplete. A passing test suite does not establish a missing review perspective
or an untested requirement.

## Continue

Compare the current diff and input hashes with the reviewed snapshot. Preserve
prior findings and check their resolution against actual changes. Re-review
affected behavior and invalidate conclusions that relied on changed inputs;
do not rerun unchanged checks merely to refresh the report date.
