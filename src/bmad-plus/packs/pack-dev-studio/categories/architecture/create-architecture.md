---
name: bmad-create-architecture
description: Define an implementable architecture for an actual product or change request.
---

# Create architecture

Read the [execution guide](../../shared/execution.md) and
[Bezalel's role](architect-agent.md). Use the
[decision document guide](../../shared/architecture-decision-template.md) for the
output. This page contains the complete procedure; no step-file runtime is needed.

## Inputs

A request or supplied artifact describing the desired behavior. For an existing
project, inspect relevant code, manifests and prior decisions. A PRD, UX contract,
load forecast or deployment constraint is evidence only if actually supplied or
found and read. Record missing consequential facts as questions.

## Procedure

1. Establish the scope and baseline. Record the request, inspected input paths,
   hashes when available, current implementation state and the decisions already
   accepted. Identify what the architecture must enable and what is outside scope.
2. Describe the significant journeys and constraints. Distinguish observable
   behavior, invariants, service limits and design preferences. Connect each
   consequential constraint to an input or an explicitly stated assumption.
3. Examine the existing stack and operating environment. Locate extension points,
   data stores, deployment configuration and project conventions. For a new
   project, compare suitable foundations against actual needs; scaffolding or
   changing dependencies is a separate action from selecting a design.
4. Decide the consequential choices. For each, record the problem, credible
   alternatives, chosen approach, costs, supporting evidence and a condition for
   revisiting it. Resolve an essential unknown by inspection or a bounded,
   authorized experiment; otherwise mark the affected decision provisional.
5. Define component and data boundaries. Specify ownership, dependencies,
   interface examples, validation, errors and state transitions. Cover access
   control, sensitive data, concurrency, observability and recovery wherever the
   system actually uses them. Avoid adding mechanisms without a requirement.
6. Map the design onto the repository and delivery environment. Distinguish
   existing paths from proposed paths, describe migrations and compatibility, and
   identify the smallest useful implementation sequence with its dependencies.
7. Walk through a representative success case, a relevant failure case and any
   migration or restart that the change needs. Check each against the boundaries
   and invariants. Record contradictions, missing decisions and the concrete
   tests or measurements that would resolve them.
8. Write the architecture report. Explain which parts are sufficiently specified
   for implementation, which remain provisional, and the next bounded action.
   Do not claim performance, security or deployment validation without evidence.

## Output and acceptance

Write the common report at the configured output path for create-architecture.
Include context, input ledger, requirement-to-decision mapping, component/data
boundaries, decision records, repository map, delivery sequence, verification
plan and open risks. A diagram is useful only when its labels agree with the
written interfaces.

The report is complete when every in-scope consequential requirement has a
decision or an explicit unresolved dependency, interface examples are consistent,
and an implementer can identify the first slice and its acceptance checks.
Record actual experiments separately from proposed tests. Provisional design
can be delivered as a draft; it cannot be described as verified architecture.

## Continue

Read the existing report and compare its inputs with current files before editing.
Keep user additions. Invalidate decisions whose assumptions or interfaces changed,
then resume at the earliest affected procedure step. Preserve superseded decisions
and the reason for replacement rather than silently rewriting project history.
