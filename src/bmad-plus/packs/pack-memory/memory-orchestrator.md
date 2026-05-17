# Pack Memory — Orchestrator

> Manages the persistent memory system for BMAD+ projects.

## Overview

Pack Memory provides a two-level persistent brain for BMAD+:
- **Project memory** (`.agents/memory/`) — decisions, lessons, patterns specific to one project
- **Global brain** (`~/.bmad-plus/brain/`) — cross-project knowledge that grows over time

## Agent

| Agent | Hebrew | Role |
|-------|--------|------|
| **Zecher** | זכר (remembrance) | Memory archivist — consolidation, scanning, recall |

## Activation

Pack Memory activates automatically when installed:
- At session start: agents load project memory + global identity
- During session: agents write decisions/lessons/patterns on trigger
- At session end: session handoff is persisted

Manual activation via Zecher:
- `"Zecher, scan projects in D:\travail\DEV"` — discover and index all projects
- `"Zecher, consolidate memory"` — deduplicate, archive stale, promote
- `"Zecher, where were we?"` — reconstruct context from last session
- `"Zecher, health check"` — verify memory integrity

## Memory Protocol

See `shared/memory-protocol.md` for the complete read/write protocol.

## Behavioral Guardrails

See `shared/karpathy-guardrails.md` for the 4 Karpathy principles with memory integration.

## Files

```
pack-memory/
├── README.md                           ← You are here
├── memory-orchestrator.md              ← This file
├── zecher-agent.md                     ← Memory Agent (Zecher)
├── shared/
│   ├── karpathy-guardrails.md          ← 4 Karpathy principles + memory hooks
│   └── memory-protocol.md             ← Complete read/write protocol
└── templates/
    ├── decisions.md                    ← ADR template
    ├── lessons.md                      ← Lessons template
    ├── patterns.md                     ← Patterns template
    ├── context.md                      ← Living project context
    ├── session-handoff.md              ← Session handoff template
    └── identity.yaml                   ← User preferences (global brain)
```

## Cohabitation Warning

> ⚠️ If you have an existing brain directory (`_brain/`, `~/.claude/memory/`, etc.),
> BMAD+ will detect it and **link to it** instead of creating a duplicate.
> Your existing memory will NOT be overwritten.

## Installation Behavior

When Pack Memory is selected during `npx bmad-plus install`:

1. **Brain detection** — Scans for existing brain directories
2. **Project memory** — Creates `.agents/memory/` with templates
3. **Global brain** — Creates `~/.bmad-plus/brain/` if it doesn't exist
4. **Identity setup** — Generates `identity.yaml` from user's install answers
5. **Guardrails injection** — Makes `karpathy-guardrails.md` available to all agents

## CLI Commands (planned)

```
npx bmad-plus scan [path]      — Scan and index projects interactively
npx bmad-plus memory status    — Show memory health report
npx bmad-plus memory export    — Export brain as portable archive
```
