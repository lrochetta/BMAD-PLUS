---
name: bmad-plus-sync
description: Synchronize BMAD+ with upstream BMAD-METHOD. Check for updates, analyze changes, and merge compatible updates.
---

# BMAD+ Upstream Sync

## Overview

This skill manages synchronization between your BMAD+ installation and the upstream BMAD-METHOD repository. It leverages the Audit 360° MCP Server (deployed on your VPS) for git operations, and the Gemini API for intelligent diff analysis.

## Capabilities

### Check for Updates
```
bmad-plus-sync check
```
Fetches upstream, compares with last sync, and reports:
- 🟢 Compatible changes — safe to merge
- 🟡 Review needed — may affect custom agents
- 🔴 Breaking — requires manual intervention

### Apply Compatible Updates
```
bmad-plus-sync apply
```
Auto-merges compatible upstream changes into BMAD+ core (leaves `src/bmad-plus/` untouched).

### Full Report
```
bmad-plus-sync report
```
Generates a detailed report of all upstream changes since last sync, with AI analysis.

## Architecture

```
bmad-plus-sync
  ├─ Uses MCP Server (VPS) for:
  │   ├─ git_clone_repo    — clone upstream on VPS
  │   ├─ git_pull          — fetch latest changes
  │   ├─ git_diff          — compare versions
  │   ├─ git_log           — commit history
  │   ├─ github_create_pr  — auto-PR for compatible changes
  │   └─ github_push_files — update BMAD+ repo
  │
  ├─ Uses Gemini API for:
  │   └─ AI-powered change classification
  │
  └─ Notifies via:
      └─ WhatsApp (Evolution API) or Email
```

## Protected Paths

The sync NEVER modifies these BMAD+ custom paths:
- `src/bmad-plus/` — custom module (agents, skills, data)
- `monitor/` — monitoring system  
- `mcp-server/` — MCP server
- `osint-agent-package/` — OSINT package

## Invocation

Invoke via the Orchestrator (Nexus) or directly:
```
bmad-plus-sync
```

This skill is also called automatically by the VPS weekly cron job.
