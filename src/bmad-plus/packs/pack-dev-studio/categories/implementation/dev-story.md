---
name: bmad-dev-story
description: Implement a supplied story and verify its acceptance criteria against actual behavior.
---

# Develop a story

Read the [execution guide](../../shared/execution.md),
[Oholiab's role](dev-agent.md) and the
[delivery checklist](dev-story-checklist.md).

## Inputs

An explicit story artifact with the intended outcome and acceptance criteria.
Read its referenced project artifacts and the relevant code. A title, a status
flag or a prepared context bundle is not sufficient implementation context.

## Procedure

1. Read the entire story and project instructions. Record the input hash,
   acceptance IDs, selected scope and essential unresolved prerequisites. Reconcile
   the story with the actual code before implementing an outdated plan.
2. Inspect the working tree and affected files. Record the starting revision and
   relevant existing edits so later changes can be attributed correctly. Preserve
   unrelated work; do not reset files or mark another person's tasks complete.
3. Establish the implementation approach and verification plan. Map each criterion
   to a check. Run a focused baseline when needed to distinguish an existing
   failure from a regression, recording actual commands and outcomes.
4. Implement a coherent slice using existing patterns. For behavior needing a
   regression test, first demonstrate the defect or missing behavior with a
   meaningful failing check when practical, then make it pass. Avoid speculative
   abstractions and tests that merely mirror the implementation.
5. Exercise the relevant acceptance checks. Run required project checks, test
   affected interfaces and review the diff for unintended changes. If a check
   fails, inspect the cause and fix task-related defects before repeating it.
   Explain independent failures and unavailable capabilities precisely.
6. Apply the delivery checklist using evidence, not memory. Reconcile every
   acceptance criterion with passed, failed, skipped or unavailable checks. A
   review required by the project remains incomplete until actually performed.
7. Update only authorized story tracking fields and write the delivery report.
   Keep manual statuses unless a supported transition is within scope. Report
   implemented and verified outcomes separately; missing required evidence
   prevents a completed-acceptance claim.

## Output and acceptance

Deliver code changes and the report for dev-story. Include the baseline, input
ledger, changed files, task completion, decisions and an acceptance matrix:

| Criterion | Implementation | Check and observed result | Evidence status |
| --- | --- | --- | --- |
| Actual acceptance ID | File and relevant behavior | Command, test or review with result | Passed, failed, skipped, unavailable or awaiting human recette |

A criterion a person must confirm on screen stays **awaiting human recette** until a run
establishes it (`bmad-plus uat`). It never becomes passed on the implementer's word, and the
observed result then cites the run and its tester.

Include remaining risks and the next action. Do not stage, commit, publish or
change production merely because local implementation is finished; follow the
authorization already established for those actions.

## Continue

Re-read the story, report and working tree. Compare hashes and the baseline to
current state before reusing task completion. Inspect interrupted edits; do not
repeat migrations or external actions from the report. Resume at the earliest
unfinished task and rerun only checks whose evidence was invalidated.
