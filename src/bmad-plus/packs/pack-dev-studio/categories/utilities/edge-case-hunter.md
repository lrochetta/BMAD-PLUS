---
name: edge-case-hunter
description: Derive concrete boundary and failure scenarios from a feature, interface or implementation.
---

# Edge Case Hunter

Read the [execution guide](../../shared/execution.md) and adopt
[Bezalel](../architecture/architect-agent.md).

## Inputs

A feature, interface, state transition or failure concern, with its intended
behavior and relevant artifacts where available. For a code claim, inspect the
implementation before describing it as present. A description alone supports
design scenarios, not verified defects.

## Procedure

1. Map the relevant inputs, states, outputs and trust boundaries. Identify the
   invariant that should hold and any user-visible behavior that must remain true.
   Keep the scope narrow enough to inspect.
2. Derive applicable boundaries: absent or malformed input, minimum and maximum
   size, duplicate requests, concurrent changes, interruption, timeout, partial
   failure, stale state, cancellation, permission changes and recovery. Include
   time, locale, accessibility or resource limits when they affect this feature.
3. Turn relevant cases into concrete scenarios. Specify initial state, trigger,
   expected behavior, failure consequence and an observable check. Discard cases
   already impossible under a verified constraint and record the reason.
4. Inspect code or run safe existing checks to see which cases are covered.
   Distinguish a design gap, a reproduced defect, an unexecuted scenario and
   verified protection. Record the command or source location behind each status.
5. Prioritize by consequence and plausible exposure, with reasons. Propose the
   smallest regression check or design decision for each material gap. If the user
   requested fixes, carry those out within scope using the implementation workflow;
   a list of cases by itself does not establish a fix.

## Output

The common report includes a boundary map and a scenario table:

| Scenario | Initial state and trigger | Expected behavior | Evidence/status | Impact | Next check |
| --- | --- | --- | --- | --- | --- |

Include invariant violations separately from preferred UX improvements. Record
cases excluded by inspected constraints and any unavailable execution capability.

## Acceptance and continuation

Each retained case can become an observable check. Reproduced defects include
reproduction evidence; unrun cases are labeled accurately. On resume, compare
changed interfaces and invariants, rerun affected checks and preserve evidence for
closed cases. Do not mark the whole feature robust because a sample passed.
