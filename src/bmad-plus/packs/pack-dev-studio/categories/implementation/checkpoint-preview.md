---
name: bmad-checkpoint-preview
description: Prepare a focused walkthrough of a change with actual evidence and explicit review decisions.
---

# Checkpoint preview

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

A change artifact or request identifying the work to preview. Inspect the actual
diff, intended behavior and available verification results. Establish the
revision or working-tree state the preview describes.

## Procedure

1. Identify the reviewer's decision and the changed user or system behavior.
   Read the relevant implementation and existing checks. Separate a requested
   walkthrough from approval to publish, merge or modify the product.
2. Select the few paths that best demonstrate acceptance and consequential
   failure behavior. Explain the prior and current behavior using actual inputs
   and outputs, not an invented demo scenario presented as executed evidence.
3. Prepare a reproducible local preview using the project's existing commands
   and suitable test data. Check what those commands do before running them.
   Execute within the task's scope and avoid exposing credentials or user data.
4. Inspect the preview with the host capabilities that exist. For a UI, check
   relevant interaction, states and accessibility with an actual browser when
   available. For a CLI or API, show observed results. If execution is unavailable,
   provide source-backed guidance and label runtime behavior unreviewed.
5. Show the evidence and focus attention on meaningful decisions, tradeoffs or
   residual uncertainty. State which acceptance criteria were exercised and which
   remain unverified. A screenshot alone does not establish interaction behavior.
6. Record feedback and the resulting action. Apply follow-up changes already
   authorized by the user, then refresh affected evidence. If an essential new
   decision is required, preserve the preview as reviewable work while that
   dependent action waits.

## Output and acceptance

Write the report for checkpoint-preview with baseline, review purpose, setup and
reproduction steps, observed before/after behavior, evidence locations, unresolved
checks and decisions. Include actual preview URLs only when a running or deployed
preview exists; state its limitations and lifetime when known.

The result is useful when another reviewer can understand the change and reproduce
the relevant checks. Record an actual approval only when the authorized reviewer
gave it; absence of feedback is not approval.

## Continue

Compare the current revision with the preview baseline. Rebuild or rerun affected
scenarios after changes and preserve prior feedback. Do not reuse screenshots,
test results or approval for behavior that changed after they were recorded.
