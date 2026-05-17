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
4. **Cross-project check** → Any lesson/pattern that applies to ALL projects? → Copy to global brain.

---

## The Golden Rule

> **If info applies to 1 project → project memory. If 2+ projects → global brain.**

---

## Merge Safety

When reinstalling BMAD+ or updating:
- **NEVER overwrite** decisions.md, lessons.md, patterns.md
- **NEVER delete** sessions/ directory
- **Safe to overwrite**: context.md template (user regenerates), identity.yaml template only if no user edits
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
path: "D:\\travail\\DEV\\my-project"
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
