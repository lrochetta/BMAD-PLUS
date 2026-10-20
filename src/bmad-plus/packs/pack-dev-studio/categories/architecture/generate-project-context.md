---
name: bmad-generate-project-context
description: Capture concise project conventions and constraints from inspected sources.
---

# Generate project context

Read the [execution guide](../../shared/execution.md) and
[Bezalel's role](architect-agent.md).

## Inputs

A request naming what project or area to summarize, or an explicit project
artifact. Inspect the selected directory with host tools; a prepared context
bundle is not a repository inspection. Read current instructions and existing
context before generating another file.

## Procedure

1. Identify the repository boundary and relevant source areas. Read project
   instructions, manifests, build or test entry points and representative code.
   Record the inspected revision or input hashes and any inaccessible areas.
2. Extract facts that affect future work: runtime and package manager, directory
   responsibilities, established extension patterns, actual verification commands
   and deployment boundaries. Cite each consequential fact to its source.
3. Capture invariants and recurring conventions using concrete examples. Separate
   project requirements from an observed local pattern and from a recommendation.
   Do not promote one unusual file into a universal rule.
4. Check existing context and documentation for duplication or contradictions.
   Resolve claims by inspecting the authoritative source; keep unresolved
   disagreements visible. Summarize useful rules rather than copying large files
   or storing sensitive values.
5. Organize a compact context document around the decisions a future implementer
   must make. Include where to look next and what has not been inspected. Label
   commands as discovered or executed, with actual results only for executed
   checks.
6. Review each statement for evidence and ongoing relevance. Write the report,
   or the user's requested project-context destination. Never overwrite generated
   AGENTS.md or tool adapters; changes to their rules belong in their source
   configuration and generation workflow.

## Output and acceptance

The report for generate-project-context contains scope and freshness, source
ledger, project map, working conventions, acceptance/verification commands,
invariants and unresolved questions. State the inspected area prominently when
coverage is partial.

A future assistant should be able to find the implementation area and the
appropriate checks from this document. Unsupported prescriptions, duplicated
manuals and hidden assumptions should be removed or labeled as proposals.
The context is reference material and does not override project or user instructions.

## Continue

Read and preserve the existing document's human additions. Compare referenced
sources and hashes, refresh affected facts and remove stale statements only with
their replacement evidence recorded. An unchanged report date is not proof that
the project stayed unchanged.
