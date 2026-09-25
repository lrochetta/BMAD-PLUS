---
name: bmad-plus-parallel
description: Enable parallel multi-agent execution for independent tasks. The orchestrator detects and supervises parallelizable work.
---

# BMAD+ Parallel Execution

## Overview

This skill enables the Orchestrator (Nexus) to detect independent tasks and execute them in parallel using multiple agent instances. The Parallel Supervisor monitors all running agents, handles conflicts, and manages workload reallocation.

## Parallelization Detection

The Parallel Supervisor analyzes the task queue and identifies parallelizable work based on these rules:

### Parallelizable ✅
- Stories with no shared file dependencies
- Independent research tasks (market + technical)  
- Tests running while documentation is being written
- Changes to separate modules/packages

### Sequential Only 🚫
- Stories that modify the same files
- Tasks where output B depends on output A
- Architecture decisions before implementation
- Code review after implementation

## Execution Model

```
Orchestrator (Parallel Supervisor role)
├── Detects 3 independent stories
├── Launches Agent Instance 1 → Story A
├── Launches Agent Instance 2 → Story B
├── Launches Agent Instance 3 → Story C
├── Monitors all instances via orchestrator-state.yaml
├── Story A completes → launches QA for Story A
├── Story C fails → pauses, analyzes, restarts with fix
├── Story B completes → launches QA for Story B
└── All complete → sync point, proceed to next phase
```

## Supervision Actions

| Action | Trigger | Behavior |
|--------|---------|----------|
| **Launch** | Independent tasks detected | Start parallel agent sessions |
| **Monitor** | Continuous | Track progress via state file |
| **Pause** | Conflict detected | Stop conflicting agent |
| **Restart** | After conflict resolution | Reconcile the existing attempt and effects; retry within its recorded limit with a new host identity |
| **Reallocate** | Agent finishes early | Assign next queued task |
| **Escalate** | Attempt limit reached or reconciliation blocked | Report the unresolved condition and evidence; continue independent authorized work |

## State File

Use the Nexus agent's `bmad-plus nexus` protocol to retain task IDs, exclusive
write scopes, dependency checks, host/session identities, attempts and actual
verification evidence in `.bmad-plus/nexus/runs/`. Inspect a run before resuming
after an interruption; reconcile possible effects before a retry. The runtime
coordinates host work and executes trusted check commands. Tasks with an
explicit protected `execution` contract can use `nexus launch RUN TASK --json`
to run foreground commands or installed Codex CLI instances. Follow the Nexus
agent's executable-plan and exact-attempt `collect` examples. Each launch needs
a live foreground owner; the runtime supplies no background scheduler, sandbox
or Git integration. Launch only independent tasks within the recorded capacity.
For a process attempt, cancellation is bound to its returned identity and only
the original owner signals the child it spawned. A lost owner or uncertain
descendant leaves the attempt allocated until explicit reconciliation.

`.bmad-plus/orchestrator-state.yaml` remains an optional navigation summary:

```yaml
parallel_tasks:
  - id: task-001
    agent: architect-dev
    role: dev
    story: story-auth-api.md
    status: completed
    started: "2026-03-17T12:00:00Z"
    completed: "2026-03-17T12:15:00Z"
    output_files: ["src/auth/api.js", "src/auth/api.test.js"]
    
  - id: task-002  
    agent: architect-dev
    role: dev
    story: story-dashboard.md
    status: running
    started: "2026-03-17T12:00:00Z"
    
  - id: task-003
    agent: architect-dev
    role: dev
    story: story-invoices.md
    status: restarted
    attempt: 2
    restart_reason: "Conflict with task-001 on shared model file"
```

## Invocation

```
bmad-plus-parallel
```

Or via the Orchestrator capabilities menu: `PL`

This skill is automatically invoked by the Autopilot when `{parallel_execution}` is enabled and independent tasks are detected.
