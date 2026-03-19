---
description: Mandatory pre-deployment checklist — MUST READ before any git push, npm publish, or release
---

# /deploy — Pre-Deployment Workflow

> ⚠️ **THIS WORKFLOW IS MANDATORY before any `git push`, `npm publish`, `git tag`, or release.**
> Any AI assistant working on this project MUST follow this workflow WITHOUT EXCEPTION.

---

## Step 0 — Read Architecture Doc

// turbo
Read `docs/architecture/golden-vs-distribution.md` before doing ANYTHING.

Key rules:
- **BMAD-PLUS-GOLDEN** (`origin`) = **PRIVATE** repo (all code, private dirs included)
- **BMAD-PLUS** (`public`) = **PUBLIC** distribution repo (scrubbed, no private files)
- **NEVER push directly to the public repo** — always use the GitHub Action
- **NEVER run `npm publish` from the Golden repo** — always use the GitHub Action

## Step 1 — Version Bump Checklist

When bumping a version, ALL of these files must be updated synchronously:

| # | File | What to update |
|---|------|----------------|
| 1 | `package.json` | `"version": "X.Y.Z"` |
| 2 | `CHANGELOG.md` | Add new `## [X.Y.Z]` section at top |
| 3 | `README.md` | Badge: `version-X.Y.Z-blue` |
| 4 | `README-DIST.md` | Badge: `version-X.Y.Z-blue` |
| 5 | `readme-international/README.fr.md` | Badge: `version-X.Y.Z-blue` |
| 6 | `readme-international/README.es.md` | Badge: `version-X.Y.Z-blue` |
| 7 | `readme-international/README.de.md` | Badge: `version-X.Y.Z-blue` |
| 8 | `README.md` | Version History table — add new row |
| 9 | `README-DIST.md` | Version History table — add new row |
| 10 | `tools/cli/i18n.js` | All 10 `installer_title` strings |
| 11 | `tools/cli/commands/install.js` | `clack.intro()` version string |

## Step 2 — Security Check

// turbo
Run: `git status --short | Select-String "secrets/"`

Verify:
- [ ] No files from `secrets/` are staged
- [ ] `.gitignore` includes `secrets/` (check it's not corrupted — must be UTF-8)
- [ ] No API keys, tokens, or PATs in any staged file

## Step 3 — Commit & Push to Golden (Private)

// turbo
```
git add -A
git commit -m "release: vX.Y.Z — [description]"
git push origin master
```

This pushes to **BMAD-PLUS-GOLDEN** (private) only.

## Step 4 — Tag the Release (Triggers GitHub Action)

// turbo
```
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

This triggers `.github/workflows/publish-distribution.yml` which:
1. Clones Golden
2. **Scrubs** private dirs (`monitor/`, `mcp-server/`, `secrets/`, `oveanet-pack/`, `.github/`, `.agents/`, `docs/architecture/`)
3. **Swaps** `README-DIST.md` → `README.md`
4. **Removes** IDE configs (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`)
5. **Force-pushes** to public **BMAD-PLUS** repo
6. **Publishes** to npm as `bmad-plus@X.Y.Z`

## Step 5 — Verify

After the GitHub Action completes:
- [ ] Check https://github.com/lrochetta/BMAD-PLUS — version badge shows X.Y.Z
- [ ] Check https://www.npmjs.com/package/bmad-plus — version X.Y.Z listed
- [ ] Verify no private files visible in public repo

## Required GitHub Secrets (BMAD-PLUS-GOLDEN)

These must be configured in Settings → Secrets → Actions:

| Secret | Purpose |
|--------|---------|
| `DISTRIBUTION_PAT` | GitHub PAT with `repo` scope for pushing to BMAD-PLUS |
| `NPM_TOKEN` | npm automation token for publishing to npmjs.com |

---

## Visibility Matrix (Reference)

| Directory | Golden (Private) | Public (BMAD-PLUS) | npm |
|-----------|:---:|:---:|:---:|
| `src/` | ✅ | ✅ | ✅ |
| `tools/` | ✅ | ✅ | ✅ |
| `osint-agent-package/` | ✅ | ✅ | ✅ |
| `readme-international/` | ✅ | ✅ | ✅ |
| `oveanet-pack/` | ✅ | ❌ | ❌ |
| `monitor/` | ✅ | ❌ | ❌ |
| `mcp-server/` | ✅ | ❌ | ❌ |
| `secrets/` | ✅ | ❌ | ❌ |
| `.github/` | ✅ | ❌ | ❌ |
| `.agents/` | ✅ | ❌ | ❌ |
| `docs/architecture/` | ✅ | ❌ | ❌ |
