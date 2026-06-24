# BMAD+ Code Quality Audit Report

**Date:** 2026-06-24
**Files Audited:** 21
**Findings Found:** 21 (4 P1, 12 P2, 5 P3)
**Cross-cutting issues:** Code duplication, error handling, architecture violations

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [P1 — High Findings](#p1-high-findings)
3. [P2 — Medium Findings](#p2-medium-findings)
4. [P3 — Low Findings](#p3-low-findings)
5. [Architecture Assessment](#architecture-assessment)
6. [Code Duplication Report](#code-duplication-report)
7. [Error Handling Coverage](#error-handling-coverage)
8. [Best Practices Violations](#best-practices-violations)

---

## Executive Summary

The code quality audit found significant structural problems in the project's CLI tools, MCP server, and monitor modules. The most critical issues are:

1. **PACKS definition duplicated across three files** (`install.js`, `update.js`, `doctor.js`) with different schemas — adding a new pack requires editing all three files, inevitably leading to drift.
2. **9 empty catch blocks in autoconfig.js** silently swallowing errors, including failed installations.
3. **Duplicated project indexing loop within scan.js** — the same 18-line block appears twice (copy-paste).
4. **install.js** is 740 lines with 8+ distinct responsibilities violating single-responsibility principle.
5. **Hardcoded personal username** (`lrochetta`) in production MCP server code.
6. **No logging infrastructure** — the entire MCP server uses `print()` statements.

Cross-cutting: many issues relate to the security audit findings (hardcoded values, input validation gaps, error handling).

---

## P1 — High Findings

### Q1: PACKS definition duplicated across three files with inconsistent schemas

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Code Duplication |
| **Files** | `tools/cli/commands/install.js` (lines 18-103), `tools/cli/commands/update.js` (lines 16-36), `tools/cli/commands/doctor.js` (lines 66-73) |
| **Status** | **Confirmed — Real** |
| **Verification** | `install.js` has full schema (13 packs with icons, descriptions, packDir, packSrcDir, agents, skills). `update.js` has reduced schema (9 packs, no icons, missing memory/dev-studio/animated). `doctor.js` has minimal schema (6 packs, expectedAgents only, missing shield/memory/dev-studio). See also functional audit findings F1 (update.js missing packs) and F2 (doctor.js missing packs). |

| Pack | install.js | update.js | doctor.js |
|------|:----------:|:---------:|:---------:|
| core | Yes | Yes | Yes |
| osint | Yes | Yes | Yes |
| maker | Yes | Yes | Yes |
| shield | Yes | Yes | **MISSING** |
| seo | Yes | Yes | Yes |
| memory | Yes | **MISSING** | **MISSING** |
| dev-studio | Yes | **MISSING** | **MISSING** |
| backup | Yes | **MISSING** | Yes |
| animated | Yes | **MISSING** | Yes |

**Remediation:**
- Extract PACKS into `tools/cli/lib/packs.js` (or `tools/cli/packs.js`):
```javascript
// tools/cli/packs.js — single source of truth
const PACKS = {
  core:     { name: "Core",     icon: "b", agents: ["all"], skills: ["all"], packDir: "pack-core",     packSrcDir: "packs" },
  osint:    { name: "OSINT",    icon: "j", agents: ["all"], skills: ["all"], packDir: "pack-osint",    packSrcDir: "packs" },
  maker:    { name: "Maker",    icon: "f", agents: ["all"], skills: ["all"], packDir: "pack-maker",    packSrcDir: "packs" },
  shield:   { name: "Shield",   icon: "m", agents: ["all"], skills: ["all"], packDir: "pack-shield",   packSrcDir: "packs" },
  seo:      { name: "SEO",      icon: "k", agents: ["all"], skills: ["all"], packDir: "pack-seo",      packSrcDir: "packs" },
  memory:   { name: "Memory",   icon: "x", agents: ["all"], skills: ["all"], packDir: "pack-memory",   packSrcDir: "packs" },
  animated: { name: "Animated", icon: "z", agents: ["all"], skills: ["all"], packDir: "pack-animated", packSrcDir: "packs" },
  backup:   { name: "Backup",   icon: "y", agents: ["all"], skills: ["all"], packDir: "pack-backup",   packSrcDir: "packs" },
  devStudio:{ name: "Dev Studio",icon:"v", agents: ["all"], skills: ["all"], packDir: "pack-dev-studio",packSrcDir: "packs" },
};
```
- Import in `install.js`, `update.js`, and `doctor.js`:
```javascript
const { PACKS, getPackNames, getPackAgents } = require('../packs');
```

---

### Q2: Empty catch blocks silently swallow all errors in autoconfig.js

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Error Handling |
| **File** | `tools/cli/commands/autoconfig.js` |
| **Lines** | 30, 56, 93, 118, 203, 253, 339, 347, 445 |
| **Status** | **Confirmed — Real** |
| **Verification** | 9 empty `catch` blocks across the file. Lines 339-348 and 438-445 have empty catch blocks around installation module calls, making failed installations completely invisible. The JSON.parse failure at line 29-30 silently returns incomplete package data. |

**Full list of empty catch locations:**
| Line | Context | Impact |
|:----:|---------|--------|
| 30 | JSON.parse package.json | Silent fallback to empty object |
| 56 | JSON.parse package.json | Silent fallback to empty object |
| 93 | Error in language/locale detection | Falls back to English silently |
| 118 | IDE config parsing | Silent fallback |
| 203 | File existence check | Silent skip |
| 253 | File read | Silent fallback |
| 339 | Module installation call | **Failed installation invisible** |
| 347 | Module installation call | **Failed installation invisible** |
| 445 | Module installation call | **Failed installation invisible** |

**Remediation:**
Replace every empty catch block with at minimum:
```javascript
catch (err) {
  console.warn(`[autoconfig] Warning: ${err.message}`);
}
```
For critical operations (lines 339, 347, 445), propagate the error:
```javascript
catch (err) {
  clack.log.error(`Installation failed: ${err.message}`);
  throw err;  // or handle gracefully but notify user
}
```

---

### Q3: Project indexing loop duplicated within scan.js

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Code Duplication |
| **File** | `tools/cli/commands/scan.js` |
| **Lines** | 221-238, 282-301 |
| **Status** | **Confirmed — Real** |
| **Verification** | The same project indexing code (hash generation, metadata construction, YAML writing) appears at lines 221-238 (auto-index mode) and 282-301 (interactive mode). These are byte-for-byte identical. |

**Remediation:**
Extract into a helper function:
```javascript
function indexProject(project, globalBrainDir) {
  const hash = crypto.createHash('sha256')
    .update(project.path)
    .digest('hex')
    .substring(0, 12);

  const metadata = {
    name: project.name,
    path: project.path,
    hash: hash,
    indexedAt: new Date().toISOString(),
  };

  const projectDir = path.join(globalBrainDir, hash);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, '.bmad-meta.yaml'),
    yaml.dump(metadata)
  );

  return metadata;
}
```
Then call `indexProject(project, globalBrainDir)` from both code paths.

---

### Q4: install.js is 740 lines with 8+ distinct responsibilities

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Architecture |
| **File** | `tools/cli/commands/install.js` |
| **Line** | 138 |
| **Status** | **Confirmed — Real** |
| **Verification** | `install.js` handles at least 8 distinct responsibilities: (1) language selection, (2) pack selection UI, (3) IDE detection, (4) file copying, (5) memory initialization (90+ lines, lines 362-448), (6) brain detection, (7) IDE config generation, (8) project indexing, (9) getting-started guide generation, (10) install manifest writing. |

**Remediation:**
- Extract **memory initialization** into `tools/cli/lib/memory-init.js` (lines 362-448, ~86 lines)
- Extract **IDE config generation** into `tools/cli/lib/ide-config.js`
- Extract **pack file copying** into `tools/cli/lib/pack-copy.js` (shared with update.js)
- Keep `install.js` focused on orchestration only

---

### Q5: Hardcoded personal username 'lrochetta' in production MCP server code

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Architecture |
| **Files** | `mcp-server/tools/github_ops.py` (line 12), `mcp-server/tools/orchestrator.py` (line 44) |
| **Status** | **Confirmed — Real** |
| **Verification** | `github_ops.py` line 12: `DEFAULT_OWNER = "lrochetta"`. `orchestrator.py` line 44: `GITHUB_USER = "lrochetta"`. These are hardcoded fallback values on the production VPS-hosted server. If the `GITHUB_USER` env var is unset, the server defaults to the author's personal GitHub account. |

**Remediation:**
- Remove all hardcoded personal usernames
- Require `GITHUB_USER` to be set via environment variable, crash on startup if missing:
```python
GITHUB_USER = os.environ["GITHUB_USER"]  # KeyError if unset — intentional
```

---

## P2 — Medium Findings

### Q6: Background subprocess launched at module import with no error handling

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Error Handling |
| **File** | `mcp-server/server.py` |
| **Line** | 33 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Replace with a proper async startup task. Add error logging and a health check endpoint for RAG status. |

### Q7: git_clone_repo accepts arbitrary URLs with no validation

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Input Validation |
| **File** | `mcp-server/tools/git_ops.py` |
| **Line** | 15 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Add URL validation: restrict to known hosts (github.com, gitlab.com, etc.), require HTTPS only, or use a domain allowlist. See Security F14 for code. |

### Q8: Hardcoded version v0.8.0 in installer_title across all 10 languages

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Maintainability |
| **File** | `tools/cli/i18n.js` |
| **Line** | 13 |
| **Status** | **Confirmed — Real** |
| **Verification:** | Every language entry has `installer_title: "BMAD+ Installer v0.8.0"`. This will never update when the package version changes. |
| **Remediation:** | Remove `installer_title` from i18n.js. Construct it at runtime by reading from `package.json` version. |

### Q9: File copy loops duplicated between install.js and update.js

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Code Duplication |
| **Files** | `tools/cli/commands/install.js` (lines 305-348), `tools/cli/commands/update.js` (lines 95-148) |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Create shared helper `copyPackContents(pack, bmadSrc, destDir)` in `tools/cli/lib/pack-copy.js`. Call from both files. |

### Q10: Unused import 'glob' module

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Dead Code |
| **File** | `mcp-server/server.py` |
| **Line** | 56 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Remove `import glob`. |

### Q11: print() used for all server logging instead of structured logging

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Logging |
| **File** | `mcp-server/server.py` (lines 35, 36, 49, 202-204) |
| **Status** | **Confirmed — Real** |
| **Also affected:** | `mcp-server/tools/ci_cd.py`, `mcp-server/tools/git_ops.py`, all monitor files |
| **Remediation:** | Replace `print()` with Python's `logging` module. Add appropriate log levels (info, warning, error, debug). Configure log format with timestamps. Example: |
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)
# Replace print("Starting...") with logger.info("Starting...")
```

### Q12: Hardcoded tool counts in API response will go out of sync

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Architecture |
| **File** | `mcp-server/server.py` |
| **Line** | 165 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Compute tool counts dynamically: `tools_count = len(mcp._tools)` (introspection of registered tools). |

### Q13: shutil.rmtree on user-supplied path without safety checks

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Performance / Security |
| **File** | `mcp-server/tools/audit_engine.py` |
| **Line** | 37 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Validate `project_name` before path construction. Verify `clone_dir` is inside the expected temp directory before deleting. Use UUID-based subdirectory for each clone. |

### Q14: File reads without encoding specification

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Error Handling |
| **Files** | `mcp-server/tools/ci_cd.py` (lines 156, 166, 178, 186), `mcp-server/tools/gamma_report.py` (line 152), `mcp-server/tools/rag_tools.py` (lines 67-68), `mcp-server/tools/audit_engine.py` |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Add `encoding='utf-8'` to all `open()` calls for text files: `open(rf, 'r', encoding='utf-8')`. |

### Q15: Module-level global constants should be configuration-driven

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Architecture |
| **File** | `monitor/weekly-check.py` |
| **Line** | 26 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Move `UPSTREAM_REPO` and paths into `config.yaml`. Allow override via environment variables or CLI arguments. |

### Q16: Blocking time.sleep(10) in synchronous polling loop may block the event loop

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Best Practices |
| **File** | `mcp-server/tools/gamma_report.py` |
| **Line** | 79 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Use `asyncio.sleep()` if running in async context, or return a generation ID immediately and let the user poll via `gamma_check_status`. |

---

## P3 — Low Findings

### Q17: Fragile regex-based source code parsing to compare pack IDs

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Maintainability |
| **File** | `tools/cli/commands/doctor.js` |
| **Line** | 155 |
| **Remediation:** | Use `const { PACKS } = require('../packs')` to get the actual PACKS object at runtime instead of parsing source code. |

### Q18: process.exit() prevents graceful cleanup

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Best Practices |
| **File** | `tools/cli/commands/install.js` (multiple locations: lines 155, 167, 198, 280, etc.) |
| **Remediation:** | Throw errors from async actions and let Commander.js handle them gracefully. Commander.js catches promise rejections from async actions automatically. |

### Q19: Non-standard abbreviation 'b64' for base64 module

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Naming |
| **File** | `mcp-server/tools/github_ops.py` |
| **Line** | 7 |
| **Remediation:** | Use `import base64` directly without alias, or `from base64 import b64encode` for clarity. |

### Q20: parseInt() with no input validation on CLI integer arguments

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Input Validation |
| **File** | `tools/cli/commands/scan.js` |
| **Line** | 158 |
| **Status** | **Confirmed — Real** (Duplicate of Security F19) |
| **Remediation:** | Add explicit validation: `const maxDepth = (n => Number.isInteger(n) && n > 0 ? n : 4)(parseInt(options.depth))`. |

### Q21: Shebang lines on modules that are imported, not executed directly

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Maintainability |
| **File** | `monitor/ai_analyzer.py` (line 1), `monitor/notifier.py` (line 1) |
| **Remediation:** | Remove shebangs from `ai_analyzer.py` and `notifier.py` as they are library modules, not entry points. |

### Q22: Relative paths in production server code are fragile

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Maintainability |
| **File** | `mcp-server/server.py` |
| **Lines** | 91, 102, 114, 141 |
| **Remediation:** | Use `BASE_DIR = Path(__file__).parent` and construct all paths relative to it. |

---

## Architecture Assessment

### Overall Architecture Rating: C

| Aspect | Rating | Notes |
|--------|:------:|-------|
| Module separation | D | install.js is a monolith (740 lines, 8+ responsibilities) |
| Reuse | D | PACKS definition triplicated, file copy logic duplicated |
| Error handling | D | 9 empty catch blocks in autoconfig.js, print() instead of logging |
| Input validation | C | Several unvalidated user inputs |
| Configuration | C | Hardcoded values mixed with env vars inconsistently |
| Security boundaries | D | MCP server has no auth layer |
| File organization | B | Generally follows CLI standard pattern |
| Dependency management | C | Python deps unpinned, JS deps OK |

### Areas for Improvement

1. **Use a shared config module** — Instead of spreading env var loading across 5+ files, centralize in a config module.
2. **Standardize logging** — Create a shared logger setup module for both Python and JavaScript.
3. **Consistent error propagation** — CLI tools should throw errors, not call `process.exit()` or silently swallow.
4. **API-first design for MCP** — The server code mixes tool definitions with HTTP handling — separate concerns.
5. **Type hints** — Python code has no type annotations, making it harder to validate input at the boundary.

---

## Code Duplication Report

| Duplicate | Files | Lines | Impact |
|-----------|-------|:-----:|--------|
| PACKS object | install.js, update.js, doctor.js | ~120 total | Adding packs requires editing 3 files |
| Project indexing loop | scan.js (2x) | ~18 lines | Identical code in same file |
| File copy logic | install.js, update.js | ~50 lines each | Same nested loop pattern |
| agents/pack-* dirs | agents/, packs/ | Full directories | 3 packs duplicated (seo, animated, backup) |
| i18n keys | i18n.js (8 languages) | 10 keys each | Copy-paste template, 8 locales missing keys |

**Total duplicated code estimate:** ~500 lines across the project.

---

## Error Handling Coverage

| File | Empty Catches | Silent Fails | process.exit() | print() logging |
|------|:------------:|:------------:|:--------------:|:--------------:|
| autoconfig.js | **9** | 3 (install fails) | 0 | 0 |
| install.js | 0 | 0 | 5+ | 0 |
| scan.js | 0 | 0 | 0 | 0 |
| update.js | 0 | 0 | 0 | 0 |
| doctor.js | 0 | 0 | 0 | 0 |
| server.py | 0 | 1 (ingest.py) | 0 | 6+ |
| ci_cd.py | 0 | 0 | 0 | 5+ |
| git_ops.py | 0 | 0 | 0 | 2+ |
| gamma_report.py | 0 | 0 | 0 | 3+ |
| **Totals** | **9** | **4** | **5+** | **16+** |

---

## Best Practices Violations

| Practice | Violations | Files |
|----------|------------|-------|
| Error messages in catch blocks | 9 empty catches | autoconfig.js |
| Structured logging | 16+ print() calls | server.py, ci_cd.py, git_ops.py, monitor/ |
| UTF-8 encoding on file reads | 6+ violations | ci_cd.py, gamma_report.py, rag_tools.py |
| Input validation | 4 violations | scan.js, install.js, git_ops.py, github_ops.py |
| No blocking in async context | 1 violation | gamma_report.py (time.sleep for 10 min) |
| Shebangs on library modules | 2 violations | ai_analyzer.py, notifier.py |
| Relative paths in production | 4 violations | server.py (lines 91, 102, 114, 141) |
