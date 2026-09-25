# Architecture compatibility guide — challenge the design

This retained path corresponds to procedure step 7 of
[create-architecture](../create-architecture.md). Follow the common
[execution guide](../../../shared/execution.md).

Trace a representative success journey through the proposed interfaces. Exercise
a relevant failure case and any migration or restart the change requires. Compare
each transition with the stated invariants and component ownership.

Record contradictions, unspecified behavior and consequential assumptions. Use
bounded experiments only when useful and authorized, and retain actual outcomes.
A walkthrough does not prove load capacity, security or a successful deployment.

This part is complete when required constraints have a consistent design or a
clearly named unresolved dependency, with concrete validation work identified.
After changed inputs, repeat the affected walkthroughs and preserve the reason
earlier conclusions no longer apply.
