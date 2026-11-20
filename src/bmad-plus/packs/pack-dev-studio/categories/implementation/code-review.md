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

1. Define the review scope and baseline. When the BMAD+ CLI is available, seal it:
   `bmad-plus review scope <id> --base <ref>` (or `--workspace` for uncommitted
   work) writes `_bmad-output/review/<id>/scope.json` with every selected file,
   every excluded file and its reason (secret, binary, deleted, generated), and
   ordered review units. Never read or quote an excluded secret file. Choose the
   depth with `--effort low|medium|high` (one pass without refutation; two passes
   with refutation, the default; three passes) and follow the `plan` the scope
   prints: survey the whole change before reading when it says `planFirst`, and
   review units in parallel when it says `parallelUnits`. Read `checklist.md`
   beside the scope: it holds, once each, the review rules that apply to the
   selected paths — built-in rules by language and file kind, plus the project's
   own from `_bmad/review-rules.yaml`, which can add, replace or disable rules.
   `bmad-plus review rules <path>` shows which rules a file gets. Each unit
   lists its rule groups (`code`, `data`, `delivery` or the project's own):
   parallel reviewers may split a unit by group. Inventory
   related callers, tests and requirements. Preserve existing edits and record
   unavailable context. A supplied diff may omit the surrounding behavior needed
   to evaluate it.
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
   and retain the reason when a suspicion is refuted. Keep a finding by default:
   deleting a real defect costs more than keeping a doubtful one. Refute it only
   on a citable ground — (A) the construct it describes is absent from the file,
   quoted from the file; (B) the claim contradicts the code, the named guard or
   caller quoted; (C) it is a duplicate, the surviving entry named. Write the
   analysis before the disposition. A finding on security, data loss or money
   that meets none of these grounds stays unresolved, never refuted by judgment.
   Doubt and taste are not grounds. For a retained issue,
   provide file/line, trigger, consequence, supporting evidence, confidence and a
   proportionate fix direction. Severity follows impact and likelihood, not tone.
6. Reconcile acceptance coverage and review limitations. Record checks actually
   run, unresolved disputes and missing reviewer or environment evidence. A
   missing required review makes that coverage incomplete.
7. Deliver findings in impact order, followed by the scoped conclusion and
   evidence limits. Zero findings is valid after inspection; it means no
   actionable defect was found within that reviewed scope.
8. With a sealed scope, record the evidence the CLI can check, in the same folder:
   `findings.json` (`bmad-plus/review-findings/1`: every finding, refuted ones
   included, each quoting `existing_code` verbatim from the file — never a line
   number) and `coverage.json` (`bmad-plus/review-coverage/1`: every selected file
   as completed, failed or waived with a reason). Run `bmad-plus review anchor <id>`
   and requote any finding it reports ambiguous or unlocated; then
   `bmad-plus review gate <id>`. Report its disposition as it is: `incomplete`
   when a selected file is unaccounted for or a finding is not anchored, `findings`
   or `clean` otherwise. `clean` covers the reviewed scope only. A finding that
   applies a checklist rule names it in `rule`; the CLI refuses a rule that does
   not apply to that path. A finding that breaks a compliance control lists it in
   `controls`, chosen among the controls `scope.json` records for that file; the
   CLI refuses any other and carries them into the check result. The anchored record replaces credential-like values
   quoted in a finding with `[REDACTED]` and counts them. Record the session in
   `coverage.json` under `run`: `stop` (`completed`, `budget`, `time-limit`,
   `failure-streak` or `interrupted`, with a `detail` unless completed), the
   `passes` actually run, every unit attempt in order (`unit`, the rule `group`
   when reviewers split by group, `completed` or `failed` with a reason), and
   tokens or duration only when the host reports them — never estimate them.
   After three failed attempts in a row on the same unit or group, stop
   retrying it: mark its files failed. A stopped review is never clean. In CI,
   `bmad-plus review gate <id> --emit-check <file.json>` also writes the verdict
   as a check result (`bmad-plus/review-check/1`, with a GitHub check-runs
   payload); the exit code stays the verdict.
9. On a second review of the same work, compare it with the earlier one:
   `bmad-plus review compare <id> --since <earlier-id>` writes `compare.json`
   with each finding new, persisting, refuted, resolved or not reviewed. An
   earlier finding counts as resolved only when this review completed its file;
   otherwise it is not reviewed, never fixed. Renamed files are followed.

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

With a sealed scope, run `bmad-plus review continue <id>` first. When the code,
its head ref or the review rules moved, it refuses: seal a new scope and compare
it with this one (step 9) instead of continuing. Otherwise `continue.json` lists
the units, files and rule groups still owed, the files abandoned after three
failures (they stay failed), the findings to requote and the passes left; add to
the same `coverage.json` and `findings.json` and record the new `run.stop`.

Without a sealed scope, compare the current diff and input hashes with the
reviewed snapshot. Preserve prior findings and check their resolution against actual changes. Re-review
affected behavior and invalidate conclusions that relied on changed inputs;
do not rerun unchanged checks merely to refresh the report date.
