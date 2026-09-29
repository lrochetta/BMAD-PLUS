---
name: advanced-elicitation
description: Resolve the few unknowns that materially affect a product or technical decision using evidence and focused questions.
---

# Advanced Elicitation

Read the [execution guide](../../shared/execution.md) and adopt
[Miriam](../analysis/analyst-agent.md).

## Inputs

A decision, requirement or problem that needs clarification, plus available project
evidence and stakeholders already identified. The purpose is to reduce uncertainty
for the next action; it is not to force a long interview before useful work.

## Procedure

1. Read the available artifacts and prior decisions. Build a short ledger of known
   facts, assumptions, contradictions and missing information. Name the decision
   each uncertainty could change.
2. Rank unknowns by their effect on the next step. Investigate repository files,
   supplied examples and accessible primary sources before asking the user to
   repeat information already available.
3. Choose a concrete technique for the remaining issue: walk through a recent user
   scenario, compare two alternatives, test a boundary condition, trace a failed
   handoff, or work backward from an acceptance example. Explain why it fits.
4. Ask only the essential unresolved question or a compact related set. Offer a
   reasonable default for optional preferences. Continue independent work while
   waiting when the host permits it. Do not contact other people or run an
   interview through an external channel without the user's authorization.
5. Record answers with their source and date. Convert them into testable
   requirements, explicit constraints or bounded hypotheses. Where stakeholders
   disagree, retain both positions and the decision needed to resolve them.
6. Stop eliciting when the next authorized task has sufficient inputs. If essential
   information remains unavailable, identify the dependent work and the smallest
   experiment or answer that would unblock it.

## Output

Add an uncertainty ledger to the common report with question, decision affected,
evidence, answer or assumption, confidence basis and next check. Include resulting
requirements, acceptance examples and unresolved disagreements. Do not invent
stakeholder responses or numerical confidence scores.

## Acceptance and continuation

Each question contributes to a decision. Requirements trace to actual evidence or
an explicit assumption, and the next action is clear. On resume, incorporate new
answers, invalidate dependent assumptions that changed and avoid repeating already
resolved questions unless their supporting evidence is stale.
