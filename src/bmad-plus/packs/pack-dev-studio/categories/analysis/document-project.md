---
name: bmad-document-project
description: Document an existing repository using inspected implementation and verified examples.
---

# Document project

Load the [execution guide](../../shared/execution.md) and
[Huldah](tech-writer-agent.md). Produce documentation that lets a new contributor
or coding assistant navigate the current project reliably.

## Inputs

Use the selected repository and the user's documentation goal, plus any supplied
entry files or existing docs. The host must inspect the repository; a prepared
context bundle is not evidence that its implementation has been examined.

## Procedure

1. Read project instructions and existing documentation. Establish the audience
   and requested scope, repository revision when available, and relevant local
   changes. Do not reset the worktree or treat uncommitted user work as obsolete.
2. Inspect the directory structure, manifests, lockfiles, entry points and build
   configuration. Exclude generated dependencies and unrelated large assets from
   the scan. Do not copy secrets or private configuration values into documents.
3. Trace a representative user action through the main components. Record the
   observed boundaries, storage or external interfaces and error paths. Cite
   implementation files for architectural statements; mark inferred relationships.
4. Determine the actual setup, development, test and build commands from scripts
   and configuration. Verify safe relevant commands where feasible. Record
   environment requirements and unexecuted commands without claiming success.
   Do not start paid services, migrations or deployments merely to document them.
5. Document the surfaces needed for the reader's task: API or CLI contracts,
   important data models, extension points, configuration names and useful test
   locations. Include a small example tied to actual behavior.
6. Reconcile existing documentation. Fix stale guidance within scope, retain
   useful user content and avoid a second competing source of truth. Link to the
   canonical document when it already answers a topic.
7. Check paths, command options, example output and diagrams against their
   sources. Record gaps that require runtime access or product clarification.

## Output

The report contains scope and inspected revision; a repository map; setup and
common commands; a component and data-flow explanation; relevant interfaces;
tests and verification results; known gaps; and guidance on when to update these
docs. Additional requested files may hold the guide itself; list them in the
report with their intended audience.

For a monorepo, identify which package each command belongs to. Do not imply one
package's successful test validates every package.

## Acceptance and continuation

A reader should find the entry points, run documented prerequisites and know
which claims were inspected versus executed. Check internal document links and
avoid generated file counts that will immediately become stale.

On resume, compare the revision, manifests and previously inspected source paths.
Update affected explanations and examples; preserve unaffected sections and user
edits. Hand off a specific unresolved source or runtime question when completion
depends on access the host does not have.
