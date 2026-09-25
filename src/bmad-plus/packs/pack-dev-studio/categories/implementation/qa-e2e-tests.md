---
name: bmad-qa-generate-e2e-tests
description: Add and execute meaningful end-to-end tests for a scoped existing journey.
---

# End-to-end tests

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

A request identifying the journey to cover, or an explicit feature or acceptance
artifact. Inspect the current application, existing test runner, fixtures and
test environment. Confirm which behavior is implemented before asserting coverage.

## Procedure

1. Identify the journey's actor, starting state, actions and observable outcome.
   Read the relevant acceptance criteria and existing tests. Define the scope and
   avoid duplicating coverage that already establishes the same behavior.
2. Inspect the test setup and commands. Prefer the existing runner and conventions.
   Determine test data, isolation, service dependencies and cleanup. Use a local
   or designated test environment; never create real purchases, messages or
   destructive production state solely to satisfy a test.
3. Choose a small, meaningful scenario set: the primary outcome plus failure,
   boundary, permission or recovery cases justified by the feature. Separate
   missing implementation from missing coverage.
4. Implement tests using observable behavior and stable user-facing locators or
   API contracts. Make fixtures deterministic and clean up only test-owned data.
   Synchronize on meaningful states instead of arbitrary delays. Explain mocks
   and the integration boundaries they leave untested.
5. Run the selected tests in the actual runner. Inspect failures rather than
   weakening assertions or hiding them with blanket retries. Where practical,
   demonstrate that the assertions reject a controlled incorrect result before
   claiming they protect the requirement.
6. Run the required checks for the touched test/configuration areas. Fix
   task-related flakiness or regressions and record unavailable services,
   unsupported platforms or environmental failures accurately.
7. Deliver the test changes, commands and observed results. If the runner cannot
   execute, label the tests authored-but-unverified and give the exact remaining
   setup dependency. A static file check is not an end-to-end pass.

## Output and acceptance

Write the report for qa-e2e-tests with journey and requirement mapping, environment,
new or revised test files, fixture ownership, executed commands, results and
coverage limits. Record any discovered product defect separately from test defects.

Acceptance requires the scoped journey assertions to execute against the recorded
environment and produce the expected results. Include known gaps, skipped scenarios
and mock boundaries; passing selected tests does not establish every browser,
device, service or deployment.

## Continue

Reload the application, tests and previous report. Compare input versions and
inspect fixtures before reuse. Re-run scenarios affected by changed behavior or
environment, preserving useful failure evidence. Do not silently reuse old
credentials, test data or a previous production authorization.
