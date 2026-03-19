---
name: seo-engine
description: >
  BMAD+ SEO Engine v2.1 — Complete SEO audit engine with 3 multi-role agents,
  6-phase workflow, Python toolkit, Google API integration, and PageSpeed
  perfection loop. Use when user says /seo or any SEO-related command.
---

# SEO Engine — Orchestrator

> By Laurent Rochetta | BMAD+ SEO Engine v2.1

## Quick Start

This skill orchestrates 3 specialized agents through a structured workflow.
Load the full agent files only when activating that agent's phase.

## Command Router

When the user issues a `/seo` command, route as follows:

| Command | Agent(s) | Action |
|---------|----------|--------|
| `/seo full <url>` | Scout → Judge → Chief | Run all 6 phases |
| `/seo quick <url>` | Scout → Judge → Chief | Run phases 1–4 only |
| `/seo technical <url>` | Scout (Inspector) | Phase 2 technical only |
| `/seo content <url>` | Judge (Content Expert) | Phase 2 content only |
| `/seo geo <url>` | Judge (GEO Analyst) | Phase 3 only |
| `/seo schema <url>` | Judge (Schema Master) | Schema detection + validation |
| `/seo images <url>` | Judge (Content Expert) | Image audit subset |
| `/seo hreflang <url>` | Scout (Inspector) | Hreflang audit, ref: `ref/hreflang-rules.md` |
| `/seo pagespeed <url>` | Scout + Chief | PageSpeed perfection loop |
| `/seo plan <type>` | Chief (Strategist) | Strategic plan by industry |
| `/seo fix` | Chief (Strategist) | Auto-generate fixes from last audit |
| `/seo history` | Chief (Reporter) | Show score history |
| `/seo compare` | Chief (Reporter) | Compare with previous audit |
| `/seo competitor <url1> <url2>` | Scout + Judge + Chief | Benchmark two sites |
| `/seo api <url>` | (script) | Run Google APIs (PSI + CrUX + Rich Results) |

## Full Audit Orchestration (`/seo full`)

### Phase 1 — Reconnaissance
**Agent**: Scout (Crawler role)
**Load**: `agent/seo-scout.md`

1. Run `scripts/seo_fetch.py <url> --json` to fetch homepage
2. Run `scripts/seo_crawl.py <url> --depth 2 --max 25 --json` to discover structure
3. Detect business type from content analysis:
   - **SaaS**: pricing page, features page, signup CTA
   - **E-commerce**: product pages, cart, categories
   - **Local business**: address, phone, map, opening hours
   - **Publisher**: articles, blog, news, RSS feed
   - **Agency**: services, portfolio, case studies
4. Check for `/robots.txt`, `/sitemap.xml`, `/llms.txt`

**Checkpoint**: Report discovery summary, ask "Continue with full audit?"

### Phase 2 — Deep Scan (PARALLEL)
**Agents**: Scout (Inspector) + Judge (Content Expert + Schema Master)
**Load**: `agent/seo-scout.md` + `agent/seo-judge.md`

Run Scout and Judge **simultaneously** on each discovered page:

**Scout checks** (9 categories — see `agent/seo-scout.md`):
- Crawlability, Indexability, Security, URL Structure, Mobile
- Core Web Vitals, Structured Data detection, JS Rendering, IndexNow

**Judge checks** (see `agent/seo-judge.md`):
- E-E-A-T evaluation (ref: `ref/eeat-criteria.md`)
- Content quality (ref: `ref/quality-gates.md`)
- Schema validation (ref: `ref/schema-catalog.md`)
- Image audit
- Internal/external link analysis

**Optional**: Run `scripts/seo_apis.py --all <url>` for live PageSpeed + CrUX data.

Use `scripts/seo_parse.py <file> --url <url> --json` on fetched HTML.
Use `scripts/seo_screenshot.py <url> --viewport mobile` for visual audit.

### Phase 3 — AI Readiness & GEO
**Agent**: Judge (GEO Analyst role)
**Reference**: `ref/geo-signals.md`

- Check AI crawler access (GPTBot, ClaudeBot, PerplexityBot)
- Verify llms.txt compliance
- Score passage citability (134–167 word blocks)
- Compute AI Readiness Score (0–100)

### Phase 4 — Scoring
**Agent**: Chief (Scorer role)
**Load**: `agent/seo-chief.md`

Compute SEO Health Score (0–100):

| Category | Weight |
|----------|--------|
| Technical SEO | 20% |
| Content & E-E-A-T | 22% |
| On-Page SEO | 18% |
| Schema | 10% |
| Performance (CWV) | 12% |
| AI Readiness (GEO) | 12% |
| Images | 6% |

### Phase 5 — Action Plan
**Agent**: Chief (Strategist role)

1. Classify issues: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low
2. Identify quick wins (highest impact/effort ratio)
3. Generate 30/60/90-day roadmap
4. Auto-generate code fixes (meta tags, schema JSON-LD, robots.txt, llms.txt)

**Checkpoint**: "Here's the plan. Apply fixes automatically?"

### Phase 5b — PageSpeed Perfection Loop
**Agents**: Scout + Chief
**Reference**: `pagespeed-playbook.md` + `checklist.md`

Use `scripts/seo_apis.py --pagespeed <url>` for live scores.
Loop: fix one issue → re-test → verify improvement → next issue.
Target: 100% on all 4 categories (Performance, Accessibility, Best Practices, SEO).

### Phase 6 — Monitoring (optional)
**Agent**: Scout (Crawler role)

Save results to `.bmad-seo/history/<domain>-<date>.json`.
On re-audit: compare with previous, show deltas.

---

## Python Toolkit

| Script | Usage | Dependencies |
|--------|-------|-------------|
| `seo_fetch.py` | `python scripts/seo_fetch.py <url> [--ua googlebot] [--json]` | requests |
| `seo_parse.py` | `python scripts/seo_parse.py <file> --url <url> --json` | beautifulsoup4, lxml |
| `seo_crawl.py` | `python scripts/seo_crawl.py <url> --depth 2 --max 25 --json` | requests |
| `seo_screenshot.py` | `python scripts/seo_screenshot.py <url> --viewport mobile` | playwright |
| `seo_apis.py` | `python scripts/seo_apis.py --pagespeed <url>` | requests |

**Install dependencies**: `pip install -r requirements.txt`

**Environment**: Set `GOOGLE_API_KEY` for Google API access (free, no OAuth).

---

## Reference Files (lazy-load)

Only load these when the relevant agent needs them:
- `ref/cwv-thresholds.md` — Core Web Vitals 2026
- `ref/schema-catalog.md` — Schema.org v29.4 types
- `ref/eeat-criteria.md` — E-E-A-T scoring grid
- `ref/geo-signals.md` — AI search signals
- `ref/quality-gates.md` — Content thresholds
- `ref/schema-templates.json` — 14 JSON-LD templates

---

## Industry-Specific Plans (`/seo plan <type>`)

| Type | Focus |
|------|-------|
| `saas` | Pricing pages, feature comparison, trial CTAs, documentation SEO |
| `ecommerce` | Product schema, category pages, faceted navigation, review markup |
| `local` | LocalBusiness schema, Google Business Profile, location pages, NAP consistency |
| `publisher` | Article schema, author E-E-A-T, news sitemap, pagination |
| `agency` | Service schema, portfolio, case studies, city-specific landing pages |

---

*BMAD+ SEO Engine v2.1 — By Laurent Rochetta*
