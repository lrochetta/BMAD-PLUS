---
name: bmad-plus-autopilot
description: Launch autopilot mode — Nexus orchestrates the full pipeline from project idea to delivery with configurable checkpoints.
---

# BMAD+ Autopilot

## Overview

This skill enables full autopilot mode where the Orchestrator (Nexus) manages the entire development pipeline from a project idea to final delivery. The user provides a project concept, and Nexus sequences all agents through Discovery → Build → Ship phases with configurable checkpoints.

## How It Works

### Input
A project idea or brief description. Examples:
- "A SaaS for invoice management for SMBs"
- "Add a notification system to the existing app"
- "Refactor the authentication module to use OAuth2"

### Pipeline

The autopilot executes the following pipeline:

#### Phase 1: Discovery
1. **Strategist (Analyst role)** → Brainstorming & domain research
2. **Strategist (PM role)** → Product brief
3. **Strategist (PM role)** → PRD creation
4. **Quality (UX role)** → UX design spec
5. 🔴 **CHECKPOINT** → User reviews PRD + UX spec

#### Phase 2: Build
6. **Architect-Dev (Architect role)** → Architecture document
7. 🔴 **CHECKPOINT** → User reviews architecture
8. **Orchestrator (SM role)** → Epics & stories breakdown
9. **Orchestrator (SM role)** → Sprint planning
10. **For each story (parallelizable if independent):**
    - **Architect-Dev (Dev role)** → Implement story
    - **Quality (QA role)** → Test story
    - If tests fail → loop back to Dev (max 3 retries)
    - 🟡 **NOTIFY** → Story completion status

#### Phase 3: Ship
11. **Quality (QA role)** → Full code review
12. **Quality (UX role)** → UX review
13. **Architect-Dev (Tech Writer role)** → Documentation
14. **Orchestrator (SM role)** → Retrospective
15. 🔴 **CHECKPOINT** → User reviews final deliverable

### Checkpoint Behavior

Checkpoints are configurable via `module.yaml`:

- **require_approval** (🔴 STOP): Pause execution, send WhatsApp notification, wait for user approval.
- **notify_only** (🟡 INFO): Send notification, continue unless user intervenes.
- **auto** (🟢 AUTO): Continue automatically. Log for audit trail.

### State Management

Autopilot state is persisted in `.bmad-plus/orchestrator-state.yaml`:

```yaml
pipeline:
  project: "Invoice SaaS"
  started: "2026-03-17T12:00:00Z"
  current_phase: build
  current_step: 10
  status: running
  
completed_steps:
  - step: 1
    agent: strategist
    role: analyst
    output: brainstorming-report.md
    completed: "2026-03-17T12:05:00Z"
  # ...

parallel_tasks:
  - story: auth-api
    status: completed
  - story: dashboard
    status: running
```

This enables `bmad-plus-autopilot --resume` to pick up where it left off.

## Invocation

```
bmad-plus-autopilot
```

Or via the Orchestrator capabilities menu: `AP`

## Error Handling

- **Test failure**: Auto-retry up to 3 times, then escalate to user
- **Agent error**: Log error, notify user, skip to next step if non-critical
- **Conflict in parallel execution**: Pause conflicting agent, resolve, restart
- **User timeout at checkpoint**: Send reminder after 24h, pause pipeline
