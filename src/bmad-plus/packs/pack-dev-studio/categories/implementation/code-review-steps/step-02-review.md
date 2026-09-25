# Review compatibility guide — inspect behavior

This retained path supports procedure steps 2 through 4 of
[code-review](../code-review.md). Follow the common
[execution guide](../../../shared/execution.md).

Inspect intended behavior, invariants and relevant failure boundaries in the actual
code. Trace each suspicion to a triggering condition and observable consequence.
Seek counterevidence and use a focused reproduction where useful and authorized.

Independent perspectives require actual host-supported reviewers. Record their
assignments and evidence; otherwise label the work as one assistant's sequential
review. An absent reviewer cannot supply a clean result.

Do not change product code during review unless fixes are within the user's task.
Record supported findings, unresolved questions and refuted suspicions. Continue
the main procedure at the next unfinished part; this guide does not spawn agents
or load another step by itself.
