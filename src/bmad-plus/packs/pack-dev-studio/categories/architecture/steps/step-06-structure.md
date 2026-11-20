# Architecture compatibility guide — map the delivery

This retained path corresponds to procedure step 6 of
[create-architecture](../create-architecture.md). Follow the common
[execution guide](../../../shared/execution.md).

Map decisions to repository responsibilities and deployment boundaries. Label
existing paths and proposed paths distinctly; do not present an imagined directory
tree as inspected code.

Identify the smallest useful implementation slice, its dependencies and any data
or configuration migration. Explain compatibility and recovery where changes
affect stored state or deployment. Avoid artificial dependencies between work
that can proceed independently.

Record the map and delivery order in the architecture report. On resume, reconcile
it with current code and ongoing human work before changing the sequence. A file
map is a design artifact and does not authorize creating all proposed files.
Continue at the main procedure's first unfinished part.
