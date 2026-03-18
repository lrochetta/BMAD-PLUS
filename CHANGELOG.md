# Changelog

All notable changes to BMAD+ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-03-19

### 🔧 SEO Engine Enhancements (Sprint 1)

### Added
- **SKILL.md orchestrator** — Single entry point routing 15 `/seo` commands to the right agents
- **seo_apis.py** — Google APIs client (PageSpeed Insights, CrUX field data, Rich Results Test)
- **requirements.txt** — Python dependencies (requests, beautifulsoup4, lxml)
- **install.sh + install.ps1** — Cross-platform dependency installer with venv support

---

## [0.3.0] — 2026-03-19

### 🚀 SEO Engine v2.0 — Complete Rewrite

### Added
- **3 multi-role SEO agents** (replacing single monolithic agent):
  - 🔎 **Scout** — Technical scanner (Crawler, Inspector, Photographer)
  - ⚖️ **Judge** — Content & AI analyst (Content Expert, Schema Master, GEO Analyst)
  - 👑 **Chief** — Strategist & reporter (Scorer, Strategist, Reporter)
- **4 Python scripts** (new toolkit):
  - `seo_fetch.py` — Secure HTTP fetcher with SSRF protection and multi-UA support
  - `seo_parse.py` — HTML parser for meta, schema, links, images, word count
  - `seo_crawl.py` — Recursive mini-crawler with sitemap parsing and orphan detection
  - `seo_screenshot.py` — Playwright viewport screenshots with above-fold analysis
- **6 reference documents**:
  - Core Web Vitals 2026 thresholds (LCP subparts, INP, CLS)
  - Schema.org v29.4 type catalog with deprecation status
  - E-E-A-T scoring grid (100-point evaluation)
  - GEO signals for AI search optimization (Google AI Overviews, ChatGPT, Perplexity)
  - Quality gates with content thresholds by page type
  - 14 ready-to-use JSON-LD schema templates
- **6-phase audit workflow** with PageSpeed perfection loop
- **SEO Health Score (0–100)** with 7 weighted categories
- **Auto-generated code fixes** for common SEO issues
- **13 user commands** (`/seo full`, `/seo quick`, `/seo pagespeed`, etc.)
- **Monitoring system** with historical score comparison

### Changed
- SEO Audit 360 pack upgraded from v1.0 to v2.0
- Architecture: single SKILL.md → 3 specialized agents with parallel execution

### Preserved
- `pagespeed-playbook.md` — Battle-tested oveanet.ch PageSpeed optimization loop
- `checklist.md` — Original PageSpeed perfection checklist

---

## [0.2.0] — 2026-03-18

### 🔀 Oveanet Fusion

### Added
- **3 new utility packs** from oveanet-agents:
  - 🔍 **SEO Audit 360** — 9-category audit for search engines + AI engines (by Oveanet)
  - 🗂️ **Universal Backup** — Timestamped ZIP backup with smart exclusions (by Oveanet)
  - 🎬 **Animated Website** — Luxury scroll-driven website from video (by Oveanet)
- `oveanet-pack/` directory as source for oveanet agent content
- Oveanet sync documentation in `process-info.md`

### Changed
- Installer now shows 7 packs (Core + OSINT + Maker + Audit + SEO + Backup + Animated)
- `package.json` includes `oveanet-pack` in npm distribution

### Removed
- `pour etudier/` directory (content migrated to `oveanet-pack/`)

---

## [0.1.3] — 2026-03-18

### 🔧 Cross-Platform Fix

### Fixed
- LF line endings for `bin` scripts (fixes `npx` execution on macOS/Linux)
- Added `.gitattributes` to enforce LF on executable scripts

---

## [0.1.2] — 2026-03-17

### 📝 Credits Update

### Changed
- Author credits translated to English in CLI installer and READMEs
- Added LinkedIn link to credits section

---

## [0.1.1] — 2026-03-17

### 👤 Author Attribution

### Added
- Laurent Rochetta credit in `README.md`, `README-DIST.md`, and CLI success message
- GitHub and LinkedIn links in credits section

---

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
