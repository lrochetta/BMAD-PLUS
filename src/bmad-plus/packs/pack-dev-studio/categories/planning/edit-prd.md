---
name: bmad-edit-prd
description: Apply a scoped change to an existing PRD while preserving requirement identity and decision history.
---

# Edit PRD

Load the [execution guide](../../shared/execution.md) and
[Yosef](pm-agent.md). Reconcile an existing requirements document with a real
change signal. This is a maintained route.

## Inputs

Require the actual target PRD and a described change: new evidence, changed
behavior, corrected finding or revised constraint. Read available related briefs,
review findings and decisions. If the intended change remains ambiguous, inspect
the document and identify the specific decision needed before editing that part.

## Procedure

1. Establish the current document revision and local user edits. Read the whole
   relevant PRD, including assumptions, exclusions and existing decision notes.
   Keep an inspectable before-state through the available version control or a
   scoped diff; do not discard uncommitted changes.
2. Translate the change signal into affected outcomes, requirement IDs, journeys,
   constraints and success measures. Distinguish necessary corrections from
   optional improvement ideas.
3. Inspect known dependent UX, architecture, stories or tests when available.
   Record the concrete impact. Missing dependent artifacts remain an inspection
   gap; do not invent a synchronized downstream state.
4. Apply the authorized changes surgically. Preserve stable requirement IDs,
   retain relevant rationale and mark removed or superseded requirements clearly.
   Do not renumber unrelated requirements or silently expand or reduce scope.
5. Reconcile cross-references, acceptance examples, constraints and exclusions
   affected by the edit. Record new assumptions and disagreements with previous
   decisions. If a change requires an unresolved product choice, leave that
   portion proposed and continue the independent corrections.
6. Review the diff against the change request. Check requirement consistency and
   testability in the edited area and its direct dependencies.
7. Add a concise change record: what changed, why, source, affected IDs and the
   dependent artifacts that still need an update.

## Output

Deliver the revised canonical PRD and a report containing the baseline, change
signal, changed requirements, checks, unresolved decisions and downstream impact.
Keep proposed follow-up edits distinguishable from files actually changed.

## Acceptance and continuation

The diff must be explainable by the request or a necessary consistency repair.
Changed requirements remain observable, prior user content is preserved and
dependent work is not reported complete without evidence.

On resume, compare the target and change signal with the recorded baseline.
Retain completed edits that still apply and reconcile concurrent user changes
before continuing. A separate [PRD validation](validate-prd.md) can assess a
broader scope when requested.
