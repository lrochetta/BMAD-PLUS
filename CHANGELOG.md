# Changelog

All notable changes to BMAD+ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] — 2026-06-24

### Added
- 3 new packs: pack-animated (web animation agent), pack-backup (universal backup agent), pack-seo (full SEO audit — 15 files with agents, refs, templates, playbooks)
- `extract_frames.py` script for animated-website (263 lines, ffprobe/ffmpeg)

### Security
- P0 remediation: fix command injection, path traversal, token-in-URL, wildcard hosts, error leak (Shield GRC v2.0)
- CI: add npm audit gate with continue-on-error, remove silent-fail pattern

### Changed
- README.de.md: full sync (+131 lines) — Pack System, Autopilot, Project Structure, Credits
- All Torah-named references removed from Dev Studio, module.yaml, READMEs
- Dev Studio: cleaned references in orchestrator, bwml-spec, upstream-sync
- process-info.md: updated (oveanet-pack not in npm package)
- CI: Windows %TEMP% → tmp/ in .npmignore and CI workflow
- Badge shields: version 0.7.5 → 0.8.0 across all 5 READMEs

### Fixed
- Broken TOC anchor links across all 5 READMEs (#the-56-agents)
- oveanet ↔ .agents mirror directories sync (31 files)

### Tests
- 143/143 tests passing ✅

## [0.7.5] — 2026-05-17

### 🩺 Quality & Compliance

### Added
- **MIT LICENSE** — Proper license file matching `package.json` declaration
- **PACKS↔module.yaml sync check** — New Check 9 in `npx bmad-plus doctor` that cross-validates install.js PACKS object against module.yaml packs, preventing invisible pack bugs
- **30 new unit tests** — Total now 97:
  - `scan.js` module validation (markers, skip dirs, options)
  - `autoconfig.js` function checks (detectStack, analyzeStructure, calculateHealth, recommendPacks)
  - `memory.js` subcommand and health score validation
  - PACKS↔module.yaml bidirectional sync (count + key match)
  - LICENSE file integrity
- **Global brain consolidation** — Promoted cross-project wisdom:
  - 1 lesson (PowerShell UTF-8 corruption)
  - 2 decisions (anti-regression protocol, i18n-first CLI)
  - 2 patterns (dual-tier memory, surgical edit protocol)

## [0.7.4] — 2026-05-17

### 🧠 Smart Autoconfig

### Added
- **`npx bmad-plus autoconfig`** — Smart project bootstrap:
  - **Existing projects**: analyzes stack, structure, health; auto-selects packs; populates memory
  - **New projects**: interactive wizard (type + description); initializes everything
  - Auto-preserves existing IDE configs (`--tools none` when configs detected)
  - Writes `context.md` with full project analysis for agent continuity
  - Shows contextual recommendations ("Talk to Forge to...", "Talk to Sentinel to...")

### Fixed
- `--tools none` installer crash (undefined IDE name)

## [0.7.3] — 2026-05-17

### 🎨 Scan UX Improvements

### Added
- **Scan legend** — Color-coded status legend displayed before the project table
- **`--active-days <n>`** — Custom threshold for "active" status (default: 30 days)
- **`--paused-days <n>`** — Custom threshold for "paused" status (default: 180 days)

## [0.7.2] - 2026-06-XX
### Fixed
- `scan` command: `bmad-plus scan <path>` now accepts a positional path argument

## [0.7.1] — 2026-05-17

### 🛠️ CLI Commands & Guardrails Injection

### Added
- **`npx bmad-plus scan [path]`** — Interactive project scanner
  - Recursive directory scan with stack auto-detection (Node.js, Rust, Python, Go, PHP, Ruby, Java)
  - Framework detection (Next.js, Nuxt, React, Vue, Svelte, Express, Electron, Tauri)
  - Status tracking (active/paused/archived based on last modified)
  - Interactive validation: index all, select, or skip
  - Auto-generates `projects-index.md` in global brain
- **`npx bmad-plus memory status`** — Memory health report
  - Shows project memory + global brain status
  - Entry counts, last modified dates, health score
  - Brain link detection
- **`npx bmad-plus memory export`** — Export brain as portable Markdown archive
- **Karpathy Guardrails injection** — 4 principles auto-injected into CLAUDE.md/GEMINI.md/AGENTS.md when Memory pack is installed
- **i18n** — Memory + Dev Studio keys for EN and FR (other languages use fallback)

## [0.7.0] — 2026-05-17

### 🧠 Pack Memory — Persistent Brain

### Added
- **Pack Memory** — Persistent cross-session memory system with brain detection
  - 🧠 **Zecher Agent** (זכר, "remembrance") — Memory archivist for consolidation, project scanning, context recall
  - 📁 **Project Memory** (`.agents/memory/`) — decisions.md, lessons.md, patterns.md, context.md, sessions/
  - 🌐 **Global Brain** (`~/.bmad-plus/brain/`) — Cross-project knowledge, identity, project index
  - 🔍 **Project Scanner** — Scan directories/disks, detect stacks, interactive validation, auto-index
  - 🛡️ **Karpathy Guardrails** — 4 behavioral principles (Think, Simplify, Surgical, Goal-driven) woven into agents
  - 📋 **Memory Protocol** — Complete read/write rules for when agents use memory
  - 🔗 **Brain Detection** — Detects existing `_brain/`, `~/.claude/memory/`, links instead of overwrites
  - 📝 **6 templates** — decisions, lessons, patterns, context, session-handoff, identity.yaml

### Changed
- CLI installer: brain detection step (4.5) with merge-safe logic
- IDE config generation: Zecher agent listed when memory pack selected
- Install guide: memory-specific examples (Zecher commands)

## [0.6.0] — 2026-05-17

### 🏗️ Pack Dev Studio — Full Software Development Lifecycle

### Added
- **Pack Dev Studio** — 6 specialized agents + 30 workflows covering the complete SDLC
  - 📊 **Analysis** (8): Miriam (Business Analyst), Huldah (Tech Writer), Product Brief, PRFAQ, Market/Domain/Technical Research
  - 📋 **Planning** (7): Yosef (Product Manager), Rachel (UX Designer), PRD Create/Edit/Validate, UX Design
  - 🏗️ **Architecture** (5+9 steps): Bezalel (System Architect), Create Architecture (8-step workflow), Epics & Stories, Readiness Check
  - 💻 **Implementation** (12): Oholiab (Senior Engineer), Sprint Planning, Dev Story (TDD cycle), Code Review, Quick Dev, Investigate
  - 🔧 **Utilities** (12): Distillator, Party Mode, Adversarial Review, Edge Case Hunter, Editorial Reviews, Advanced Elicitation
- **BWML** (BMAD+ Workflow Markup Language) — Proprietary DSL extending BMAD v6 XML with 12 new primitives:
  `<agent>`, `<parallel>`, `<loop>`, `<validate>`, `<guard>`, `<emit>`, `<context>`, `<memory>`, `<escalate>`, `<retry>`, `<fallback>`, `<metric>`
- **Dev Studio Orchestrator** — Intelligent routing across 5 phases with BWML-powered workflow definitions
- **Torah-named Personas** — Agents named after Torah figures matching their roles: Miriam, Huldah, Yosef, Rachel, Bezalel, Oholiab
- **Upstream Sync** — Tracking config for BMAD-METHOD v6.6.0 updates (commit `0f852a3`)
- **64 files** — 59 .md skills, module-help.csv, BWML spec, orchestrator, README, upstream-sync

### Changed
- **module.yaml** — Added dev-studio pack with 5 categories and cohabitation warning for Core pack
- **install.js** — IDE configs now include 6 Torah-named agents when Dev Studio is selected
- **Version reference** — Updated from BMAD-METHOD v6.2.0 to v6.6.0

## [0.5.0] — 2026-05-17

### 🛡️ Pack Shield — GRC Compliance (38 agents)

### Added
- **Pack Shield** — 38 expert compliance agents covering 25+ regulatory frameworks
  - 🔐 **Data Privacy** (5): GDPR, CCPA/CPRA, LGPD, DPDPA, ISO 27701
  - 🛡️ **Cybersecurity** (6): ISO 27001, NIST CSF 2.0, NIST 800-53, CIS Controls v8, NIS2, ISM
  - 🏢 **Industry Compliance** (6): SOC 2, PCI DSS v4.0, HIPAA, SWIFT CSP, DORA, FedRAMP
  - 🔒 **Defense & Export** (4): CMMC 2.0, ITAR, EAR, TSA
  - 🤖 **AI Governance** (3): EU AI Act, ISO 42001, NIST AI RMF
  - ♿ **Accessibility & ESG** (3): WCAG, Section 508, CSRD
  - 📋 **GDPR & AI Act Workflows** (11): DPIA, Breach Response, LIA, Privacy Notices/Policies, Cookie Compliance, AI Act Classification/Roles/FRIA/Incidents
- **Shield Orchestrator** — Intelligent routing across all 38 agents with cross-framework mapping
- **85 Reference Files** — Deep regulatory knowledge extracted from upstream Claude Skills archives
- **3 Shared Templates** — Gap Analysis, Cross-Framework Mapper, Audit Report
- **Upstream Sync System** — Tracking configuration for Sushegaad GRC skill updates
- **module.yaml** — Full shield pack definition with 7 categories and per-category agent lists
- **CLI Integration** — Shield pack selectable in `npx bmad-plus install` with 3 localized example commands
- **IDE Config** — Shield agent advertised in generated AGENTS.md/GEMINI.md

### Changed
- **install_packs** — All packs now listed in multiselect (seo, backup, animated were missing)
- **module.yaml** — Replaced old `audit` (coming_soon) stub with fully realized `shield` pack

### Attribution
- Based on [Claude Skills for GRC](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) by Hemant Naik — MIT License
- GDPR/EU AI Act workflows inspired by [Lawve.ai](https://lawve.ai) professional skills catalog

---

## [0.4.4] — 2026-05-17

### 🔧 Encoding Fix + i18n Complete + Tests

### Fixed
- **UTF-8 encoding** — Fixed double-encoding corruption in `i18n.js` caused by PowerShell `Set-Content`
- **Credits URL** — Now points to public repo `github.com/lrochetta/BMAD-PLUS`
- **npm re-publish** — v0.4.3 had corrupted Unicode on npm; this release replaces it

### Added
- **Complete i18n** — CLI guide strings (commands, examples) now translated in all 10 languages (no more EN fallbacks)
- **Unit tests** — 53+ tests covering i18n, CLI modules, package.json integrity, module.yaml, source files, version consistency
- **`npm test`** — Jest test script added to package.json

---

## [0.4.3] — 2026-05-17

### 🔧 CLI Commands + Security Hardening + UX Enhancements

### Added
- **`bmad-plus update`** — Update agents & skills while preserving config, IDE configs, and output directories
- **`bmad-plus doctor`** — Check installation integrity (version, agents, configs, pack health)
- **Internationalized `uninstall`** — Uses i18n system from install manifest language (10 languages)
- **Credits at startup** — Author attribution displayed immediately when installer launches
- **Enriched post-install guide** — CLI commands section + pack-specific usage examples in selected language
- **i18n strings for update/uninstall/doctor** — EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA, IT
- **CLI guide strings** — `guide_cli_title`, `guide_examples_title`, pack examples for SEO/Backup/Animated/OSINT

### Fixed
- **Security** — Added `mcp-server/.env` to `.gitignore`, created `.env.example` template
- **Manifest version** — Now reads from `package.json` dynamically (was hardcoded `0.4.0`)
- **`module.yaml` sync** — Added missing SEO, Backup, Animated pack definitions
- **`package.json` cleanup** — Removed `oveanet-pack` from `files[]` (already excluded by `.npmignore`)
- **CI/CD reliability** — Removed `continue-on-error` from npm publish step
- **Comment accuracy** — Updated "9 languages" → "10 languages" in install.js header
- **Installer title** — Now reads version from `package.json` dynamically

### Changed
- **Dependencies** — Updated `@clack/prompts` 1.1.0 → 1.4.0, `fs-extra` 11.3.4 → 11.3.5
- **npm scripts** — Added `update:bmad` and `doctor:bmad` scripts

---

## [0.4.2] — 2026-03-19

### 📦 Public Packs — SEO/Backup/Animated now in npm

### Added
- **Public pack agents** — SEO Audit 360, Universal Backup, Animated Website agent files now included in npm package
- Agent files copied from `oveanet-pack/` to `src/bmad-plus/agents/pack-seo/`, `pack-backup/`, `pack-animated/`
- Installer `packDir` system replaces `oveanetAgent` for proper npm distribution

---

## [0.4.1] — 2026-03-19

### 🌐 CLI Internationalization + DevOps Hardening

### Added
- **10-language CLI installer** — EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA, IT with language selector at startup
- **CI/CD pipeline** — `publish-distribution.yml` GitHub Action (Golden → Public repo scrubbing)
- **`.npmignore`** — Excludes private directories from npm package
- **`/deploy` workflow** — Mandatory pre-deployment checklist
- **Post-install guide** — Enriched with all packs (SEO, Backup, Animated Website)

### Fixed
- **Security** — Purged `secrets/github_pat.txt` from git history, fixed `.gitignore` UTF-16 corruption
- **Version badges** — Updated from 0.1.0 → 0.4.1 across all 5 READMEs
- **Project structure** — Updated trees in both Golden and Distribution READMEs

---

## [0.4.0] — 2026-03-19

### 🏢 SEO Engine — Enterprise Extensions (Sprint 4)

### Added
- **Google Search Console extension** — OAuth2 client for organic search data (queries, pages, coverage, sitemaps)
- **Google Analytics 4 extension** — GA4 Data API client for organic traffic, landing pages, and engagement metrics
- Both extensions include setup guides, Python clients, and separate requirements

### Notes
- Extensions are **optional** and require OAuth2 setup (see `EXTENSION.md` in each directory)
- Core SEO Engine (SKILL.md + 3 agents + Python toolkit) works without extensions
- GSC and GA4 share OAuth2 credentials for simplified auth flow

---

## [0.3.3] — 2026-03-19

### 🧪 SEO Engine — Quality & Security (Sprint 3)

### Added
- **Unit tests** — 50 pytest tests covering all Python scripts (fetch, parse, crawl, APIs)
- **Pre-commit hook** — `hooks/seo-check.sh` validates HTML for title, meta, alt, H1 before commit
- **Audit JSON schema** — `ref/audit-schema.json` standardized export format for dashboard/API integration
- **Test fixture** — `tests/fixtures/sample_page.html` with known SEO elements

---

## [0.3.2] — 2026-03-19

### 📊 SEO Engine — Reports, Competitor & Hreflang (Sprint 2)

### Added
- **seo_report.py** — Professional HTML report generator with inline SVG radar chart, color-coded issue cards, quick wins section, and print-friendly CSS
- **Benchmarker role** — Added to Chief agent for `/seo competitor` command (side-by-side site comparison with delta scoring)
- **hreflang-rules.md** — Complete hreflang audit reference with 7 validation rules, 6 common error patterns, and 12-point checklist

---

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
