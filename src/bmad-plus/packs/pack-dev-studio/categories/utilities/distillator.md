---
name: distillator
description: Create a compact context brief with traceable decisions, constraints, omissions and source references.
---

# Distillator

Read the [execution guide](../../shared/execution.md) and adopt
[Huldah](../analysis/tech-writer-agent.md).

## Inputs

At least one explicit source document, its intended reader or next task, and any
size limit. If the task or limit is absent, state a practical default: a brief for
the next project contributor, with no fixed compression ratio. Inspect every
source; preserve the originals. Summarization can lose information and must never
be described as lossless compression.

## Procedure

1. Inventory source paths, dates and hashes when available. Separate current
   decisions from proposals, superseded claims and unresolved disagreement. Note
   unreadable sections or sources that exceed the available context.
2. Extract the facts the next task depends on: objective, acceptance criteria,
   constraints, interfaces, decisions with reasons, current state and blockers.
   Keep exact identifiers, units, conditions and negations where they affect the
   work. Do not turn an approximate figure into a precise one.
3. Draft a compact brief with source pointers next to material claims. Preserve
   incompatible claims as an explicit conflict; do not silently choose a winner.
   Use a small table for a useful mapping rather than opaque abbreviations.
4. Check the brief against the sources. Trace each decision and constraint back
   to a section. Check numbers, names and exceptions separately. If a size limit
   would hide a required constraint, report the tradeoff and retain that detail.
5. List what was omitted and when the reader must reopen an original document.
   Include the next action and the exact sources needed to perform it.

## Output

Write the common workflow report with these additional sections:

- Purpose and source inventory.
- Current facts and constraints, with references.
- Decisions and rationale; unresolved conflicts.
- Completed work, open work and next action.
- Omitted material and original documents to reopen.

Use the report itself as the brief, or link to a separate user-requested brief.
If reporting a reduction, measure both texts with the same word or byte counter
and name that measure. Do not invent token counts.

## Acceptance and continuation

Every material assertion has a source or an explicit assumption label. Required
constraints remain readable; omissions and uninspected inputs are visible. The
source files are unchanged. On resume, compare the source inventory and hashes;
refresh affected claims and recheck their dependents before reusing the brief.
