# Review compatibility guide — gather scoped evidence

This retained path corresponds to procedure step 1 of
[code-review](../code-review.md). The main workflow is complete; these guides do
not form an execution chain. Follow the common
[execution guide](../../../shared/execution.md).

Identify the actual base and target revision or working-tree snapshot. Read the
request, diff, relevant callers, tests and constraints. Preserve existing edits
and record the paths and evidence that were inspected.

Clarify the reviewed behavior and acceptance criteria. A diff without surrounding
context may be insufficient to establish a defect; state what is missing instead
of inventing context.

Record the scope and input ledger in the report. On resume, compare the current
snapshot with the reviewed one and invalidate affected conclusions. Continue at
the first incomplete part of the main procedure.
