---
name: bmad-create-prd
description: Create a requirements document with observable behavior, scope and acceptance evidence.
---

# Create PRD

Load the [execution guide](../../shared/execution.md) and
[Yosef](pm-agent.md). Define the requested product behavior at the level needed
for implementation and review. This is a maintained route.

## Inputs

Use the request, problem or product brief, relevant research, known constraints
and existing product behavior. A formal brief is optional. If a canonical PRD
already exists for this scope, inspect it before creating a competing document;
use [Edit PRD](edit-prd.md) when the task is an update.

## Procedure

1. Establish the intended users, problem, desired outcome and requested scope.
   Inspect source artifacts first. Distinguish an established constraint from a
   proposal and an unsupported assumption.
2. Describe the main user journeys and relevant system interactions. Capture
   prerequisites, access rules, business rules and the meaningful failure or
   recovery paths. For an existing product, identify changed behavior explicitly.
3. Define the first delivery scope, exclusions and dependencies. Keep explicit
   user requirements visible when proposing priorities or phasing.
4. Assign stable IDs to functional requirements. For each, state the actor or
   trigger, required behavior, conditions and an observable acceptance example.
   Link it to the user need or supplied evidence. Avoid implementation choices
   unless they are genuine project constraints.
5. Record applicable nonfunctional requirements such as performance, availability,
   accessibility, privacy or operational recovery. State the measurement context
   and verification method. Unknown thresholds stay open; proposed thresholds are
   labeled as proposals.
6. Define success measures and guardrails. Identify the baseline, proposed target,
   measurement method and missing evidence. Check that success does not reward
   behavior the product is meant to avoid.
7. Review consistency across journeys, requirements, exclusions and dependencies.
   Identify feasibility questions for architecture or research. Revise supported
   contradictions and leave unresolved decisions visible.

## Output

Produce a PRD with:

- Purpose, users and desired outcomes.
- Scope, exclusions and assumptions.
- User journeys and relevant business rules.
- Functional requirements with stable IDs and acceptance examples.
- Nonfunctional requirements and verification methods.
- Dependencies, risks and open decisions.
- Success measures and readiness for the intended next step.

The report also records input provenance, completed checks and the canonical
artifact path. A small change can use a compact document; section length is not
an acceptance criterion.

## Acceptance and continuation

Each in-scope behavior must be traceable to a need and verifiable through an
example or check. Mark unsupported feasibility claims and unapproved targets.
Do not call the document approved unless the relevant person actually approved it.

On resume, compare inputs and retain established IDs. Revisit only affected
requirements and record material decision changes. Use
[Validate PRD](validate-prd.md), [UX design](create-ux-design.md) or
[Architecture](../architecture/create-architecture.md) when needed for the
authorized task; a completed draft does not automatically invoke them.
