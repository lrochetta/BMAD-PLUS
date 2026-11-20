---
name: bmad-quick-dev
description: Implement a bounded request with proportionate investigation and acceptance evidence.
---

# Quick development

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

A change request or supplied artifact describing the desired behavior. Inspect the
selected project with host tools. If a current story already supplies the scope,
reuse it rather than generating a competing specification.

## Procedure

1. Translate the request into an observable outcome and acceptance checks. Inspect
   relevant code, project instructions and the working tree before estimating
   scope. State material assumptions and preserve existing user edits.
2. Trace the behavior through the actual implementation. Identify affected
   interfaces, data, dependencies and a useful baseline check. Investigate an
   essential ambiguity before changing the code; continue independent authorized
   work while a necessary answer is pending.
3. Choose a proportional implementation plan. A routine edit can use a brief
   checklist. A cross-cutting change needs explicit boundaries and dependencies.
   If the request contains independent deliverables, sequence them as separate
   reviewable slices while retaining the user's overall objective.
4. Implement the smallest coherent slice in the project's style. Add focused
   regression coverage when it meaningfully protects changed behavior. Do not
   introduce a framework, dependency upgrade or broad refactor without a concrete
   reason tied to the task.
5. Execute acceptance checks and required project validation. Inspect the final
   diff, correct regressions caused by the change and record unavailable or
   unrelated failing checks. Rerun a check only when changes or unresolved evidence
   justify it.
6. Deliver the changed artifacts and evidence. State which outcomes are verified,
   which are implemented but unverified, and any remaining dependency. Follow
   existing authorization for commit or publication; finishing code does not
   grant permission for unrelated external actions.

## Output and acceptance

Write the report for quick-dev with request, baseline, compact plan, changed files,
acceptance results and next action. Include a before/after example when it makes
the result easier to review.

Success requires the requested behavior and its applicable checks to be
established. A plan alone is not an implementation, and a test command listed in
the report is not an executed test. Do not impose a fixed document size or a
mandatory full planning pipeline on a small change.

## Continue

Read the previous report and inspect current files before editing. Compare inputs,
preserve completed valid work and reconcile interruptions or concurrent changes.
Resume the next incomplete slice; do not reset the tree or repeat completed
external effects to recreate a prior state.
