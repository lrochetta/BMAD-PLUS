# Architecture compatibility guide — understand the constraints

This retained path corresponds to procedure step 2 of
[create-architecture](../create-architecture.md). Follow the common
[execution guide](../../../shared/execution.md); no next-file loader is required.

Read the actual product journeys and constraints. Separate observable behavior,
invariants, service limits and preferences. Identify the source for each
consequential requirement and label any assumption that lacks evidence.

Use a representative example to expose ambiguous terms, data ownership or failure
behavior. Determine which unanswered questions affect the next design decision
and which can wait without blocking independent work.

Record the behavior and constraints in the architecture report with source
references. This part is complete when consequential decisions can be evaluated
against explicit needs. On changed inputs, reassess affected constraints and their
dependent decisions before continuing the main procedure.
