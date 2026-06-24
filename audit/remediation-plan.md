# BMAD+ Remediation Plan

**Date:** 2026-06-24
**Total Findings:** 64 (merged, deduplicated)
**Estimated Total Effort:** ~32 hours
**Status:** 58/64 resolved (91%)

---

## Table of Contents
1. [Prioritized Findings Index](#prioritized-findings-index)
2. [Phase 0: P0 — Fix Immediately](#phase-0-p0--fix-immediately)
3. [Phase 1: P1 — Fix This Sprint](#phase-1-p1--fix-this-sprint)
4. [Phase 2: P2 — Fix Soon](#phase-2-p2--fix-soon)
5. [Phase 3: P3 — Nice to Have](#phase-3-p3--nice-to-have)
6. [Sprint Allocation](#sprint-allocation)
7. [Risk Matrix](#risk-matrix)
8. [Dependencies Between Fixes](#dependencies-between-fixes)

---

## Prioritized Findings Index

| ID | Source | Severity | Category | File | Effort | Status |
|:--:|:------:|:--------:|----------|------|:------:|:------:|
| R01 | Security | **P0** | Command Injection | `tools/bmad-plus-npx.js:24` | 30 min | **[x] Done** |
| R02 | Security | **P0** | Missing Authentication | `mcp-server/server.py` | 2 hours | **[x] Done** |
| R03 | Security | **P1** | Secrets Exposure | `.github/workflows/publish-distribution.yml:100` | 15 min | **[x] Done** |
| R04 | Security | **P1** | Destructive Operation | `.github/workflows/publish-distribution.yml:101` | 15 min | **[x] Done** |
| R05 | Security | **P1** | CI/CD Misconfiguration | `.github/workflows/publish-distribution.yml:114` | 15 min | **[x] Done** |
| R06 | Security | **P1** | Command Injection | `mcp-server/tools/ci_cd.py:16-17` | 30 min | **[x] Done** |
| R07 | Security | **P1** | Command Injection | `mcp-server/tools/ci_cd.py:240` | 30 min | **[x] Done** |
| R08 | Security | **P1** | Infrastructure Exposure | `mcp-server/server.py:7,25` + `mcp_bridge.py:25,109` | 30 min | **[x] Done** |
| R09 | Security | **P1** | Secret in URL | `oveanet-pack/seo-audit-360/scripts/seo_apis.py:68` | 10 min | **[x] Done** |
| R10 | Security | **P1** | Missing Authentication | `mcp-server/server.py:16` | 1 hour | **[x] Done** |
| R11 | Code Qual | **P1** | Code Duplication | `tools/cli/commands/{install,update,doctor}.js` | 2 hours | **[x] Done** |
| R12 | Code Qual | **P1** | Error Handling | `tools/cli/commands/autoconfig.js` | 1 hour | **[x] Done** |
| R13 | Code Qual | **P1** | Code Duplication | `tools/cli/commands/scan.js:221,282` | 30 min | **[x] Done** |
| R14 | Code Qual | **P1** | Architecture | `tools/cli/commands/install.js` (740 lines) | 3 hours | **[x] Done** |
| R15 | Code Qual | **P1** | Architecture | `mcp-server/tools/github_ops.py:12` + `orchestrator.py:44` | 15 min | **[x] Done** |
| R16 | Doc | **P1** | Config Files | `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` | 30 min | **[x] Done** |
| R17 | Doc | **P1** | Translation Error | `readme-international/README.fr.md:374,561` | 15 min | **[x] Done** |
| R18 | Doc | **P1** | CHANGELOG | `CHANGELOG.md` missing v0.7.2 | 10 min | **[x] Done** |
| R19 | Security | **P2** | Incomplete SSRF | `oveanet-pack/seo-audit-360/scripts/seo_fetch.py:73` | 30 min | **[x] Done** |
| R20 | Security | **P2** | Unsafe XML Parsing | `oveanet-pack/seo-audit-360/scripts/seo_crawl.py:119` | 15 min | **[x] Done** |
| R21 | Security | **P2** | Insecure Binding | `mcp-server/server.py:207` | 15 min | **[x] Done** |
| R22 | Security | **P2** | Insecure Loading | `mcp-server/ingest.py:49` | 30 min | **[x] Done** |
| R23 | Security | **P2** | Input Validation | `mcp-server/tools/github_ops.py:79` | 30 min | **[ ] Open** |
| R24 | Security | **P2** | CI/CD Misc | `.github/workflows/publish-distribution.yml:124` | 15 min | **[x] Done** |
| R25 | Security | **P2** | Unsafe HTML Parsing | `oveanet-pack/seo-audit-360/scripts/seo_crawl.py:137` | 15 min | **[x] Done** |
| R26 | Code Qual | **P2** | Error Handling | `mcp-server/server.py:33` (background subprocess) | 30 min | **[ ] Open** |
| R27 | Code Qual | **P2** | Input Validation | `mcp-server/tools/git_ops.py:15` | 30 min | **[ ] Open** |
| R28 | Code Qual | **P2** | Maintainability | `tools/cli/i18n.js:13` (hardcoded version) | 15 min | **[x] Done** |
| R29 | Code Qual | **P2** | Code Duplication | `install.js` + `update.js` file copy loops | 1 hour | **[x] Done** |
| R30 | Code Qual | **P2** | Dead Code | `mcp-server/server.py:56` (unused import glob) | 5 min | **[x] Done** |
| R31 | Code Qual | **P2** | Logging | `mcp-server/server.py` + tools (print() -> logging) | 2 hours | **[x] Done** |
| R32 | Code Qual | **P2** | Architecture | `mcp-server/server.py:159` (hardcoded tool counts) | 15 min | **[x] Done** |
| R33 | Code Qual | **P2** | Performance/Security | `mcp-server/tools/audit_engine.py:37` | 30 min | **[x] Done** |
| R34 | Code Qual | **P2** | Error Handling | `mcp-server/tools/ci_cd.py,gamma_report.py,rag_tools.py` (encoding) | 30 min | **[x] Done** |
| R35 | Code Qual | **P2** | Architecture | `monitor/weekly-check.py:26` (hardcoded constants) | 30 min | **[x] Done** |
| R36 | Code Qual | **P2** | Best Practices | `mcp-server/tools/gamma_report.py:79` (blocking sleep) | 1 hour | **[ ] Open** |
| R37 | Functional | **P2** | integrity | `tools/cli/commands/update.js:16` (missing packs) | 15 min | **[x] Done** |
| R38 | Functional | **P2** | integrity | `tools/cli/commands/doctor.js:66` (missing packs) | 15 min | **[x] Done** |
| R39 | Functional | **P2** | duplication | `src/bmad-plus/agents/pack-seo/` (full duplicate) | 15 min | **[x] Done** |
| R40 | Functional | **P2** | duplication | `src/bmad-plus/agents/pack-animated/` (full duplicate) | 10 min | **[x] Done** |
| R41 | Functional | **P2** | duplication | `src/bmad-plus/agents/pack-backup/` (full duplicate) | 10 min | **[x] Done** |
| R42 | Functional | **P2** | missing-manifest | `src/bmad-plus/packs/pack-shield/` (no SKILL.md) | 30 min | **[x] Done** |
| R43 | Functional | **P2** | missing-manifest | `src/bmad-plus/packs/pack-seo/` (no manifest) | 15 min | **[x] Done** |
| R44 | Functional | **P2** | i18n | `tools/cli/i18n.js` (8 languages missing 10 keys) | 1 hour | **[x] Done** |
| R45 | Doc | **P2** | Version History | `readme-international/README.{fr,es,de}.md` | 1 hour | **[x] Done** |
| R46 | Doc | **P2** | Credits | `readme-international/README.{fr,es}.md` | 30 min | **[x] Done** |
| R47 | Doc | **P2** | Typo | `readme-international/README.es.md:504` | 5 min | **[x] Done** |
| R48 | Doc | **P2** | Grammar | `readme-international/README.fr.md:35` | 5 min | **[x] Done** |
| R49 | Doc | **P2** | Comparison Table | `README.md`, `README-DIST.md`, all translations | 1 hour | **[x] Done** |
| R50 | Doc | **P2** | Missing Section | `AGENTS.md` (Project Structure) | 10 min | **[x] Done** |
| R51 | Security | **P3** | Plaintext Config | `monitor/config.example.yaml` | 15 min | **[x] Done** |
| R52 | Security | **P3** | Input Validation | `tools/cli/commands/scan.js:157` | 15 min | **[x] Done** |
| R53 | Security | **P3** | Input Validation | `tools/cli/commands/install.js:174` | 15 min | **[x] Done** |
| R54 | Security | **P3** | Missing HTTPS | `mcp-server/server.py:207` | 2 hours | **[ ] Open** |
| R55 | Security | **P3** | Insecure Default | `mcp-server/server.py:79` (dashboard_pass) | 15 min | **[x] Done** |
| R56 | Code Qual | **P3** | Maintainability | `tools/cli/commands/doctor.js:155` (fragile regex) | 15 min | **[x] Done** |
| R57 | Code Qual | **P3** | Best Practices | `tools/cli/commands/install.js` (process.exit()) | 30 min | **[x] Done** |
| R58 | Code Qual | **P3** | Naming | `mcp-server/tools/github_ops.py:7` (b64 alias) | 5 min | **[x] Done** |
| R59 | Code Qual | **P3** | Input Validation | `tools/cli/commands/scan.js:158` (parseInt) | 15 min | **[x] Done** |
| R60 | Code Qual | **P3** | Maintainability | `monitor/ai_analyzer.py,notifier.py` (shebangs) | 5 min | **[ ] Open** |
| R61 | Code Qual | **P3** | Maintainability | `mcp-server/server.py` (relative paths) | 30 min | **[x] Done** |
| R62 | Doc | **P3** | Config Files | `GEMINI.md` (missing Commit Rules, extra blank line) | 10 min | **[x] Done** |
| R63 | Doc | **P3** | Skill Ref | `CLAUDE.md` (bmad-help not standalone) | 30 min | **[x] Done** |
| R64 | Doc | **P3** | Slogan | `README.md` (What vs Why) | 15 min | **[x] Done** |

---

## Phase 0: P0 — Fix Immediately

### R01: Command injection in bmad-plus-npx.js **[x] Done**

| Field | Value |
|-------|-------|
| **Effort** | 30 minutes |
| **Risk if not fixed** | **Critical** — Any user running `npx bmad-plus` with crafted args executes arbitrary shell commands |
| **File** | `D:\travail\DEV\BMAD+\tools\bmad-plus-npx.js` |
| **Fix** | Replaced `execSync` with `spawnSync` at line 24 |

**Verification:** `spawnSync('node', [cliPath, ...args], { stdio: 'inherit' })` passes args as array elements — no shell parsing occurs.

---

### R02: Missing authentication on MCP Server SSE/tool endpoints **[x] Done**

| Field | Value |
|-------|-------|
| **Effort** | 2 hours |
| **Risk if not fixed** | **Critical** — 35+ tools exposed to any network-reachable attacker |
| **Files** | `D:\travail\DEV\BMAD+\mcp-server\server.py` (primary) |
| **Fix** | Added `verify_mcp_token()` middleware using FastAPI `HTTPBearer` dependency |

**Verification:** `mcp-server/server.py` line 43 defines `async def verify_mcp_token()` with `HTTPAuthorizationCredentials` dependency. Token validated against `MCP_AUDIT360_TOKEN` env var on every request.

---

## Phase 1: P1 — Fix This Sprint

All 16 P1 findings have been resolved.

### R03: PAT embedded in git remote URL **[x] Done**
- **File:** `.github/workflows/publish-distribution.yml:100`
- **Fix:** Token moved from URL to `extraheader` Authorization header (base64-encoded `:$DIST_PAT`)

### R04: Force push to master **[x] Done**
- **File:** `.github/workflows/publish-distribution.yml:101`
- **Fix:** `--force` flag removed from `git push distribution HEAD:master`

### R05: npm audit continues on error **[x] Done**
- **File:** `.github/workflows/publish-distribution.yml:114`
- **Fix:** `npm install --omit=dev --ignore-scripts` + `npm audit --audit-level=high` with blocking behavior

### R06: ci_run_command allowlist bypass **[x] Done**
- **File:** `mcp-server/tools/ci_cd.py:16-17`
- **Fix:** `"python -c"` and `"node "` removed from `ALLOWED_COMMANDS`. Prefix-matching validation retained.

### R07: ci_deploy arbitrary script execution **[x] Done**
- **File:** `mcp-server/tools/ci_cd.py:240`
- **Fix:** Deploy scripts validated against same `ALLOWED_COMMANDS` allowlist

### R08: Hardcoded VPS IP address **[x] Done**
- **Files:** `mcp-server/server.py`, `mcp-server/mcp_bridge.py`
- **Fix:** `VPS_HOST = os.getenv("VPS_HOST", "localhost:8000")` — no hardcoded IPs

### R09: API key in URL query string **[x] Done**
- **File:** `oveanet-pack/seo-audit-360/scripts/seo_apis.py:68`
- **Fix:** `requests.get(API_URL, params={"url": url, "key": API_KEY, ...})` — no string concatenation

### R10: MCP_TOKEN never validated **[x] Done**
- **File:** `mcp-server/server.py:16`
- **Fix:** Covered by R02. `MCP_AUDIT360_TOKEN` validated at startup and on every request.

### R11: Extract PACKS into shared module **[x] Done**
- **Files:** `tools/cli/commands/{install,update,doctor}.js` → `tools/cli/lib/packs.js`
- **Fix:** Created `tools/cli/lib/packs.js` with `PACKS`, `PACK_ORDER`, `EXPECTED_AGENTS` exports. All 3 commands import from it.

### R12: Add error handling to autoconfig.js empty catch blocks **[x] Done**
- **File:** `tools/cli/commands/autoconfig.js`
- **Fix:** All 9 empty catch blocks now have `console.warn()` or `clack.log.error()` with error message propagation.

### R13: Extract duplicated indexing loop in scan.js **[x] Done**
- **File:** `tools/cli/commands/scan.js`
- **Fix:** Created helper function `indexProject(project, globalBrainDir)` called from both code paths.

### R14: Refactor install.js (740 lines) **[x] Done**
- **File:** `tools/cli/commands/install.js`
- **Fix:** Extracted `tools/cli/lib/memory-init.js` (~86 lines), `tools/cli/lib/pack-copy.js` (shared with update.js). Now ~300 lines.

### R15: Remove hardcoded personal username **[x] Done**
- **Files:** `mcp-server/tools/github_ops.py`, `mcp-server/tools/orchestrator.py`
- **Fix:** `DEFAULT_OWNER = os.environ.get("GITHUB_USER", "")` — requires `GITHUB_USER` env var.

### R16: Add Maker and Zecher to CLAUDE.md, GEMINI.md, AGENTS.md **[x] Done**
- **Files:** `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`
- **Fix:** Maker (Agent Creator) and Zecher (Memory Guardian) added after Shadow entry in all 3 files.

### R17: Fix French translation error (56+ agents -> 6 agents) **[x] Done**
- **File:** `readme-international/README.fr.md`
- **Fix:** Dev Studio pack description corrected from "56+ agents" to "6 agents spécialisés SDLC".

### R18: Add missing CHANGELOG entry for v0.7.2 **[x] Done**
- **File:** `CHANGELOG.md`
- **Fix:** Added `[0.7.2]` entry with scan command fix.

---

## Phase 2: P2 — Fix Soon

### Command Injection & Input Validation (R19-R25)

| ID | Finding | Status |
|:--:|---------|:------:|
| R19 | SSRF protection incomplete — getaddrinfo with all A records | **[x] Done** |
| R20 | XML parsing without XXE protection — defusedxml | **[x] Done** |
| R21 | Bind to 127.0.0.1 instead of 0.0.0.0 | **[x] Done** |
| R22 | RAG ingester URL validation — domain allowlist added | **[x] Done** |
| R23 | github_push_files path validation — safe path check | **[ ] Open** |
| R24 | NPM_TOKEN scope — registry-url restriction | **[x] Done** |
| R25 | SEO regex HTML parsing — BeautifulSoup | **[x] Done** |

### Error Handling & Logging (R26-R36)

| ID | Finding | Status |
|:--:|---------|:------:|
| R26 | Background subprocess at import — should use async startup | **[ ] Open** |
| R27 | git_clone_repo URL validation — host allowlist | **[ ] Open** |
| R28 | Hardcoded version in i18n — read from package.json | **[x] Done** |
| R29 | File copy duplication — shared pack-copy.js | **[x] Done** |
| R30 | Remove unused import glob | **[x] Done** |
| R31 | Replace print() with logging module | **[x] Done** |
| R32 | Dynamic tool count from introspection | **[x] Done** |
| R33 | shutil.rmtree safety check | **[x] Done** |
| R34 | Add encoding='utf-8' to all file reads | **[x] Done** |
| R35 | Move monitor constants to config | **[x] Done** |
| R36 | Replace blocking sleep with asyncio | **[ ] Open** |

### Functional Integrity (R37-R44)

| ID | Finding | Status |
|:--:|---------|:------:|
| R37 | Add missing pack definitions to update.js | **[x] Done** |
| R38 | Add missing pack agents to doctor.js | **[x] Done** |
| R39 | Remove agents/pack-seo/ duplicate | **[x] Done** |
| R40 | Remove agents/pack-animated/ duplicate | **[x] Done** |
| R41 | Remove agents/pack-backup/ duplicate | **[x] Done** |
| R42 | Add SKILL.md to pack-shield/ | **[x] Done** |
| R43 | Add bmad-skill-manifest.yaml to pack-seo/ | **[x] Done** |
| R44 | Add 10 missing i18n keys to 8 languages | **[x] Done** |

### Documentation Sync (R45-R50)

| ID | Finding | Status |
|:--:|---------|:------:|
| R45 | Add missing version history to FR/ES/DE | **[x] Done** |
| R46 | Add full Credits to FR/ES | **[x] Done** |
| R47 | Fix Spanish typo | **[x] Done** |
| R48 | Fix French grammar | **[x] Done** |
| R49 | Standardize comparison tables | **[x] Done** |
| R50 | Add Project Structure to AGENTS.md | **[x] Done** |

---

## Phase 3: P3 — Nice to Have

### Low-Severity Fixes (R51-R64)

| ID | Finding | Category | Status |
|:--:|---------|----------|:------:|
| R51 | Use env vars for SMTP creds in monitor config | Security | **[x] Done** |
| R52 | Validate CLI numeric arguments (scan.js depth) | Security | **[x] Done** |
| R53 | Validate user name input (install.js) | Security | **[x] Done** |
| R54 | Configure TLS/HTTPS for MCP server | Security | **[ ] Open** |
| R55 | Make dashboard credentials required at startup | Security | **[x] Done** |
| R56 | Replace fragile regex with runtime import in doctor.js | Code Quality | **[x] Done** |
| R57 | Replace process.exit() with error throwing | Code Quality | **[x] Done** |
| R58 | Use full base64 import instead of b64 alias | Code Quality | **[x] Done** |
| R59 | Add parseInt validation with user warning | Code Quality | **[x] Done** |
| R60 | Remove shebangs from library modules | Code Quality | **[ ] Open** |
| R61 | Use BASE_DIR for all paths in server.py | Code Quality | **[x] Done** |
| R62 | Add Commit Rules to GEMINI.md, remove blank line | Doc | **[x] Done** |
| R63 | Create standalone bmad-help skill or add note | Doc | **[x] Done** |
| R64 | Standardize "What vs Why" heading across READMEs | Doc | **[x] Done** |

---

## Summary

| Phase | Severity | Total | Fixed | Remaining | Fix Rate |
|:-----:|:--------:|:-----:|:-----:|:---------:|:--------:|
| Phase 0 | P0 | 2 | 2 | 0 | **100%** |
| Phase 1 | P1 | 16 | 16 | 0 | **100%** |
| Phase 2 | P2 | 34 | 28 | 6 | **82%** |
| Phase 3 | P3 | 12 | 11 | 1 | **92%** |
| **Total** | | **64** | **58** | **6** | **91%** |

### Remaining Items

| ID | Severity | Description | File |
|:--:|:--------:|-------------|------|
| R23 | P2 | `github_push_files` path validation | `mcp-server/tools/github_ops.py:79` |
| R26 | P2 | Background subprocess at import time | `mcp-server/server.py:69,72` |
| R27 | P2 | `git_clone_repo` URL validation | `mcp-server/tools/git_ops.py:15` |
| R36 | P2 | Blocking `time.sleep()` in async loop | `mcp-server/tools/gamma_report.py:85` |
| R54 | P3 | TLS/HTTPS not configured | `mcp-server/server.py:302` |
| R60 | P3 | Shebangs on monitor scripts | `monitor/mcp_bridge.py:1`, `monitor/weekly-check.py:1` |
