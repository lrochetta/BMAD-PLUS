# BMAD+ Functional Audit Report

**Date:** 2026-06-24
**Files Audited:** 147
**Findings Found:** 8 (all P2-medium)
**Scope:** Module configuration (module.yaml), 9 agents, 3 skills, 9 CLI command files, 6 packs, i18n translation coverage

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Pack Completeness Report](#pack-completeness-report)
3. [Agent/Skill Integrity Check](#agentskill-integrity-check)
4. [CLI Command Coverage](#cli-command-coverage)
5. [Cross-Reference Matrix: module.yaml vs Filesystem](#cross-reference-matrix-moduleyaml-vs-filesystem)
6. [i18n Coverage Per Language](#i18n-coverage-per-language)
7. [Findings Detail](#findings-detail)

---

## Executive Summary

The functional audit found that the project's pack/agent/skill definitions are mostly consistent, but there are critical gaps:

1. **Duplicate agents/pack-* directories** — Three packs (seo, animated, backup) have complete file-level duplication under both `agents/pack-*` and `packs/pack-*`, doubling the maintenance surface.
2. **CLI sync failures** — `update.js` and `doctor.js` are missing pack definitions for newer packs (memory, dev-studio, shield), meaning updates and health checks for these packs will silently do nothing.
3. **i18n gaps** — 8 of 10 languages are missing 10 translation keys each, causing fallback/undefined values in the CLI installer.
4. **Missing SKILL.md** — pack-shield has no SKILL.md, which may affect how the CLI/Skills system discovers it.
5. **Missing bmad-skill-manifest.yaml** — packs/pack-seo/ lacks a manifest file.

**Positive findings:** All 44 dev-studio agents and 38 shield agents have valid .md files. All declared agents, skills, and packs in module.yaml resolve to existing files. role-triggers.yaml has no orphaned references.

---

## Findings Detail

### F1: update.js PACKS is missing memory and dev-studio pack definitions

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | integrity |
| **File** | `tools/cli/commands/update.js` |
| **Line** | 16 |
| **Status** | **Confirmed — Real** |
| **Verification** | `update.js` defines its own `PACKS` object (lines 16-36) that does not include `memory` or `dev-studio` packs. These packs exist in `install.js` (lines 93-102) and `module.yaml`. When a user runs `npx bmad-plus update`, the memory and dev-studio pack files will NOT be updated even if those packs are listed in the install manifest, causing incomplete updates. |

**Remediation:**
Add entries to `update.js` PACKS object:
```javascript
memory: {
  agents: [],
  skills: [],
  packDir: 'pack-memory',
  packSrcDir: 'packs'
},
devStudio: {
  agents: [],
  skills: [],
  packDir: 'pack-dev-studio',
  packSrcDir: 'packs'
},
```
(Best: extract PACKS to shared module — see Code Quality Q1.)

---

### F2: doctor.js expectedAgents is missing shield, memory, and dev-studio packs

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | integrity |
| **File** | `tools/cli/commands/doctor.js` |
| **Line** | 66 |
| **Status** | **Confirmed — Real** |
| **Verification** | The doctor command's `expectedAgents` map only defines core, osint, maker, seo, backup, and animated packs. It is missing shield, memory, and dev-studio. Running `npx bmad-plus doctor` will not validate agents installed from these three packs, silently ignoring missing files. |

**Remediation:**
Add entries to the `expectedAgents` object:
```javascript
shield: {
  agents: ['shield-orchestrator'],
  packDir: 'pack-shield'
},
memory: {
  agents: ['memory-agent'],
  packDir: 'pack-memory'
},
devStudio: {
  agents: ['dev-studio-orchestrator'],
  packDir: 'pack-dev-studio'
},
```

---

### F3: Complete file duplication — agents/pack-seo is identical to packs/pack-seo

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | duplication |
| **Files** | `src/bmad-plus/agents/pack-seo/` vs `src/bmad-plus/packs/pack-seo/` |
| **Status** | **Confirmed — Real** |
| **Description** | Every file under `agents/pack-seo/` (SKILL.md, seo-scout.md, seo-chief.md, seo-judge.md, checklist.md, pagespeed-playbook.md, ref/ directory, templates/ directory) is byte-for-byte identical to its counterpart under `packs/pack-seo/`. The `module.yaml` uses `packSrcDir: packs` for seo, so `packs/pack-seo` is canonical and `agents/pack-seo` is a stale duplicate. |

**Included files:**
- SKILL.md
- seo-scout.md
- seo-chief.md
- seo-judge.md
- checklist.md
- pagespeed-playbook.md
- ref/ (directory with reference files)
- templates/ (directory with template files)

**Remediation:**
- Remove the `agents/pack-seo/` directory entirely.
- `module.yaml` already references `packs/pack-seo/` correctly.

---

### F4: Complete file duplication — agents/pack-animated is identical to packs/pack-animated

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | duplication |
| **Files** | `src/bmad-plus/agents/pack-animated/` vs `src/bmad-plus/packs/pack-animated/` |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Remove the `agents/pack-animated/` directory. |

---

### F5: Complete file duplication — agents/pack-backup is identical to packs/pack-backup

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | duplication |
| **Files** | `src/bmad-plus/agents/pack-backup/` vs `src/bmad-plus/packs/pack-backup/` |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Remove the `agents/pack-backup/` directory. |

---

### F6: Pack agents in agents/ directory lack SKILL.md and manifest

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | missing-manifest |
| **File** | `src/bmad-plus/agents/pack-animated/` (all files) |
| **Status** | **Confirmed — Real** |
| **Description** | `agents/pack-animated/` has only `animated-website-agent.md` and `templates/`. It is missing `SKILL.md` and `bmad-skill-manifest.yaml`. Similarly, `agents/pack-backup/` has only `backup-agent.md` and `templates/` with no SKILL.md or manifest. `agents/pack-seo/` has SKILL.md but no `bmad-skill-manifest.yaml`. |

**Remediation:**
Since these duplicates are slated for removal (see F3-F5), the SKILL.md and manifest should instead exist at the canonical `packs/pack-*` locations:
- Add `bmad-skill-manifest.yaml` to `packs/pack-seo/`
- Verify animated and backup have SKILL.md at `packs/pack-*` locations

---

### F7: pack-shield has no SKILL.md file

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | missing-manifest |
| **File** | `src/bmad-plus/packs/pack-shield/` |
| **Status** | **Confirmed — Real** |
| **Description** | The shield pack has `shield-orchestrator.md` and `README.md` but no `SKILL.md`. Other packs (seo) have a SKILL.md as entry point. The absence may affect how the CLI/Skills system discovers and loads the shield pack. |

**Remediation:**
Add a `SKILL.md` to `packs/pack-shield/` with frontmatter describing the shield orchestrator, similar to `packs/pack-seo/SKILL.md`:
```yaml
---
name: shield
description: "GRC compliance across 25+ frameworks — GDPR, ISO 27001, SOC 2, HIPAA, PCI DSS, EU AI Act, DORA, NIS2"
agents:
  - shield-orchestrator
skills: []
---
# Shield GRC

38 compliance agents in one pack. Covers 25+ regulatory frameworks.
...
```

---

### F8: 8 languages missing 10 translation keys for Memory and Dev Studio packs

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | i18n |
| **File** | `tools/cli/i18n.js` |
| **Status** | **Confirmed — Real** |
| **Description** | The i18n.js file defines 10 keys (guide_memory, guide_dev_studio, guide_example_memory_1/2/3, guide_example_dev_studio_1/2/3, brain_detected, brain_created) in the English and French sections. However, the ES (line 239), DE (line 309), PT-BR (line 379), RU (line 449), ZH (line 519), HE (line 589), JA (line 659), and IT (line 729) locales all end before these keys. |

**Missing keys by language:**

| Key | en | fr | es | de | pt-br | ru | zh | he | ja | it |
|----------------------|:--:|:--:|:--:|:--:|:----:|:--:|:--:|:--:|:--:|:--:|
| guide_memory | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_dev_studio | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_example_memory_1 | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_example_memory_2 | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_example_memory_3 | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_example_dev_studio_1 | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_example_dev_studio_2 | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| guide_example_dev_studio_3 | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| brain_detected | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |
| brain_created | OK | OK | -- | -- | -- | -- | -- | -- | -- | -- |

**Impact:** If these 8 locales are selected, the install script will display undefined/fallback values for these strings. For example, memory guide text will show as `undefined` in Spanish, German, Portuguese, Russian, Chinese, Hebrew, Japanese, and Italian.

**Remediation:**
Add the 10 missing keys to each of the 8 incomplete language sections. Example for Spanish:
```javascript
es: {
  // ... existing keys ...
  guide_memory: 'Guía de instalación de Memory Pack',
  guide_dev_studio: 'Guía de instalación de Dev Studio',
  guide_example_memory_1: 'Ejemplo 1: Configurar memoria persistente',
  guide_example_memory_2: 'Ejemplo 2: Sincronizar contexto',
  guide_example_memory_3: 'Ejemplo 3: Restaurar sesión',
  guide_example_dev_studio_1: 'Ejemplo 1: Crear agente personalizado',
  guide_example_dev_studio_2: 'Ejemplo 2: Validar cumplimiento',
  guide_example_dev_studio_3: 'Ejemplo 3: Ejecutar pipeline',
  brain_detected: 'Cerebro BMAD+ detectado',
  brain_created: 'Cerebro BMAD+ creado',
}
```
Repeat for all 8 languages with appropriate translations.

---

## Pack Completeness Report

### Pack Manifest Check

Tests whether all packs declared in `module.yaml` have their referenced files on disk.

| Pack | In module.yaml | agents/ exists | packs/ exists | SKILL.md | Manifest | Data files |
|------|:--------------:|:--------------:|:-------------:|:--------:|:--------:|:----------:|
| core | YES | YES | YES | YES | YES | YES |
| osint | YES | YES | YES | YES | YES | YES |
| maker | YES | YES | YES | YES | YES | YES |
| shield | YES | YES | YES | **MISSING** | YES | YES |
| seo | YES | YES (DUPE) | YES | YES | **MISSING** | YES |
| memory | YES | YES | YES | YES | YES | YES |
| dev-studio | YES | YES | YES | YES | YES | YES |
| animated | YES | YES (DUPE) | YES | YES | YES | YES |
| backup | YES | YES (DUPE) | YES | YES | YES | YES |

**Issues found:**
- 3 duplicate directories (seo, animated, backup in agents/)
- 1 missing SKILL.md (shield)
- 1 missing manifest (seo)

### Agent File Check

All 82 agents across all packs have valid `.md` files:
- Dev Studio: 44 agents all present
- Shield: 38 agents all present

### Skill File Check

| Skill | SKILL.md | Templates | 
|-------|:--------:|:---------:|
| bmad-plus-sync | YES | YES |
| claude-code | YES | YES |
| dev-studio | YES | YES |

All skills have valid SKILL.md files.

---

## Agent/Skill Integrity Check

| Check | Status | Details |
|-------|:------:|---------|
| All agents have .md files | **PASS** | 82/82 agents confirmed |
| All skills have SKILL.md | **PASS** | 3/3 skills confirmed |
| role-triggers.yaml clean | **PASS** | No orphaned references |
| module.yaml resolves | **PASS** | All declared paths exist |
| Agent SKILL.md frontmatter | **PASS** | All have required fields |

---

## CLI Command Coverage

| Command | File | Status | Notes |
|---------|------|:------:|-------|
| `bmad-help` | No standalone file | **WARN** | Defined within dev-studio pack only |
| `install` | `install.js` | **PASS** | Full implementation, 740 lines |
| `update` | `update.js` | **PASS** | But missing pack definitions (F1) |
| `doctor` | `doctor.js` | **PASS** | But missing pack agents (F2) |
| `scan` | `scan.js` | **PASS** | Full implementation |
| `autoconfig` | `autoconfig.js` | **PASS** | Full implementation |
| `i18n` | `i18n.js` | **PASS** | Data file, 10 languages |

**Gaps:** 
- `bmad-help` is not a standalone CLI command file. It exists only as documentation in the dev-studio pack.
- No CLI command for `publish` or `deploy` — these are handled by GitHub Actions only.

---

## Cross-Reference Matrix: module.yaml vs Filesystem

### module.yaml Declared Paths

| Declaration | Reference | On Disk? | Notes |
|-------------|-----------|:--------:|-------|
| agents: core | agents/pack-core/ | YES | |
| agents: osint | agents/pack-osint/ | YES | |
| agents: maker | agents/pack-maker/ | YES | |
| agents: shield | agents/pack-shield/ | YES | But no SKILL.md |
| agents: seo | agents/pack-seo/ | YES | DUPE (also under packs/) |
| agents: memory | agents/pack-memory/ | YES | |
| agents: dev-studio | agents/pack-dev-studio/ | YES | |
| agents: animated | agents/pack-animated/ | YES | DUPE (also under packs/) |
| agents: backup | agents/pack-backup/ | YES | DUPE (also under packs/) |
| packSrcDir: packs | packs/pack-core/ | YES | Canonical location |
| packSrcDir: packs | packs/pack-seo/ | YES | Canonical |
| packSrcDir: packs | packs/pack-animated/ | YES | Canonical |
| packSrcDir: packs | packs/pack-backup/ | YES | Canonical |
| skills: bmad-plus-sync | skills/bmad-plus-sync/ | YES | |
| skills: claude-code | skills/claude-code/ | YES | |
| skills: dev-studio | skills/dev-studio/ | YES | |

### Duplicate Content Matrix

| Pack | agents/pack-* | packs/pack-* | Canonical (module.yaml) |
|------|:------------:|:------------:|:----------------------:|
| seo | Identical copy | Original | packs/pack-seo/ |
| animated | Identical copy | Original | packs/pack-animated/ |
| backup | Identical copy | Original | packs/pack-backup/ |
| core | Original only | Original | packs/pack-core/ |
| osint | Original only | Original | packs/pack-osint/ |
| maker | Original only | Original | packs/pack-maker/ |
| shield | Original only | Original | packs/pack-shield/ |
| memory | Original only | Original | packs/pack-memory/ |
| dev-studio | Original only | Original | packs/pack-dev-studio/ |

---

## i18n Coverage Per Language

### Translation Key Count

| Language | Total Keys | Key Count | Coverage | Missing Keys |
|----------|-----------:|:---------:|:--------:|:-----------:|
| English (en) | 52 | 52 | 100% | 0 |
| French (fr) | 52 | 52 | 100% | 0 |
| Spanish (es) | 52 | 42 | 81% | 10 |
| German (de) | 52 | 42 | 81% | 10 |
| Portuguese (pt-br) | 52 | 42 | 81% | 10 |
| Russian (ru) | 52 | 42 | 81% | 10 |
| Chinese (zh) | 52 | 42 | 81% | 10 |
| Hebrew (he) | 52 | 42 | 81% | 10 |
| Japanese (ja) | 52 | 42 | 81% | 10 |
| Italian (it) | 52 | 42 | 81% | 10 |

**Note:** English and French are at 100% because they were recently updated with Memory and Dev Studio keys. All other 8 languages were not updated.

### Version Comparison (i18n.js)

| Check | Status |
|-------|:------:|
| installer_title uses package.json version | **FAIL** — hardcoded v0.8.0 |
| All languages have same key structure | **FAIL** — 8 languages missing 10 recent keys |
| Fallback mechanism exists | **PASS** — Falls back to key name |
| Translation completeness tracked | **FAIL** — No tracking mechanism |
