---
name: bmad-prd
description: Select and carry out PRD creation, editing, validation or focused analysis.
---

# PRD

Load the [execution guide](../../shared/execution.md) and
[Yosef](pm-agent.md). Select the concrete procedure matching the user's intent
without requiring a new planning conversation for every request.

## Inputs

Use the request and any explicitly supplied product artifacts. Creation needs a
problem or desired behavior. Editing, validation and analysis need the actual
target PRD. A document path alone does not explain an intended change.

## Procedure

1. Read the supplied context and any existing target document. Determine whether
   the user wants new requirements, a specified change or an assessment.
2. Select one route and read its complete instructions:
   - [Create PRD](create-prd.md) for a new product scope or a new requirements
     document.
   - [Edit PRD](edit-prd.md) for an authorized change to an existing PRD.
   - [Validate PRD](validate-prd.md) for review, validation or analysis of an
     existing PRD. For a focused question, narrow the assessment accordingly.
3. Preserve the request, supplied artifacts and prior decisions when routing.
   Do not reinterpret a review as permission to edit the source. If an essential
   input is missing, identify it and complete any independent inspection.
4. Execute the selected procedure in the current host. This route selection does
   not launch another agent or establish that the work has already been done.
5. Record the selected operation, its result and evidence in the report for the
   invoked workflow ID. Use the target document as the deliverable when editing;
   avoid creating duplicate canonical PRDs.

## Output

Deliver the artifact required by the selected route, plus a concise report
containing the operation, input paths, changed artifacts, checks, unresolved
decisions and next action. Keep the difference between a drafted requirement,
an implemented feature and a verified outcome explicit.

## Acceptance and continuation

Confirm that the result answers the user's actual operation and uses the selected
route's acceptance criteria. On resume, retain the recorded operation unless the
request changes, compare input revisions and continue the first incomplete step.
This router supplies no additional approval gate and no automatic downstream run.
