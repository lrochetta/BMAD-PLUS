---
name: bmad-create-story
description: Prepare a specific story with implementation context and observable acceptance criteria.
---

# Create story

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

An explicit epic, requirements or existing story artifact. A requested story ID
should identify one item in that artifact. If the user asks for the next story,
inspect the actual backlog order, status and dependencies before selecting one.

## Procedure

1. Locate the selected outcome and its requirement sources. Preserve an existing
   story ID; assign a stable local ID only if none exists. If the request does not
   identify one actionable item, explain the ambiguity and continue gathering
   context that is useful regardless of selection.
2. Inspect relevant architecture, UX contracts and the repository area likely to
   change. Identify existing extension points, conventions and dependencies.
   Distinguish observed paths from proposed new files.
3. Write the story's outcome, scope, exclusions and prerequisites. Include the
   behavior before and after the change when it clarifies the task. Resolve
   essential ambiguities through source inspection or the user's missing decision.
4. Define numbered acceptance criteria with observable examples. Include relevant
   validation, failure, permissions, compatibility or accessibility behavior.
   Associate each criterion with a practical test or review method. State for each
   criterion whether a person can observe it on screen and where, so the delivery's
   human acceptance recipe can be written from the story rather than reconstructed.
5. Break implementation into ordered tasks and verification work. State the
   affected areas and expected action without prescribing speculative internals.
   Identify changes that would require additional authorization or an external
   dependency, while continuing work already covered by the request.
6. Check consistency with the source outcome and prerequisites. Mark the story
   actionable only when its essential inputs and acceptance path are available.
   Otherwise deliver a draft with exact unresolved dependencies.

## Output and acceptance

Write the report for create-story as the story artifact, or use the user's
requested story destination. Include ID and source references, intent, current and
desired behavior, scope, acceptance criteria, task order, implementation notes,
test approach and readiness disposition.

Preserve existing story notes and status. Writing the artifact does not itself
change a sprint status to ready or in-progress. Report any proposed transition
and its evidence; update a project ledger only within the requested scope.

## Continue

Re-read the story and source artifacts, compare hashes and inspect changed project
areas. Keep its ID and human additions. Amend affected criteria and tasks, record
the reason, and flag previously completed tasks whose assumptions no longer hold.
