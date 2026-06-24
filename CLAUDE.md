# BMAD+ — Claude Code Configuration

## Project Context
This is BMAD+, an augmented AI-driven development framework.
Based on BMAD-METHOD with multi-role agents, autopilot mode, and parallel execution.

## Agents
To activate an agent, say its name or persona:
- **Atlas** (Strategist) — Business analysis + Product management
- **Forge** (Architect-Dev) — Architecture + Development + Documentation
- **Sentinel** (Quality) — QA + UX review
- **Nexus** (Orchestrator) — Sprint management + Autopilot + Parallel execution
- **Shadow** (OSINT) — Investigation + Scraping + Psychoprofiling (if OSINT pack installed)
- **Maker** (Agent Creator) — Design, build, validate, and package new BMAD+ agents
- **Zecher** (Memory Guardian) — Persistent cross-session memory, context recall, session handoffs

## Skills
- Load skills from `src/bmad-plus/skills/` and `src/bmad-plus/agents/`
- Each agent has a SKILL.md with capabilities, activation protocol, and role-switching rules
- Auto-activation triggers are defined in `src/bmad-plus/data/role-triggers.yaml`

## Key Commands
- `bmad-help` — Show all available agents and skills
- `autopilot` — Launch Nexus in full pipeline mode
- `parallel` — Enable parallel multi-agent execution

> **Note:** `bmad-help` is a built-in CLI command, not a standalone skill file. It dynamically lists available agents and skills from the installed module configuration (`module.yaml`, `module-help.csv`). It does not have a corresponding skill file in `src/bmad-plus/skills/`.

## Project Structure
- `src/bmad-plus/` — Custom module (agents, skills, data)
- `monitor/` — Upstream monitoring system (VPS)
- `mcp-server/` — Audit 360° MCP Server
- `osint-agent-package/` — OSINT package
- `upstream/` — BMAD-METHOD reference clone

## Communication
Default language: French for user-facing content, English for code and technical docs.

## Commit Rules
- NEVER add "Co-Authored-By: Claude" or any AI co-author attribution.
- The sole author is Laurent Rochetta.

## Repository Maintenance Rule
When updating the main README.md (English), you MUST synchronously update all translations in the readme-international/ directory (fr, es, de).