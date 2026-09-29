Look for what the diff changes in behaviour, not how it reads.

- **Callers.** Search every caller of a changed function, export, route, command or schema. A signature, return shape or error type that changed is a defect at the caller that was not updated.
- **Removed behaviour.** Read what the diff deletes: a check, a branch, a cleanup, a log that an operator relies on. Deleted protection is the most often missed defect.
- **Boundaries.** Empty input, one element, the last element, the maximum size, a missing optional field, a concurrent second call, a retry after a partial failure.
- **Errors.** An error swallowed, logged and ignored, or turned into a success value. A failure path that leaves state half-written.
- **Trust.** Data that crosses a boundary (request, file, environment, another service, a model's output) and reaches a query, a command, a path, HTML or a permission decision without validation.
- **Tests.** A changed behaviour whose test still passes because it mocks the changed path, asserts nothing about the new case, or is skipped.

Do not report formatting, naming or style a linter enforces, and do not propose rewrites the change did not need.
