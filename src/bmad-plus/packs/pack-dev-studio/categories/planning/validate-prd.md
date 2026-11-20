---
name: bmad-validate-prd
description: Assess a PRD for consistency, coverage, testability and readiness without changing the source.
---

# Validate PRD

Load the [execution guide](../../shared/execution.md) and
[Yosef](pm-agent.md). Assess the actual requirements against their purpose and
the evidence available. This is a maintained route.

## Inputs

Require the target PRD. Use the requested review scope, product brief, source
requirements, known constraints and relevant architecture or UX where supplied.
A focused question should receive a focused review; do not invent a requirement
for every possible product concern.

## Procedure

1. Read the PRD and establish its intended audience, scope and readiness claim.
   Record the artifact version or hash and which supporting inputs were examined.
2. Trace the important user needs and journeys to requirements and acceptance
   examples. Identify genuinely missing in-scope behavior and distinguish it
   from an optional improvement.
3. Check contradictions: terminology, access rules, business rules, exclusions,
   priorities, dependencies, metrics and requirement cross-references. Cite
   the conflicting locations or IDs.
4. Assess testability. For consequential requirements, identify an observable
   acceptance condition and relevant failure case. A vague adjective or an
   unexplained number needs clarification when it affects implementation.
5. Inspect nonfunctional constraints and feasibility assumptions against supplied
   evidence. Flag missing measurement conditions or unsupported capability
   claims. Without technical evidence, report feasibility as unverified rather
   than declaring it possible or impossible.
6. Evaluate each potential finding against counterevidence. Remove refuted
   findings, retain the rationale and allow zero findings. Describe uncertainty
   explicitly; do not manufacture an issue count or a numerical quality score.
7. Summarize readiness for the intended next activity and list the specific
   unresolved decisions. Keep editorial suggestions separate from blockers that
   prevent meaningful implementation or acceptance.

## Output

Write a review report with scope and input provenance, inspected coverage,
findings, counterevidence or resolved concerns, missing evidence and readiness.

Each finding includes a stable local ID, severity with a concrete consequence,
requirement ID or document location, evidence, proposed correction and remaining
uncertainty. State which checks were unavailable or outside the review scope.

## Acceptance and continuation

The source PRD remains unchanged during validation. Every retained finding must
point to inspectable evidence and explain its consequence. This document review
does not prove runtime behavior, accessibility compliance or stakeholder approval.

On resume, compare the reviewed artifact with its recorded version. Recheck
changed requirements and affected findings; preserve valid resolved concerns.
Use [Edit PRD](edit-prd.md) when the user's task includes applying corrections.
