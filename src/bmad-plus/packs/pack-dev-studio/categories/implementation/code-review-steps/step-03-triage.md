# Review compatibility guide — triage findings

This retained path supports procedure steps 5 and 6 of
[code-review](../code-review.md). Follow the common
[execution guide](../../../shared/execution.md).

For each suspected issue, inspect the supporting code and counterevidence. Remove
duplicates and distinguish a behavioral defect from a style preference. Retain
the reason a suspicion was refuted so continuation does not repeat it.

Refutation protocol. The default disposition is keep: removing a correct finding
costs more than keeping a wrong one. A finding moves to refuted only on one of
three citable grounds, and the citation goes into the record:

- **A — absent**: the construct the finding describes is not in the subject file;
  quote what the file contains at that place.
- **B — contradicted**: the code refutes the claim; quote the guard, caller or
  test that makes the failure unreachable.
- **C — duplicate**: another retained entry describes the same cause; name it.

Write the analysis before the disposition. Findings on security, data loss,
money or access control need ground A or B quoted; without it they stay
unresolved, never refuted. "Unlikely", "probably handled" and style disagreement
are not grounds.

A retained finding needs a file/line, trigger, consequence, evidence, confidence
and proportionate fix direction. Set severity from actual impact and likelihood.
Unsupported speculation belongs in open questions.

Reconcile acceptance and review coverage. Missing tools, unrun checks and absent
required reviewers remain incomplete. Zero findings is valid when supported by
the inspected scope. Continue at the first incomplete part of the main procedure;
triage does not itself repair the code.
