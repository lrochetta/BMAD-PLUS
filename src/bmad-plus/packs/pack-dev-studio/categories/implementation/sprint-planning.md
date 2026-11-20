---
name: bmad-sprint-planning
description: Build a feasible sprint proposal from a supplied backlog while preserving existing status.
---

# Sprint planning

Read the [execution guide](../../shared/execution.md) and
[Oholiab's role](dev-agent.md).

## Inputs

An explicit epic, story or backlog artifact. Read the current sprint ledger if it
exists and any supplied goal, capacity, availability or date constraints. Unknown
capacity is an unresolved planning input, not permission to invent estimates.

## Procedure

1. Inventory the candidate work, preserving epic/story IDs and their source paths.
   Record the sprint goal and planning horizon when provided. Identify duplicate
   IDs and conflicting versions before treating the inventory as reliable.
2. Read current statuses, owners, carryover and external dependencies. Preserve
   human annotations and unfamiliar status values. Distinguish reported completion
   from acceptance evidence; creating a story file does not mean work has started.
3. Check each candidate's acceptance criteria and prerequisites. Separate work
   that is actionable, work needing clarification and work blocked by a dependency.
   Detect dependency cycles and explain the smallest unresolved part.
4. Select a coherent proposed scope using the stated priority and capacity.
   Account for known carryover and review/integration work. If capacity is absent,
   provide an ordered candidate set with the missing commitment decision.
5. Order selected work by actual dependencies. Identify tasks suitable for
   independent execution, shared-file conflicts and required handoffs. Do not
   claim that assigning a task has launched an agent or reserved a person's time.
6. Produce the plan and reconcile it with any existing ledger. When updating that
   ledger is within the task, make only evidenced changes, preserve its schema
   and comments, and record each status transition with its reason. New unstarted
   work remains backlog; established completion does not regress automatically.

## Output and acceptance

Write the report for sprint-planning with goal, planning assumptions, selected and
deferred work, dependency order, capacity limits and a proposed status ledger.

| Story ID | Source | Current status | Proposed action | Dependency | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| Preserve the ID | Artifact path | Exact reported value | Next bounded action | ID or external prerequisite | Existing or still required check |

The proposal is usable when every selected item has an acceptance path and its
blocking dependencies are visible. A sprint commitment requires actual scope and
capacity decisions; an ordered proposal may be delivered without inventing them.

## Continue

Reload backlog and ledger before replanning. Compare input hashes, keep manually
changed statuses and carry forward unresolved dependencies. Record added, removed
and deferred scope explicitly; never replace the previous plan with a new set
that silently loses ongoing work.
