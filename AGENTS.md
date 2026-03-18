# BMAD+ — Codex CLI / OpenCode Configuration

## Project Context
This is BMAD+, an augmented AI-driven development framework.
Based on BMAD-METHOD v6.2.0 with multi-role agents, autopilot mode, and parallel execution.

## Agents
To activate an agent, say its name or persona:
- **Atlas** (Strategist) — Business analysis + Product management
- **Forge** (Architect-Dev) — Architecture + Development + Documentation
- **Sentinel** (Quality) — QA + UX review
- **Nexus** (Orchestrator) — Sprint management + Autopilot + Parallel execution
- **Shadow** (OSINT) — Investigation + Scraping + Psychoprofiling (if OSINT pack installed)

## Skills
- Load skills from `src/bmad-plus/skills/` and `src/bmad-plus/agents/`
- Each agent has a SKILL.md with capabilities, activation protocol, and role-switching rules
- Auto-activation triggers are defined in `src/bmad-plus/data/role-triggers.yaml`

## Key Commands
- `bmad-help` — Show all available agents and skills
- `autopilot` — Launch Nexus in full pipeline mode
- `parallel` — Enable parallel multi-agent execution

## Communication
Default language: French for user-facing content, English for code and technical docs.


## Repository Maintenance Rule
When updating the main README.md (English), you MUST synchronously update all translations in the readme-international/ directory (fr, es, de).