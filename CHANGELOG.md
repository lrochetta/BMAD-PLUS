# Changelog

All notable changes to BMAD+ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-03-17

### 🎉 Initial Release — Foundation

First release of BMAD+, an augmented fork of BMAD-METHOD v6.2.0.

### Added

#### Core Module (`src/bmad-plus/`)
- **module.yaml** — Module configuration with execution mode, auto-role activation, parallel execution, and modular pack system
- **module-help.csv** — Contextual help for all 8 registered skills/agents

#### 5 Multi-Role Agents
- **Atlas (Strategist)** — Fuses Analyst + PM into 2 switchable roles with auto-activation
- **Forge (Architect-Dev)** — Fuses Architect + Dev + Tech Writer into 3 switchable roles
- **Sentinel (Quality)** — Fuses QA + UX Designer into 2 switchable roles
- **Nexus (Orchestrator)** — Fuses SM + Quick-Flow + new Autopilot Controller + new Parallel Supervisor (4 roles)
- **Shadow (OSINT)** — Converted from legacy XML agent to BMAD+ v6 format (pack: osint)

#### 3 Custom Skills
- **bmad-plus-autopilot** — Full pipeline automation (Discovery → Build → Ship) with configurable checkpoints
- **bmad-plus-parallel** — Multi-agent parallel execution with orchestrator supervision (launch/stop/restart/reallocate/escalate)
- **bmad-plus-sync** — Upstream synchronization via VPS MCP Server

#### Auto-Activation System
- **role-triggers.yaml** — 3-level intelligent role switching:
  - Level 1: Pattern matching (keywords in user requests)
  - Level 2: Contextual analysis (domain detection during work)
  - Level 3: Reasoning chains (logical discoveries during execution)

#### Modular Pack System
- **Core pack** (required) — 4 agents, 3 skills, role-triggers
- **OSINT pack** (optional) — Shadow agent + OSINT investigation skills
- **Maker pack** (optional) — Maker meta-agent for creating new BMAD+ compatible agents (4-phase pipeline: Discovery → Design → Generation → Validation)
- **Audit pack** (coming soon) — Shield agent placeholder
- Multi-select installer menu with per-pack API key requirements

#### `npx bmad-plus install` CLI
- Interactive installer with pack selection, IDE auto-detection, user config
- Contextual post-install guide adapted to installed packs
- `--packs`, `--yes`, `--tools`, `--directory` flags for non-interactive use
- Uninstall command: `npx bmad-plus uninstall`

#### Monitoring System (`monitor/`)
- **weekly-check.py** — Weekly upstream monitoring script (cron)
- **ai_analyzer.py** — Gemini API-powered diff analysis (compatible/review/breaking)
- **notifier.py** — WhatsApp notifications via Evolution API + email fallback
- **mcp_bridge.py** — Bridge to Audit 360° MCP Server for VPS git/github operations
- **docker-compose.yml** — Evolution API container configuration
- **config.example.yaml** — Configuration template

#### Multi-IDE Support
- **CLAUDE.md** — Claude Code configuration
- **GEMINI.md** — Gemini CLI configuration
- **AGENTS.md** — Codex CLI / OpenCode configuration

#### Integration
- Integrated existing **osint-agent-package** (Shadow agent, 55+ Apify actors, 7 APIs)
- Integrated existing **mcp-server** (Audit 360° with 35 tools) via MCP Bridge

### Upstream Compatibility
- Based on BMAD-METHOD v6.2.0 (2026-03-15)
- Compatible with core versions 6.0.0 — 7.0.0
- Replaces `bmm` module while keeping core skills

---

*For earlier history, see the upstream [BMAD-METHOD CHANGELOG](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md).*
