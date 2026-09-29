# Architecture compatibility guide — resume existing work

This retained path explains continuation for
[create-architecture](../create-architecture.md). It is not a separate runtime
or a step that restarts the workflow. Follow the common
[execution guide](../../../shared/execution.md).

Read the existing report and its input ledger. Compare current requirements,
interfaces, code and hashes with the state the report describes. Identify
decisions that remain supported, decisions affected by changed assumptions and
incomplete sections.

Keep human annotations and the history of superseded decisions. Record each
invalidated conclusion and the input that changed it. A previous completion mark
does not make a changed interface or a stale test result valid.

Resume the main procedure at the earliest affected or unfinished part. Stop only
work that needs essential missing information; preserve useful independent work.
Do not recreate the report, repeat migrations or apply external actions from an
old handoff without inspecting their current state.
