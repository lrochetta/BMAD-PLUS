# Pack Memory — Persistent Brain for BMAD+

> 🧠 Give your AI agents a memory that persists across sessions, projects, and time.

## What is Pack Memory?

Pack Memory adds a **persistent brain** to BMAD+. Every decision logged, every lesson learned, every pattern discovered — they all survive between sessions. Your agents get smarter over time.

### Two Levels of Memory

| Level | Location | Scope |
|-------|----------|-------|
| **Project Memory** | `.agents/memory/` | Decisions, lessons, patterns for ONE project |
| **Global Brain** | `~/.bmad-plus/brain/` | Cross-project knowledge, user preferences, project index |

### The Golden Rule

> If info applies to **1 project** → project memory. If **2+ projects** → global brain.

## Features

### 🧠 Persistent Memory
- `decisions.md` — ADR-style architectural decisions with rationale
- `lessons.md` — Things that burned you, logged immediately, never repeated
- `patterns.md` — Validated solutions that work, ready to reuse
- `context.md` — Living project state, auto-updated by agents
- `sessions/` — Session handoffs for seamless context transfer

### 🔍 Project Scanner
- Scan any directory (or entire disk) to discover projects
- Auto-detect tech stack from project markers
- Interactive validation — you confirm each project before indexing
- Build a complete portfolio index in your global brain

### 🛡️ Karpathy Guardrails
Four behavioral principles (from Andrej Karpathy, 132K ⭐) woven into every agent:
1. **Think Before Coding** — Surface assumptions, don't guess
2. **Simplicity First** — Minimum code, nothing speculative
3. **Surgical Changes** — Touch only what you must
4. **Goal-Driven Execution** — Define success criteria, verify

### 🤖 Zecher Agent (זכר)
Dedicated memory agent that can:
- Consolidate and deduplicate memory entries
- Scan and index projects interactively
- Reconstruct context when starting a cold session
- Run memory health checks

## Installation

```bash
npx bmad-plus install
# Select "🧠 Memory — Persistent Brain" in the pack menu
```

### Brain Detection

If you already have a brain directory (`_brain/`, `~/.claude/memory/`, etc.), BMAD+ will:
- ✅ **Detect it** automatically
- ✅ **Link to it** — no duplication
- ❌ **Never overwrite** your existing memory

## Quick Start

After installation:

```
# Scan your projects
"Zecher, scan projects in D:\travail\DEV"

# Start remembering
"Atlas, create a PRD for..."    ← decisions auto-logged
"Forge, implement story S1"     ← patterns auto-detected

# Recall context
"Zecher, where were we?"        ← instant context reconstruction

# Maintain memory
"Zecher, health check"          ← verify integrity
"Zecher, consolidate memory"    ← deduplicate & archive
```

## File Structure

```
pack-memory/
├── README.md                     ← This file
├── memory-orchestrator.md        ← Pack entry point
├── zecher-agent.md               ← Memory Agent (Zecher)
├── shared/
│   ├── karpathy-guardrails.md    ← Behavioral guardrails
│   └── memory-protocol.md       ← Read/write protocol
└── templates/
    ├── decisions.md
    ├── lessons.md
    ├── patterns.md
    ├── context.md
    ├── session-handoff.md
    └── identity.yaml
```

## Credits

- Memory architecture inspired by Laurent Rochetta's `_brain/` methodology
- Behavioral guardrails adapted from [Andrej Karpathy](https://github.com/multica-ai/andrej-karpathy-skills) (MIT License)
- BMAD+ by [Laurent Rochetta](https://github.com/lrochetta/BMAD-PLUS)
