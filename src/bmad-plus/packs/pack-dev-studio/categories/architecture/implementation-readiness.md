---
name: bmad-check-implementation-readiness
description: Check whether a selected scope has enough consistent evidence to begin implementation.
---

# Implementation readiness

Read the [execution guide](../../shared/execution.md) and
[Bezalel's role](architect-agent.md).

## Inputs

At least one explicit planning or story artifact and the scope to assess. Use
supplied requirements, architecture, UX, backlog and project constraints as
applicable. A small maintenance task need not acquire unrelated planning documents.

## Procedure

1. Name the slice being assessed and inventory the artifacts actually read.
   Record versions or hashes and whether each artifact describes the current
   project. Separate absent documents from missing information.
2. Extract the slice's intended behavior, acceptance criteria and invariants.
   Check that essential terms, boundaries and failure behavior have a consistent
   meaning across inputs. Cite conflicting passages precisely.
3. Trace requirements through relevant UX or interface contracts, architecture
   decisions and implementation tasks. Identify missing handoffs, contradictory
   interfaces, uncovered constraints and acceptance checks with no observable
   result.
4. Inspect readiness dependencies: repository and runtime access, required data,
   decision owners, migrations, credentials supplied through approved channels,
   and test capabilities. Do not request or reproduce secret values in the report.
   A promise that access exists is not a successful access check.
5. Rank issues by their effect on the next implementation slice. Separate
   prerequisites that stop it, decisions safely deferred, and improvements that
   do not affect its acceptance. Give each blocking issue a source, consequence
   and the smallest resolution action.
6. Produce a disposition of ready, needs-resolution, or insufficient-evidence.
   Ready requires the scoped prerequisites and acceptance path to be evidenced.
   Missing information prevents a readiness claim for the affected scope;
   unrelated missing documents do not block useful independent work.

## Output and acceptance

Write the report for implementation-readiness with assessed scope, input ledger,
traceability table, issues, disposition and next actions. Use one row per relevant
requirement or invariant with columns for source, implementing story or task,
acceptance check and evidence status.

Every blocking conclusion must cite a concrete contradiction or missing
prerequisite. Zero issues is valid after completing the scoped assessment.
Readiness means work can begin under the recorded assumptions; it does not mean
the implementation is correct or that tests have passed.

## Continue

On new evidence, compare inputs and reassess only affected rows and dependencies.
Keep prior issues and record their resolution evidence. A document revision or
someone saying an issue is fixed is not itself proof of the relevant change.
