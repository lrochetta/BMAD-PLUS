# Review compatibility guide — triage findings

This retained path supports procedure steps 5 and 6 of
[code-review](../code-review.md). Follow the common
[execution guide](../../../shared/execution.md).

For each suspected issue, inspect the supporting code and counterevidence. Remove
duplicates and distinguish a behavioral defect from a style preference. Retain
the reason a suspicion was refuted so continuation does not repeat it.

A retained finding needs a file/line, trigger, consequence, evidence, confidence
and proportionate fix direction. Set severity from actual impact and likelihood.
Unsupported speculation belongs in open questions.

Reconcile acceptance and review coverage. Missing tools, unrun checks and absent
required reviewers remain incomplete. Zero findings is valid when supported by
the inspected scope. Continue at the first incomplete part of the main procedure;
triage does not itself repair the code.
