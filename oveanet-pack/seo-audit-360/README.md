# SEO Engine v2.0 — BMAD+ SEO Audit 360

> **By Laurent Rochetta** | Oveanet × BMAD+

## Overview

A comprehensive SEO audit engine with 3 multi-role agents, a 6-phase workflow, Python toolkit, and auto-fix generation. Built from scratch for the BMAD+ framework.

## Agents

| Agent | Roles | Purpose |
|-------|-------|---------|
| 🔎 **Scout** | Crawler, Inspector, Photographer | Technical scanning (9 categories) |
| ⚖️ **Judge** | Content Expert, Schema Master, GEO Analyst | Content quality, E-E-A-T, AI readiness |
| 👑 **Chief** | Scorer, Strategist, Reporter | Scoring (0-100), action plans, monitoring |

## Workflow (6 Phases)

1. **Reconnaissance** — Site discovery, business type detection, mini-crawl
2. **Deep Scan** — Scout + Judge in parallel (technical + content)
3. **AI Readiness** — GEO analysis for AI search visibility
4. **Scoring** — SEO Health Score (0-100) with weighted categories
5. **Action Plan** — Prioritized roadmap + auto-generated code fixes
5b. **PageSpeed Loop** — Iterative fixing to achieve 100% on all 4 categories
6. **Monitoring** — Score tracking over time

## Commands

```bash
/seo full <url>           # Complete 6-phase audit
/seo quick <url>          # Phases 1-4 only
/seo technical <url>      # Technical audit
/seo content <url>        # Content + E-E-A-T
/seo geo <url>            # AI search readiness
/seo schema <url>         # Schema validation
/seo pagespeed <url>      # PageSpeed perfection loop
/seo plan <type>          # Strategic plan (saas/ecommerce/local)
/seo fix                  # Auto-generate fixes
/seo history              # Score history
/seo compare              # Compare with previous audit
```

## Python Toolkit

| Script | Purpose |
|--------|---------|
| `seo_fetch.py` | Secure HTTP fetcher (SSRF protection, multi-UA) |
| `seo_parse.py` | HTML parser (meta, schema, links, word count) |
| `seo_crawl.py` | Recursive mini-crawler with sitemap discovery |
| `seo_screenshot.py` | Playwright viewport screenshots + above-fold analysis |

## Scoring System

| Category | Weight |
|----------|--------|
| Technical SEO | 20% |
| Content & E-E-A-T | 22% |
| On-Page SEO | 18% |
| Schema | 10% |
| Performance (CWV) | 12% |
| AI Readiness (GEO) | 12% |
| Images | 6% |

## License

MIT — By Laurent Rochetta
