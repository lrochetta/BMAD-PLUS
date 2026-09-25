# Architecture decision document guide

Use this structure for create-architecture. It is an authoring guide, not a
configuration file or a claim that a design has been validated. Replace the
guidance with project-specific evidence; omit sections irrelevant to the scope
and explain any consequential omissions.

## Context and scope

State the requested outcome, inspected system boundary, current behavior and
excluded work. Record input paths, versions or hashes, and the source of important
constraints. List assumptions separately from confirmed requirements.

## Behavior and invariants

Describe the journeys the design must support and the properties that must remain
true. Map each to a requirement source and a planned acceptance check.

## Components, data and interfaces

Describe ownership, dependency direction and state transitions. Include concrete
interface examples, validation and error behavior. Explain applicable authorization,
data retention, concurrency and recovery decisions.

## Decision records

For each consequential decision, record:

- Stable decision ID and status: proposed, accepted, provisional or superseded.
- Problem and constraints, with evidence sources.
- Credible options considered and their material tradeoffs.
- Chosen option, reason, costs and compatibility consequences.
- Evidence still needed and the condition that would justify revisiting it.

A superseded decision keeps a reference to its replacement and the reason.
Design acceptance and implementation verification are different statuses.

## Repository and delivery map

Distinguish existing paths from proposed files. Identify a useful first slice,
dependencies, migrations and operational changes. Explain rollback or forward
recovery where state or deployment changes require it.

## Verification and open dependencies

Record the success/failure walkthroughs, contradictions found, experiments actually
run and checks still proposed. Name unresolved prerequisites, affected decisions
and the next useful action. Conclude with the design's current disposition and
the boundary of any validation claim.
