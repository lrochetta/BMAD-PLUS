# BMAD+ Documentation Audit Report

**Date:** 2026-06-24
**Files Audited:** 28
**Findings Found:** 13 (3 P1, 6 P2, 4 P3)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [P1 — High Findings](#p1-high-findings)
3. [P2 — Medium Findings](#p2-medium-findings)
4. [P3 — Low Findings](#p3-low-findings)
5. [README Sync Status Across All 5 Languages](#readme-sync-status-across-all-5-languages)
6. [Broken Links Report](#broken-links-report)
7. [Version Consistency Check](#version-consistency-check)
8. [CLAUDE.md vs Filesystem Diff](#claudemd-vs-filesystem-diff)
9. [Translation Quality Notes](#translation-quality-notes)

---

## Executive Summary

The documentation audit uncovered significant drift between the English canonical README and its translations, missing content in agent configuration files (CLAUDE.md, GEMINI.md, AGENTS.md), and a missing CHANGELOG entry. The most critical issues:

1. **CLAUDE.md, GEMINI.md, and AGENTS.md all list only 5 of 7 agents** — Maker and Zecher (Memory Guardian) agents exist on disk but are not mentioned in any configuration file.
2. **French README shows Dev Studio as "56+ agents" instead of 6** — A copy-paste error that makes Dev Studio sound much larger than it is.
3. **CHANGELOG.md is missing v0.7.2** despite the git tag existing.
4. **All 3 translations (FR, ES, DE) have truncated version history** — missing 7 versions between 0.2.0 and 0.4.4.
5. **French and Spanish READMEs have incomplete Credits sections** compared to English and German.

---

## P1 — High Findings

### D1: CLAUDE.md, GEMINI.md, AGENTS.md list only 5 of 7 available agents

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Config Files - Agent List Inconsistent |
| **Files** | `CLAUDE.md` (line 8), `GEMINI.md` (line 8), `AGENTS.md` (line 8) |
| **Status** | **Confirmed — Real** |
| **Description** | All three agent configuration files list only 5 agents (Atlas, Forge, Sentinel, Nexus, Shadow). **Maker** and **Zecher** (Memory Guardian) agents exist on disk (`agent-maker/` directory, `packs/pack-memory/`) and in `module.yaml` but are not mentioned in any configuration file. |

**Current text in all three files:**
```
## Agents
- **Atlas** (Strategist) — Business analysis + Product management
- **Forge** (Architect-Dev) — Architecture + Development + Documentation
- **Sentinel** (Quality) — QA + UX review
- **Nexus** (Orchestrator) — Sprint management + Autopilot + Parallel execution
- **Shadow** (OSINT) — Investigation + Scraping + Psychoprofiling (if OSINT pack installed)
```

**Remediation:**
Add Maker and Zecher to all three files:
```
- **Maker** (Agent Creator) — Design, build, validate, and package new BMAD+ agents
- **Zecher** (Memory Guardian) — Persistent cross-session memory, context recall, session handoffs
```

---

### D2: French README: Dev Studio shows '56+ agents' instead of '6 agents'

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Translation Error - Agent Count |
| **File** | `readme-international/README.fr.md` |
| **Lines** | 374, 561 |
| **Status** | **Confirmed — Real** |
| **Verification** | The French translation says '56+ agents specialized SDLC' in both the pack table (line 374) and version history (line 561). English, Spanish, and German versions correctly say '6 agents'. The '56+' count is for the Dev Studio **skills** (56 skills across 6 agents), not agents. |

**Lines to fix:**
- Line 374: `56+ agents specialized SDLC` -> `6 agents spécialisés SDLC`
- Line 561: `56+ agents specialized SDLC` -> `6 agents SDLC spécialisés`

**Note:** The '56+ skills' count in the English version at line 374 is also somewhat misleading — Dev Studio has 6 agents that collectively include 56+ skills. Consider clarifying the distinction.

---

### D3: CHANGELOG missing v0.7.2 entry despite existing git tag

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | CHANGELOG Incomplete |
| **File** | `CHANGELOG.md` |
| **Line** | 77 |
| **Status** | **Confirmed — Real** |
| **Verification** | Git tag `v0.7.2` exists pointing to commit `ffc7524` (`fix: scan accepts positional path argument`). `CHANGELOG.md` jumps from [0.7.1] directly to [0.7.3] with no entry for [0.7.2]. |

**Remediation:**
Add a [0.7.2] entry between [0.7.1] and [0.7.3]:
```markdown
## [0.7.2] - 2026-06-XX
### Fixed
- scan command: `bmad-plus scan <path>` now accepts a positional path argument
```

---

## P2 — Medium Findings

### D4: French, Spanish, German version history shows only 4 of 11 versions

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Translation - Version History Truncated |
| **Files** | `readme-international/README.fr.md` (line 555), `readme-international/README.es.md` (line 557), `readme-international/README.de.md` (line 543) |
| **Status** | **Confirmed — Real** |
| **Description** | The English version history (lines 535-548) lists 11 versions: 0.1.0, 0.2.0, 0.3.0, 0.4.0, 0.4.1, 0.4.2, 0.4.3, 0.4.4, 0.5.0, 0.6.0, 0.8.0. All three translations list only: 0.1.0, 0.5.0, 0.6.0, 0.8.0. Missing versions: 0.2.0, 0.3.0, 0.4.0, 0.4.1, 0.4.2, 0.4.3, 0.4.4. |

**Missing entries per translation:**

| Version | English | French | Spanish | German |
|---------|:------:|:------:|:-------:|:------:|
| 0.1.0 | OK | OK | OK | OK |
| 0.2.0 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.3.0 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.4.0 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.4.1 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.4.2 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.4.3 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.4.4 | OK | **MISSING** | **MISSING** | **MISSING** |
| 0.5.0 | OK | OK | OK | OK |
| 0.6.0 | OK | OK | OK | OK |
| 0.8.0 | OK | OK | OK | OK |

**Remediation:**
Sync all version history entries from the English README (lines 535-548) into the French, Spanish, and German READMEs, preserving the date and description but translating the descriptions appropriately.

---

### D5: French and Spanish READMEs have incomplete Credits sections

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Translation - Credits Incomplete |
| **Files** | `readme-international/README.fr.md` (lines 572-577), `readme-international/README.es.md` (lines 575-579) |
| **Status** | **Confirmed — Real** |
| **Description** | The French credits section lists only 3 items (BMAD-METHOD, OSINT Pipeline, Apify Actor Runner). It is missing: Creator attribution (Laurent Rochetta), Original Packs (Dev Studio, SEO Engine, Memory Pack), Shield GRC, Karpathy Guardrails, and Tools & Infrastructure sections. The Spanish version has the same omissions. The German version correctly matches the English canonical. |

**Remediation:**
Add the full Credits structure to French and Spanish READMEs:
1. **Creator:** Laurent Rochetta
2. **Original Packs:** Dev Studio, SEO Engine, Memory Pack
3. **External Sources & Inspirations:** BMAD-METHOD, OSINT Pipeline, Apify Actor Runner, Shield GRC, Karpathy Guardrails
4. **Tools & Infrastructure:** (e.g., used tools)

---

### D6: Spanish typo: 'Sicronización' should be 'Sincronización'

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Typo - Spanish |
| **File** | `readme-international/README.es.md` |
| **Line** | 504 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Change 'Sicronización' to 'Sincronización' on line 504. |

---

### D7: French grammar: 'framework excellent' should be 'excellent framework'

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Grammar - French |
| **File** | `readme-international/README.fr.md` |
| **Line** | 35 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Change 'un framework excellent' to 'un excellent framework' (adjective normally precedes the noun in French). |

---

### D8: Comparison table rows differ between English and translations

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Comparison Table Inconsistency |
| **File** | `README.md` (line 84), `readme-international/README.fr.md`, `readme-international/README.es.md`, `readme-international/README.de.md` |
| **Status** | **Confirmed — Real** |

**Comparison table row count by version:**

| Row | English | French | Spanish | German | README-DIST |
|-----|:-------:|:------:|:-------:|:------:|:----------:|
| 9 agents | OK | OK | OK | OK | OK |
| Manual activation | OK | OK | OK | OK | OK |
| No pipeline | OK | OK | OK | OK | OK |
| Sequential | OK | OK | OK | OK | OK |
| No persistent memory | **OK** | "No upstream tracking" | "No upstream tracking" | "No upstream tracking" | "No upstream tracking" |
| 1-2 IDEs | OK | OK | OK | OK | OK |
| 1 module | OK | **MISSING** | **MISSING** | **MISSING** | **MISSING** |
| 0 agents | OK | **MISSING** | **MISSING** | **MISSING** | **MISSING** |

**Issues:**
- Row 5: English says 'No persistent memory', translations/DIST say 'No upstream tracking' — different comparison metric
- Row 7: '1 module' exists in English only
- Row 8: '0 agents' exists in English only

**Remediation:**
Standardize the comparison table across all 5 READMEs. Either include all 8 rows in every version, or agree on a consistent subset.

---

### D9: AGENTS.md missing 'Project Structure' section

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Config Files - Missing Section |
| **File** | `AGENTS.md` |
| **Line** | 24 |
| **Status** | **Confirmed — Real** |
| **Description** | CLAUDE.md and GEMINI.md both have a 'Project Structure' section listing key directories. AGENTS.md ends after 'Repository Maintenance Rule' with no project structure listing. Codex CLI / OpenCode users get less contextual information. |

**Remediation:**
Add the Project Structure section to AGENTS.md matching CLAUDE.md:
```markdown
## Project Structure
- `src/bmad-plus/` — Custom module (agents, skills, data)
- `monitor/` — Upstream monitoring system (VPS)
- `mcp-server/` — Audit 360 MCP Server
- `osint-agent-package/` — OSINT package
- `upstream/` — BMAD-METHOD reference clone
```

---

## P3 — Low Findings

### D10: GEMINI.md missing 'Commit Rules' section and has extra blank line

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Config Files - Section Consistency |
| **File** | `GEMINI.md` |
| **Lines** | 34-35 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Add Commit Rules section: "**Commit Rules**: NEVER add Co-Authored-By: Claude." Also remove the extra blank line at lines 34-35. |

### D11: 'bmad-help' listed as a key command but is not a standalone skill file

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Skill Reference Inconsistency |
| **File** | `CLAUDE.md` (line 20) |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Either create a standalone `bmad-help` skill in `src/bmad-plus/skills/`, or add a note in CLAUDE.md that `bmad-help` requires the Dev Studio pack. |

### D12: Title mismatch — 'What is BMAD+?' vs 'Why BMAD+?'

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Slogan Inconsistency |
| **File** | `README.md` (line 31) |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Unify all versions to use the same heading. |

### D13: Shield pack description misleading in pack selection dialog

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Pack Selection Dialog Misleading |
| **File** | `README.md` (line 415), `READMe.fr.md` (line 363), `README.es.md` (line 363), `README.de.md` (line 359) |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Update the pack selection dialog description for Shield to match the pack table, e.g.: 'Shield GRC — 38 compliance agents (GDPR, ISO 27001, SOC 2, HIPAA, EU AI Act...)'. |

---

## README Sync Status Across All 5 Languages

### Section-by-Section Comparison

| Section | EN (canonical) | FR | ES | DE | DIST |
|---------|:--------------:|:--:|:--:|:--:|:----:|
| Title & badges | SYNCED | SYNCED | SYNCED | SYNCED | SYNCED |
| What is BMAD+? | ORIGINAL | "Why" | "Why" | "Why" | "Why" |
| At a Glance | INCLUDED | MISSING | MISSING | MISSING | MISSING |
| Domain table | INCLUDED | MISSING | MISSING | MISSING | MISSING |
| Comparison table (EN) | 8 rows | 6 rows | 6 rows | 6 rows | 6 rows |
| Features list | ORIGINAL | SYNCED | SYNCED | SYNCED | SYNCED |
| Architecture diagram | SYNCED | SYNCED | SYNCED | SYNCED | SYNCED |
| Agent descriptions | ORIGINAL | SYNCED | SYNCED | SYNCED | SYNCED |
| Pack table | SYNCED | SYNCED | SYNCED | SYNCED | SYNCED |
| Shield (pack table) | "38 compliance agents" | "38 compliance agents" | "38 compliance agents" | "38 compliance agents" | SYNCED |
| Shield (selection dialog) | "vulnerability scan" | "vulnerability scan" | "vulnerability scan" | "vulnerability scan" | SYNCED |
| Getting started | ORIGINAL | SYNCED | SYNCED | SYNCED | SYNCED |
| Version history | 11 versions | 4 versions | 4 versions | 4 versions | 7 versions |
| Credits | Full | Incomplete | Incomplete | Full | Full |
| Project status | SYNCED | SYNCED | SYNCED | SYNCED | SYNCED |
| License | SYNCED | SYNCED | SYNCED | SYNCED | SYNCED |

### Files Checked

| File | Path | Sync Status |
|------|------|:-----------:|
| English (canonical) | `README.md` | Reference |
| French | `readme-international/README.fr.md` | **DIVERGED** (various issues) |
| Spanish | `readme-international/README.es.md` | **DIVERGED** (various issues) |
| German | `readme-international/README.de.md` | **DIVERGED** (version history) |
| Distribution | `README-DIST.md` | **DIVERGED** (comparison table) |

---

## Broken Links Report

No automated checking was performed. Manual inspection found:
- All version badge URLs resolve correctly (img.shields.io)
- Repository links point to valid GitHub URLs
- Architecture diagram paths are relative and consistent
- No 404 errors in linked references

---

## Version Consistency Check

| Check | Status | Details |
|-------|:------:|---------|
| All badges show v0.8.0 | **PASS** | Consistent across all 5 READMEs |
| CHANGELOG has all versions | **FAIL** | Missing v0.7.2 |
| module.yaml version | **PASS** | matches 0.8.0 |
| package.json version | **PASS** | matches 0.8.0 |
| i18n installer_title | **FAIL** | Hardcoded v0.8.0 (will never update) |
| Git tags match CHANGELOG | **FAIL** | v0.7.2 tagged but not in CHANGELOG |

---

## CLAUDE.md vs Filesystem Diff

| Section | CLAUDE.md | Filesystem Reality | Match? |
|---------|-----------|-------------------|:------:|
| Agent list | 5 agents | 7 agents (Maker, Zecher missing) | **MISMATCH** |
| Skills path | `src/bmad-plus/skills/` | 3 skills exist | PASS |
| Agents path | `src/bmad-plus/agents/` | 9 packs exist | PASS |
| Key commands | bmad-help, autopilot, parallel | bmad-help not a standalone skill | **MISMATCH** |
| Project Structure | Listed | All paths exist | PASS |
| Repository Maintenance Rule | Present | Instructions valid | PASS |

---

## Translation Quality Notes

### French (`README.fr.md`)
- **Line 35:** `framework excellent` -> `excellent framework` (adjective position)
- **Line 374:** `56+ agents` -> `6 agents` (wrong count)
- **Line 561:** `56+ agents` -> `6 agents` (wrong count in version history)
- **Lines 572-577:** Credits incomplete (missing Creator, Original Packs, Shield GRC, Karpathy Guardrails, Tools sections)
- **Lines 555-565:** Version history truncated (4 of 11 versions)

### Spanish (`README.es.md`)
- **Line 504:** `Sicronización` -> `Sincronización` (typo)
- **Lines 575-579:** Credits incomplete (same omissions as French)
- **Lines 557-567:** Version history truncated (4 of 11 versions)

### German (`README.de.md`)
- **Lines 543-553:** Version history truncated (4 of 11 versions)
- Credits: Complete (matches English)

### Distribution (`README-DIST.md`)
- Comparison table: 6 rows (missing '1 module' and '0 agents' rows)
- Row 5: 'No upstream tracking' instead of 'No persistent memory'
- Version history: 7 versions (better than translations but still missing 4)
