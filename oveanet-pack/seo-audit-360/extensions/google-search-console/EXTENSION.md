# Google Search Console Extension — BMAD+ SEO Engine

> Author: Laurent Rochetta | BMAD+ SEO Engine v2.1

## Overview

This extension connects the SEO Engine to Google Search Console API v3 for accessing real organic search performance data. Requires OAuth2 authentication with a Google Cloud project.

## Setup Guide

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google Search Console API**

### 2. Create OAuth2 Credentials
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Application type: **Desktop app**
4. Download the JSON → save as `credentials.json` in this directory

### 3. First Run
```bash
python gsc_client.py --setup
```
This opens a browser for OAuth consent. The refresh token is saved to `token.json` for subsequent runs.

### 4. Verify Access
```bash
python gsc_client.py --sites
```
Should list all verified Search Console properties.

## Commands

```bash
# List verified sites
python gsc_client.py --sites

# Top queries (default: 28 days)
python gsc_client.py --queries https://example.com --days 28

# Top pages by organic traffic
python gsc_client.py --pages https://example.com --days 28

# Index coverage (errors, valid, excluded)
python gsc_client.py --coverage https://example.com

# Sitemap status
python gsc_client.py --sitemaps https://example.com

# Full export (all data, JSON)
python gsc_client.py --all https://example.com --json > gsc-data.json
```

## Output Examples

### Queries
```
Top Organic Queries (28 days):
  1. "bmad framework"      — Pos: 3.2, Clicks: 450, CTR: 12.3%, Imp: 3,658
  2. "ai development tool"  — Pos: 8.1, Clicks: 120, CTR:  3.5%, Imp: 3,428
  3. "multi-agent coding"   — Pos: 5.4, Clicks:  95, CTR:  7.8%, Imp: 1,218
```

### Coverage
```
Index Coverage:
  ✅ Valid: 142 pages
  ⚠️ Valid with warnings: 8 pages
  ❌ Error: 3 pages
  ⛔ Excluded: 45 pages (noindex, canonical, etc.)
```

## Integration with SEO Engine

When this extension is installed, the SKILL.md orchestrator can:
- Include real organic data in Phase 4 scoring
- Compare GSC impressions with crawled pages to find content gaps
- Detect indexed pages with declining CTR → priority optimization targets
- Cross-reference sitemap URLs with actually indexed pages

## Files

| File | Purpose |
|------|---------|
| `EXTENSION.md` | This documentation |
| `gsc_client.py` | OAuth2 flow + API calls |
| `requirements.txt` | Python dependencies |

## Dependencies SUPPLÉMENTAIRES

```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-api-python-client>=2.0.0
```

## Security Notes

- `credentials.json` — Contains client ID/secret. **Do not commit to Git.**
- `token.json` — Contains refresh token. **Do not commit to Git.**
- Add both to `.gitignore`

## Rate Limits

- 1,200 queries per minute per project
- 25,000 rows per request maximum
- Data typically 2-3 days delayed
