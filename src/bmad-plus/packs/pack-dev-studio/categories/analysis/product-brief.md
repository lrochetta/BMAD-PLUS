---
name: bmad-product-brief
description: Create, update or assess a product brief from a real problem and available evidence.
---

# Product brief

Load the [execution guide](../../shared/execution.md) and
[Miriam](analyst-agent.md). Produce a concise basis for deciding what to build
and which uncertainty to resolve first.

## Inputs

Use the user's idea or change request, intended users, desired outcome and any
existing research or project context. An update or assessment needs the actual
brief. An idea is enough for a draft; missing research must remain visible.

## Procedure

1. Establish the brief's purpose and mode: create, update or assess. For an
   existing product, inspect its current behavior and preserve decisions that the
   request does not change.
2. Describe the specific user, their task, the present workaround and the cost of
   the problem. Separate supplied observations from inferred needs. Do not turn
   an imagined persona into a research finding.
3. State the proposed outcome and why the current alternatives may be inadequate.
   Check material competitive claims with current sources when access is
   available. Without them, label the claim as a hypothesis.
4. Define the first useful scope and explicit exclusions. Connect each included
   capability to the problem it addresses. Keep requested capabilities visible;
   record proposed phasing without silently removing them.
5. Define success: metric, current baseline if known, proposed target, observation
   method and any counter-metric that guards against a harmful tradeoff. Unknown
   baselines or unapproved targets remain open items.
6. List the assumptions most likely to invalidate the proposal. For each, propose
   a small observation or experiment, its decision threshold and who could supply
   the evidence. Do not claim that the experiment has happened.
7. Review the brief for contradictions between audience, scope, value and success.
   In update mode, explain material reversals and their evidence. In assessment
   mode, leave the source brief unchanged and report findings with locations.

## Output

Write the report for the invoked workflow with these sections:

- Problem and intended users.
- Evidence and current alternatives.
- Proposed value and first useful scope.
- Exclusions and constraints.
- Success measures, baselines and proposed targets.
- Assumptions, risks and validation actions.
- Recommendation, open decisions and next step.

Include input paths and the status of each important claim. A short brief may
combine sections when their meaning remains clear.

## Acceptance and continuation

Every included capability should serve a stated user problem; every success
claim should have an observable measure. A draft with open assumptions is a
valid outcome, but do not label it validated without supporting observations.

Resume from the unresolved decision after comparing changed inputs. If the
problem or audience changes, revisit scope and metrics before polishing wording.
A usable brief can feed [PRD creation](../planning/create-prd.md); select that
route only when it advances the user's task.
