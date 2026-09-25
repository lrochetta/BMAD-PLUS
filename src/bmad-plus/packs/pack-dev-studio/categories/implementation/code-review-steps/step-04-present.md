# Review compatibility guide — present the conclusion

This retained path corresponds to procedure step 7 and continuation of
[code-review](../code-review.md). Follow the common
[execution guide](../../../shared/execution.md).

Present actionable findings in impact order with evidence and locations. Follow
them with the baseline, acceptance coverage, checks actually performed, refuted
suspicions where useful and unresolved limitations.

Use findings, no-actionable-findings or incomplete as the scoped disposition.
List partial findings even when some coverage is incomplete. Never present a
missing review or a passing unrelated test as evidence that the change is clean.

On updated code, verify each claimed resolution against actual changes and
re-review affected behavior. Preserve prior findings and their resolution evidence.
This guide does not imply approval to commit, publish or modify tracking statuses.
