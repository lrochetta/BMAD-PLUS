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
| **Restart** | After conflict resolution | Resume with merged context |
| **Reallocate** | Agent finishes early | Assign next queued task |
| **Escalate** | 3 consecutive failures | Notify human, pause pipeline |

## State File

All parallel execution state is tracked in `.bmad-plus/orchestrator-state.yaml`:

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
