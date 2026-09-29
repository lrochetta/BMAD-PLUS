# Pack Memory — Persistent Brain for BMAD+

> 🧠 Give your AI agents a memory that persists across sessions, projects, and time.

## What is Pack Memory?

Pack Memory stores decisions, lessons and patterns between sessions. Optional
project-local outcome evidence helps distinguish current verified sources from
stale or contradictory advice. Better downstream agent performance must be measured
separately; persistence alone does not establish it.

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
- `lessons.md` — Unexpected outcomes and lessons to review before similar work
- `patterns.md` — Validated solutions that work, ready to reuse
- `context.md` — Living project state, auto-updated by agents
- `sessions/` — Session handoffs for seamless context transfer

### 🔍 Project Scanner
- Scan any directory (or entire disk) to discover projects
- Auto-detect tech stack from project markers
- Interactive validation — you confirm each project before indexing
- Build a complete portfolio index in your global brain

### 🛡️ Karpathy Guardrails
Four behavioral principles from the community `andrej-karpathy-skills` project,
inspired by Andrej Karpathy's development guidance:
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

The npm pack provides file-based memory and requires Node.js only. Vector/RAG
recall is an optional, local-only enhancement through a separately deployed
MCP server. That server, its Python dependencies and its vector index are not
included in the npm package; `--provision-python` does not install them.
Missing RAG infrastructure does not disable Markdown memory or the project scanner.

### Verified project outcomes

The portable CLI supports `mem observe --input memory-observation.json` after an
independently verified Nexus task is accepted. The JSON input identifies `runId`,
`taskId`, one `memory` section (`file` and `heading`), its applicable `scope` paths
and the operator's `interpretation`. Optional `supersedes`/`contradicts` lists refer
to existing outcome receipt IDs. This association records provenance; it does not
prove that the lesson caused the task to succeed.

```sh
bmad-plus mem outcomes --json
bmad-plus mem recall "cache values" --ranking evidence --context-scope src/cache --json
```

The opt-in ranking rechecks source hashes and Nexus acceptance, excludes explicitly
stale/superseded/contradictory evidence and applies a bounded relevance-dependent
boost. `mem outcomes` explains eligibility. Default lexical recall is unchanged.
Failed, unverified and duplicate task attempts cannot supply successful evidence;
manually supplied `mem reinforce` signals do not influence this ranking. No vector
service, background observer, cross-project access or model training is required.

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
"Zecher, scan projects in ~/dev"

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
- Behavioral guardrails adapted from the community [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) project (plugin author: forrestchang; manifest declares MIT), inspired by Andrej Karpathy. See the distribution's third-party license notice.
- BMAD+ by [Laurent Rochetta](https://github.com/lrochetta/BMAD-PLUS)
