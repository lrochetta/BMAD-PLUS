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

Pack Memory supplies instructions and files for the host agent to use. The host
must load and follow the memory protocol; installation alone does not execute it.
No automatic session-start or session-end hooks are installed.

While executing the protocol, the host agent should:

- At session start: load project memory + global identity
- During the session: record decisions, lessons and patterns when relevant
- Before ending its work: persist a session handoff

A session that ends without an agent turn has no guaranteed handoff.

Manual activation via Zecher:
- `"Zecher, scan projects in ~/dev"` — discover and index all projects
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
│   ├── karpathy-guardrails.md          ← 4 Karpathy principles + memory practices
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

## Project memory CLI

`mem` is the portable project journal and retrieval command. Ordinary lexical recall
needs no outcome records; optional evidence ranking requires an accepted/current
Nexus source and explicit project context scope. Inspect eligibility before using
an observation; success of the source task does not prove that its lesson caused it.

```sh
bmad-plus mem recall "cache values" --json
bmad-plus mem observe --input memory-observation.json --json
bmad-plus mem outcomes --json
bmad-plus mem recall "cache values" --ranking evidence --context-scope src/cache --json
```

The observation JSON names `runId`, `taskId`, `memory.file`, `memory.heading`,
`scope` and `interpretation`. It can name existing receipt IDs in `supersedes` or
`contradicts`. Shared project writers are serialized and duplicate task attempts
are refused. No note rewriting, agent installation changes, automatic portfolio
promotion or background observer is implied.

## Existing scanner and brain commands

```
npx bmad-plus scan [path]      — Scan and index projects interactively
npx bmad-plus memory status    — Show memory health report
npx bmad-plus memory export    — Export brain as portable archive
```
