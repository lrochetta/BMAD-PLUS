# Architecture compatibility guide — define consistent interfaces

This retained path supports procedure step 5 of
[create-architecture](../create-architecture.md). Follow the common
[execution guide](../../../shared/execution.md).

Inspect the project's existing conventions before defining new ones. Specify
component ownership, dependency direction, interface examples, validation, errors
and state transitions. Include concurrency, access control and recovery where
the actual change requires them.

Use examples that make independently implemented components compatible. Distinguish
a required contract from a preferred implementation detail, and avoid introducing
abstractions with no current need.

Record the boundaries and examples in the architecture report. Check that the
examples obey the requirements and decision records. On a changed interface,
identify affected callers and acceptance checks before continuing the main
procedure. This guide does not launch an implementation agent.
