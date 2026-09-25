---
name: party-mode
description: Compare relevant specialist perspectives on a concrete decision and retain supporting and conflicting evidence.
---

# Party Mode

Read the [execution guide](../../shared/execution.md) and adopt
[Miriam](../analysis/analyst-agent.md) as facilitator. The
[catalog](../../shared/catalog.json) identifies the six available personas.

## Inputs

A decision, proposal or unresolved question; its constraints; and any relevant
project artifacts. Identify who will use the outcome and what would change the
decision. A bare request for a discussion needs a topic before analysis can begin.

## Procedure

1. Restate the decision and the evidence already available. Separate choices
   within the authorized task from external actions that still require authority.
   Choose two or three relevant perspectives; do not involve every role by default.
2. Read each chosen persona from its catalog path. Give each perspective the same
   question, input snapshot and required response: recommendation, evidence,
   assumptions, strongest objection and a way to test the recommendation.
3. If the host supports independent agents and the work warrants parallelism,
   create actual assignments with identifiers and record their returned results.
   Otherwise examine the perspectives sequentially yourself and label the session
   as one assistant applying several perspectives. Persona names alone do not
   establish independent review or concurrent execution.
4. Compare the results by claim and evidence. Investigate material disagreement:
   inspect the relevant source or run a bounded check when available. Preserve
   refuted claims with their refutation; do not let a majority vote replace a fact.
   An absent participant result remains missing evidence.
5. Produce one recommendation with reasons, credible alternatives and the smallest
   next check for unresolved assumptions. Make only decisions covered by the
   user's request. Execute further work only when that work is authorized.

## Output

Add a decision record to the common report containing:

- Decision, scope, input snapshot and chosen perspectives.
- Execution mode: independent agents or sequential perspectives by one assistant.
- Actual assignments and result status, when independent agents were used.
- Comparison of recommendations, evidence, objections and disagreements.
- Chosen recommendation, rejected alternatives and next action.

Avoid invented dialogue, unanimous approval labels and aggregate confidence scores
without a defined basis. A disagreement can remain unresolved in a useful report.

## Acceptance and continuation

The recommendation traces to evidence and identifies what could change it.
Execution mode and missing results are accurate. On resume, recheck changed inputs
and outstanding assignments; revisit only affected claims. Do not repeat external
actions because a prior report recommended them.
