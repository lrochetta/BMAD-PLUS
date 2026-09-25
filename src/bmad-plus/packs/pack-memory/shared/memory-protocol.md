# Memory Protocol — When and How Agents Use Memory

> This protocol defines when BMAD+ agents should read from and write to the persistent memory system.

---

## Memory Locations

### Project Memory (per-project)
```
<project>/.agents/memory/
├── decisions.md        ← Architectural decisions for THIS project
├── lessons.md          ← Mistakes and surprises in THIS project
├── patterns.md         ← Validated patterns in THIS project
├── context.md          ← Living state (auto-updated)
└── sessions/           ← Session handoffs
    └── YYYY-MM-DD-<topic>.md
```

### Global Brain (cross-project)
```
~/.bmad-plus/brain/
├── identity.yaml       ← User preferences (stack, style, rules)
├── decisions.md        ← Cross-project decisions
├── lessons.md          ← Cross-project lessons
├── patterns.md         ← Reusable patterns
├── stack-preferences.md ← Default tech choices
└── projects/           ← Index of all BMAD+ projects
    └── <hash>.yaml     ← Per-project metadata
```

### Portfolio Brain (workspace-level, takes precedence)

If a `_brain/` directory exists in the project directory or any ancestor (e.g. `D:\workspace\_brain\` above `D:\workspace\clients\my-project\`), install links the project to it instead of `~/.bmad-plus/brain`. The `BMAD_PLUS_BRAIN` env var overrides all auto-detection.

The kind of brain that was linked is recorded in `.brain-link`:

```json
{ "linked_brain": "D:\\workspace\\_brain", "brain_type": "portfolio", "linked_at": "…" }
```

`brain_type` values: `portfolio` (workspace `_brain/` or env var) · `bmad-global` (`~/.bmad-plus/brain`) · `claude-memory` (`~/.claude/memory`).

**Rule for agents**: a portfolio brain has its **own** conventions and layout — read its entry point (`README.md` / `AGENTS.md` / `HOT.md`) first and follow them. Do NOT assume the BMAD+ global layout above; in particular do not create `identity.yaml` or `projects/` inside a portfolio brain uninvited.

---

## Protocol: Session Start (READ)

Every agent MUST perform this sequence at the start of a meaningful session:

1. **Read `identity.yaml`** (global) — Know the user's preferences
2. **Read `context.md`** (project) — Understand current state
3. **Read `decisions.md`** (project) — Don't re-decide what's already decided
4. **Read `lessons.md`** (project) — Don't repeat known mistakes
5. **Optionally read latest `sessions/`** — If resuming work

> If a file doesn't exist, skip it silently. Memory is always optional.

---

## Protocol: During Session (WRITE on trigger)

### Trigger → decisions.md
**When**: A non-obvious architectural or strategic choice is made.
**What**: ADR-style entry (Context, Decision, Rationale, Consequences, Status).
**Rule**: If you'd explain "why" to a colleague, it's a decision worth logging.

### Trigger → lessons.md
**When**: Something unexpected happens, a bug is caused by a non-obvious issue, or an assumption proved wrong.
**What**: Context, Impact, Lesson (the rule to follow next time).
**Rule**: Log IMMEDIATELY — don't wait for session end.

### Trigger → patterns.md
**When**: A solution works well and could be reused in other contexts.
**What**: Problem, Shape, Trade-off, Status (candidate → validated).
**Rule**: Only promote to global patterns.md if used in 2+ projects.

### Trigger → context.md
**When**: The project state changes meaningfully (new module, stack change, architecture shift).
**What**: Update the relevant section.
**Rule**: Keep it concise — this file should be readable in 30 seconds.

---

## Protocol: Session End (PERSIST)

If meaningful work was done:

1. **Write session handoff** → `sessions/YYYY-MM-DD-<topic>.md`
2. **Update `context.md`** → Reflect new reality
3. **Review pending lessons** → Any surprise worth logging?
4. **Cross-project check** → Propose applicable lessons for promotion. Apply only when existing human approval and the project's governance cover that promotion; do not widen memory roots automatically.

---

## The Golden Rule

> **If info applies to 1 project → project memory. If 2+ projects → consider a governed global promotion.**

## Outcome evidence and recall

Keep an interpretation separate from observed success. A successful narrative,
manual reward or completed process is insufficient: `bmad-plus mem observe --input
memory-observation.json` requires an independently verified, currently accepted
Nexus task. The input binds run/task, one exact Markdown heading, applicable task
scope and the proposed interpretation. Receipts record attempt/verifier IDs and
artifact/source hashes. One attempt supplies one receipt.

Use `bmad-plus mem outcomes --json` to inspect current eligibility. Optional
`mem recall "query" --ranking evidence --context-scope src/component --json`
rechecks the source and gives current relevant evidence a bounded boost. Unsupported
notes remain `unverified`; stale evidence, explicit supersession and unresolved
contradictions cannot silently present themselves as current advice. The default
lexical recall remains available. Do not infer a measured LLM-quality improvement
from a successful retrieval.

Contradiction and supersession refer to explicit existing receipt IDs; they do not
rewrite the underlying note or automatically promote it. Never manufacture a new
receipt ID to repeat support from the same task attempt. Shared memory writers use
`.bmad/memory/writer.lock`; after an interruption, inspect the exact owner and files
before any manual recovery. Do not remove a live writer's lock or auto-reset corrupt
outcome evidence. Existing portfolio approval and customization rules still apply.

---

## Merge Safety

When reinstalling BMAD+ or updating:
- **NEVER overwrite** decisions.md, lessons.md, patterns.md
- **NEVER delete** sessions/ directory
- **Preserve user edits**: context.md and identity.yaml; refresh templates only when unchanged ownership evidence or the user's request covers the change
- **Install manifest** (`.bmad-plus-install.json`) tracks what was installed, brain detection prevents overwrites

---

## Project Scanner Protocol

The `bmad-plus scan` command follows this protocol:

1. **Scan** target directory recursively for project markers (package.json, Cargo.toml, .git, etc.)
2. **Analyze** each discovered project (detect stack, status, last modified)
3. **Present** findings to user in interactive table
4. **User validates** each project (confirm, skip, edit metadata)
5. **Index** validated projects in `~/.bmad-plus/brain/projects/<hash>.yaml`
6. **Generate** project-level memory stubs if requested

### Project Detection Markers (priority order)
```
package.json          → Node.js / JavaScript
Cargo.toml            → Rust
requirements.txt      → Python
pyproject.toml        → Python
go.mod                → Go
composer.json         → PHP
Gemfile               → Ruby
*.sln / *.csproj      → .NET
pom.xml               → Java
build.gradle          → Java/Kotlin
.git                  → Any (version controlled)
AGENTS.md             → Already agent-aware
.agents/              → Already BMAD+ installed
```

### Project Metadata (per scan)
```yaml
# ~/.bmad-plus/brain/projects/<hash>.yaml
path: "~/dev/my-project"
name: "my-project"
hash: "a1b2c3d4"  # SHA256 of absolute path
stack:
  primary: "Node.js"
  framework: "Next.js 15"
  database: "PostgreSQL"
status: "active"          # active / paused / archived / unknown
last_modified: "2026-05-17"
last_scanned: "2026-05-17"
bmad_installed: true
packs_installed: ["core", "memory", "dev-studio"]
notes: "CRM client project"
```
