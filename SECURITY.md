# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest stable npm release | Active fixes |
| Earlier releases | Update to the latest stable release |

The current release is listed on [npm](https://www.npmjs.com/package/bmad-plus)
and in the [release history](https://bmad-plus.rochetta.fr/docs/#releases).

## Reporting a Vulnerability

If you discover a security vulnerability in BMAD+, please report it responsibly:

### 🔒 Preferred: GitHub private vulnerability reporting

Use **[Report a vulnerability](https://github.com/lrochetta/BMAD-PLUS/security/advisories/new)**
(repository *Security* tab → *Report a vulnerability*). The report stays private
between you and the maintainer, and the fix and advisory are coordinated there.

### 📧 Fallback: email

If you cannot use GitHub private reporting:

**Email:** [l.rochetta@gmail.com](mailto:l.rochetta@gmail.com)

**Subject line:** `[SECURITY] BMAD+ — Brief description`

### What to include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment (what could an attacker do?)
- Affected version(s)
- Any suggested fix (optional)

### Response SLA

| Severity | Acknowledgment | Fix Target |
|----------|---------------|------------|
| 🔴 Critical | 24 hours | 72 hours |
| 🟡 High | 48 hours | 7 days |
| 🟢 Medium | 7 days | 30 days |

### What NOT to do

- ❌ Do not open a public GitHub issue for security vulnerabilities
- ❌ Do not exploit the vulnerability beyond proof of concept
- ❌ Do not share the vulnerability publicly before a fix is released

### Recognition

Security researchers who report valid vulnerabilities will be credited in the CHANGELOG (unless they prefer anonymity).

## Security Practices

### Secret Management
- All secrets are stored in GitHub Actions Secrets (never in code)
- Local secrets directory is gitignored
- CI/CD pipeline scrubs private directories before public distribution

### Dependency Management
- Production npm dependencies are audited before each release; high and critical findings block publication
- Maintained Python requirements are audited in CI and block publication on known findings
- The private legacy MCP ML stack has a separate, visible advisory audit and migration backlog; its findings do not describe the npm runtime
- Minimal dependency footprint (6 runtime dependencies)
- Bundled source notices are included in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md); npm runtime dependency licenses are recorded in the release SBOM

### Distribution Security
- Golden (private) → scrubbed distribution snapshot with no parent commit or source history
- npm packages are built from scrubbed distribution copies
- No private infrastructure details in public distribution
- Each release retains its CycloneDX production SBOM, archive and integrity manifest as workflow artifacts; registry integrity must match the checked archive before the landing is deployed
- Publication uses npm OIDC authentication. npm provenance is not enabled: the private build repository and distribution repository differ. An inventory or hash is not a provenance attestation

## Data handling

BMAD+ has no telemetry and no silent self-update. The first table lists every flow of the
npm package that can send data off the machine; the second covers the maintainer services
deployed from this repository (the Audit 360° MCP server and the upstream monitor), which
users do not install. Both are generated from the `data_handling` doctrine in
`registry.yaml`. Before each release, CI scans every shipped and service source file and
fails when a network, listener or process site is missing from the doctrine, or when a
declared one no longer exists. "Through a started program" means BMAD+ starts a tool (npm,
uv or pip, git, Codex CLI, Chromium, a command you declared) and that tool does the sending.

<!-- data-handling:begin — generated from registry.yaml by tools/build/verify-egress.js --write -->

| Flow | Component | Leaves the machine | What | To whom | When | Consent |
|---|---|---|---|---|---|---|
| `update-check` | cli | through a started program | The package name and channel (`npm view bmad-plus@latest`) with npm's request metadata: IP address, user agent (npm, Node.js and OS versions) and npm session headers. | registry.npmjs.org (the policy accepts no other registry) | `bmad-plus update-check`, which the generated adapters ask the agent to run once per session; the answer is cached in `.bmad/update-check.json`. | **opt-out**: `bmad-plus update-policy --mode off` stops every lookup. |
| `update-apply` | cli | through a started program | The exact release requested, with npm's request metadata, to download that version's package. | registry.npmjs.org | `bmad-plus update --latest --yes`, or `--auto` when the project policy allows it. | **opt-in**: Each run needs `--yes`, or policy mode `auto` with an explicit range (`bmad-plus update-policy --mode auto --range <range>`). |
| `python-provision` | cli | through a started program | The names and versions in the pack's requirements.txt, with the installer's request metadata; uv may also download a Python build. | pypi.org and files.pythonhosted.org, or the index configured for pip or uv on the machine, github.com (python-build-standalone releases) when uv downloads Python | `bmad-plus install --provision-python` for a selected Python pack. | **opt-in**: Only with `--provision-python`; without it no environment is created. |
| `nexus-worker` | cli | through a started program | With `codex-exec`, the task's instruction and input files (at most 1 MiB) go to Codex CLI, which sends them to the model provider of the user's own Codex login. With `command`, whatever that command sends. | the model provider configured in the user's Codex CLI, whoever a declared command contacts | `bmad-plus nexus launch` on a plan with an explicit execution contract. | **invocation**: Nothing starts without a plan the user wrote and an explicit launch; shell, environment and arbitrary Codex flags are refused. |
| `nexus-verifier` | cli | through a started program | Whatever the declared command sends; it runs with a minimal allow-listed environment. | whoever the declared command contacts | `bmad-plus nexus verify` on a task of a plan the user wrote. | **invocation**: The command and its hash are fixed in the plan; a changed executable is refused. |
| `uat-page-results` | core | directly | The run: tester name, step verdicts and notes. | the origin serving the page: `bmad-plus uat serve` on 127.0.0.1, or the claude.ai artifact store when the page is published as an artifact | Each recorded verdict, when the page is served; a page opened from a file keeps results in the browser. | **invocation**: The tester chooses how the page is opened; a page opened from a file sends nothing. |
| `osint-providers` | osint | directly | The investigation query (names, handles, keywords and URLs about the subject) and that provider's API key, over verified HTTPS: the shared helper refuses any other scheme and any redirect off the provider's host. | api.apify.com, api.exa.ai, r.jina.ai, s.jina.ai, deepsearch.jina.ai, api.parallel.ai, api.perplexity.ai, api.tavily.com, the Bright Data MCP URL the user configures | When the Shadow agent, or `volley.py` fanning out to the others, runs a provider script during an investigation. | **credential**: A provider is contacted only once its key (or Bright Data MCP URL) is set; the skill's Phase −1 lawful-basis gate precedes profiling a named person. |
| `seo-site-fetch` | seo | directly | HTTP requests for the audited site's pages, robots.txt and sitemap, with the user agent the audit selects, from the user's IP address. | the site the user asks to audit (public addresses only) | `seo_fetch.py` and `seo_crawl.py`, run by the SEO agents during an audit. | **invocation**: Only the URL the user gives and its internal links are fetched; private, loopback and link-local addresses are refused. |
| `seo-google-apis` | seo | directly | The audited URL or origin, and the user's GOOGLE_API_KEY in the x-goog-api-key header, never in the request URL; redirects are not followed. | www.googleapis.com, chromeuxreport.googleapis.com, searchconsole.googleapis.com | `seo_apis.py`, run during an audit's performance phase. | **credential**: Only when GOOGLE_API_KEY is set; without it the script returns an error and sends nothing. |
| `seo-screenshot` | seo | through a started program | Chromium's requests for the audited page and the resources its own host serves, with a browser user agent, from the user's IP address. Third-party resources are blocked, not fetched. | the site the user asks to audit (public addresses only) | `seo_screenshot.py`, when an audit asks for screenshots. | **invocation**: Only the URL the user gives, with the Playwright and Chromium the user installed; non-public addresses, other hosts and redirects off the host are refused. |
| `assurance-checks` | cli | through a started program | Whatever a declared check command sends; the CLI itself sends nothing. | whoever a declared check command contacts | `bmad-plus assurance run` on a case the user wrote. | **invocation**: Only the commands listed in the user's own case file run, and only on an explicit `assurance run`; the signing key is never passed to a check. |

Stays on the machine:

- `npx-launcher` (cli): Starts the CLI in the same Node.js executable. When: Every `npx bmad-plus` run.
- `python-health` (cli): Runs a pack environment's own Python, isolated (-I), to confirm its modules import. When: `bmad-plus doctor` on a project with a provisioned Python pack.
- `review-git` (cli): Reads the local repository with git (rev-parse, merge-base, diff, ls-files, show) to build a review scope. When: `bmad-plus review` commands.
- `nexus-git` (cli): Reads the repository root and HEAD commit with `git rev-parse`. When: `bmad-plus nexus` plan and run commands.
- `uat-serve` (cli): Serves a recipe page and stores its verdicts, listening on 127.0.0.1 only and refusing any other Host header. When: `bmad-plus uat serve`.
- `uat-release-gate` (core): Runs the project's own bmad-plus CLI with the current Node.js to grade recorded acceptance runs. When: The release-gate script a project copies from the UAT skill, when the project runs it.
- `osint-install` (osint): Copies the OSINT agent and skills into a BMAD project, then runs the pack's local diagnostic script with the system Python. When: When the user runs the package's install.sh or install.ps1.

Maintainer services, deployed from this repository and not part of the npm package:

- `mcp-server` (`mcp-server/`): The Audit 360° MCP server the maintainer runs on a VPS: git, GitHub, Gamma, CI, RAG and memory tools for the maintainer's agents, behind a bearer token and a password-protected dashboard.
- `monitor` (`monitor/`): The upstream monitor the maintainer schedules on a VPS: it watches the BMAD-METHOD repository and notifies the maintainer of new changes.

| Flow | Service | Leaves the machine | What | To whom | When | Consent |
|---|---|---|---|---|---|---|
| `mcp-listener` | mcp-server | directly | Tool results (repository contents and diffs, command output, audit reports, knowledge-base passages, memory entries) and the dashboard's audit data. | MCP clients presenting the bearer token, dashboard users logged in with the dashboard password | While the service runs: HTTPS on 0.0.0.0:443 when SSL_CERT_FILE and SSL_KEY_FILE are set, plain HTTP on 127.0.0.1:8000 with BMAD_DEV=1, otherwise it refuses to start. | **credential**: Every MCP request needs MCP_AUDIT360_TOKEN and every dashboard request the dashboard password; 30 requests per minute per address. |
| `mcp-dashboard-cdn` | mcp-server | directly | The dashboard user's IP address, user agent and the dashboard origin as referrer. | cdn.jsdelivr.net | Each time the dashboard page is opened. | **invocation**: Opening the dashboard loads it. |
| `mcp-knowledge-ingest` | mcp-server | through a started program | Git clone and pull requests for the sources in knowledge/sources.json, and the model download request (model name, library version) on first use. | the Git hosts of the configured knowledge sources, huggingface.co (the embedding model named by RAG_EMBEDDING_MODEL or the default) | At server start when the knowledge base is empty, and on the admin_refresh_knowledge tool. | **invocation**: The maintainer lists the sources; chromadb runs with anonymized_telemetry=False. |
| `mcp-git-tools` | mcp-server | through a started program | Clone, pull and push traffic for the repositories a client names, with the credentials git holds on the server; pushes carry the commits made through git_commit. | the Git hosts of the repositories the client names (URLs validated before cloning) | git_* tools, audit_scan_repo and orchestrate_full_audit, when an authenticated client calls them. | **credential**: Only through an authenticated MCP call; paths are confined to the server's repository root. |
| `mcp-github-api` | mcp-server | directly | GITHUB_TOKEN with the repository names, file contents, pull-request texts and collaborator names the client passes; orchestrate_full_audit creates a private delivery repository. | api.github.com | github_* tools and orchestrate_full_audit, when an authenticated client calls them. | **credential**: Only with GITHUB_TOKEN set on the server and an authenticated MCP call. |
| `mcp-gamma` | mcp-server | directly | The report content (Markdown, title, infographic URLs, instructions) and GAMMA_API_KEY; export downloads carry no content. | public-api.gamma.app, the export host named in Gamma's answer | gamma_* tools, when an authenticated client calls them. | **credential**: Only with GAMMA_API_KEY set on the server and an authenticated MCP call. |
| `mcp-ci-tools` | mcp-server | through a started program | Whatever those programs send: dependency downloads of npm, pip, cargo or go, Semgrep's registry requests for --config=auto, Trivy's vulnerability-database download, and whatever a repository's deploy script sends. | the package registries of the repository's toolchain, semgrep.dev, Trivy's database mirrors, whoever a repository's deploy script contacts | ci_* tools, when an authenticated client calls them. | **credential**: Only through an authenticated MCP call; commands must equal an allow-listed argv, deploy scripts must lie inside the repository. |
| `monitor-upstream-git` | monitor | through a started program | Git fetch requests for the configured upstream ref, with the host's IP address. | github.com (bmad-code-org/BMAD-METHOD, or the HTTPS repository the configuration names) | Each scheduled run of weekly-check.py. | **invocation**: The maintainer installs the schedule and chooses the repository and ref. |
| `monitor-ai-analysis` | monitor | directly | Bounded excerpts of the upstream commit messages, diff statistics and diff, the previous observed version, and the configured API key. | generativelanguage.googleapis.com (Google Gemini API) | weekly-check.py --ai, when a change is observed. | **opt-in**: Only with --ai and an API key and model list in the configuration; --dry-run never calls it. |
| `monitor-notify` | monitor | directly | The observation report: upstream version and commit summaries, with the advisory analysis when one was requested. | the Evolution API instance the configuration names (loopback unless HTTPS), which relays it to the configured WhatsApp number, the SMTP server of the fallback email configuration (STARTTLS) | weekly-check.py --notify, once per newly observed upstream state. | **opt-in**: Only with --notify and a configured channel; --dry-run never notifies. |
| `monitor-mcp-bridge` | monitor | directly | Tool names and arguments (repository URLs and paths, pull-request texts) with the MCP bearer token. | the maintainer's MCP server (VPS_HOST or the configured mcp_url) | When code constructs an MCPBridge; weekly-check.py does not. | **credential**: Only with an MCP token and server address supplied by the maintainer. |

Stays on the service host:

- `mcp-memory` (mcp-server): Runs the bmad-plus CLI's `mem` command with the server's Node.js for the memory tools. When: memory_* tools, when an authenticated client calls them.

<!-- data-handling:end -->

BMAD+ is an independent derivative of BMAD-METHOD. It is not an official release
of BMad Code, LLC and does not imply its endorsement.
