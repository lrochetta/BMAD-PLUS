# Story delivery checklist

Use with the common [execution guide](../../shared/execution.md). This checklist
summarizes evidence; it neither executes tests nor grants acceptance automatically.

Record each item as passed, failed, not applicable with a reason, or unavailable.
A missing check cannot be marked passed.

- The implemented scope matches the current story and its acceptance criteria.
- Input versions, relevant starting edits and actual changed files are recorded.
- Each applicable criterion has an observed check result linked to the behavior.
- Regression coverage protects meaningful changed behavior where needed.
- Required project checks have run, with failures and skipped checks visible.
- Interfaces, error paths and compatibility affected by the change were inspected.
- The diff preserves unrelated work and does not include accidental sensitive data.
- Documentation and configuration affected by user-visible behavior are consistent.
- Required reviews have actually returned evidence; disputes remain recorded.
- Criteria a person must confirm on screen carry their recette steps, and a delivered
  page's run is read and classified before any of them is called passed.
- Manual story or sprint statuses were preserved or changed with a recorded basis.
- Remaining dependencies, risks and the next action are explicit.

Use the project's actual completion rules. A proposed test, a file's existence or
a teammate's unverified completion message is not proof that acceptance passed.
