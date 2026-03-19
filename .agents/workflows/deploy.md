---
description: Mandatory pre-deployment checklist — MUST READ before any git push, npm publish, or release
---

# Pre-Deploy Workflow

> ⚠️ **This workflow is MANDATORY before any `git push`, `npm publish`, `git tag`, or release.**

## Step 1 — Read Architecture Doc

// turbo
Read the deployment architecture document:
```
view_file d:\travail\DEV\BMAD+\docs\architecture\golden-vs-distribution.md
```

**Key rules from this document:**
- `BMAD-PLUS` (origin) = **Golden repo** (private, all code including monitor/, mcp-server/)
- `BMAD-PLUS-GOLDEN` = **Backup/mirror** of the golden repo
- Distribution repo = **public**, receives scrubbed code only via CI/CD
- **NEVER push directly to the public/distribution repo** — use the GitHub Action

## Step 2 — Verify Remotes

// turbo
Run `git remote -v` to confirm which remotes exist and where you're pushing.

## Step 3 — Verify No Secrets Leak

Before committing, verify that NO private files are staged:
- ❌ `monitor/` — VPS infrastructure (Evolution API, WhatsApp webhooks)
- ❌ `mcp-server/` — Private MCP server
- ❌ `osint-agent-package/` — OSINT tools (check if public or private)
- ❌ `.env`, `credentials.json`, `token.json` — Secrets
- ❌ Any file containing API keys, passwords, or VPS IPs

## Step 4 — Push to Golden Only

Push ONLY to the golden/private repo:
```bash
git push origin master
```

**DO NOT** push to `public` or any distribution remote directly.

## Step 5 — npm publish (if applicable)

npm publish sends the package to the public npm registry.
Verify `.npmignore` excludes private directories before publishing.

## Step 6 — Distribution Sync (when CI/CD is ready)

The GitHub Action `publish-distribution.yml` handles:
1. Clone golden
2. Remove `monitor/`, `mcp-server/`, private files
3. Swap `README.md` → `README-DIST.md`
4. Force-push clean code to distribution repo

Until CI/CD is implemented, distribution sync must be done manually with extreme care.
