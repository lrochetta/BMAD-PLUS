# SEO Audit Workflow — BMAD+ SEO Engine v2.0

> Author: Laurent Rochetta | By Oveanet × Laurent Rochetta

## Overview

This workflow orchestrates the 3 SEO Engine agents (Scout, Judge, Chief) through 6 phases to produce a comprehensive audit with scored results and actionable fixes.

---

## Phase 1 — Reconnaissance (Scout solo)

**Duration**: ~2 min | **Agent**: Scout (Crawler role)

1. Fetch homepage + `/robots.txt` + `/sitemap.xml`
2. Detect business type (SaaS, e-commerce, local, publisher, agency)
3. Mini-crawl: discover 10–25 pages via sitemap + internal links
4. Detect rendering architecture (SSR / CSR / hybrid)
5. Check for `/llms.txt` and `/llms-full.txt`

**Checkpoint**: "Identified a [type] site with [N] pages. Continue full audit?"

**Tools**:
```bash
python scripts/seo_fetch.py [URL] --json
python scripts/seo_crawl.py [URL] --depth 2 --max 25 --json
```

---

## Phase 2 — Deep Scan (Scout + Judge in PARALLEL)

**Duration**: ~5 min | **Agents**: Scout (Inspector) + Judge (Content Expert + Schema Master)

### Scout inspects (9 categories):
1. Crawlability (robots.txt, noindex, crawl depth)
2. Indexability (canonicals, duplicates, pagination)
3. Security (HTTPS, HSTS, CSP, X-Frame-Options)
4. URL Structure (clean URLs, redirects, trailing slashes)
5. Mobile (viewport, touch targets, font size)
6. Core Web Vitals signals from source HTML
7. Structured Data detection (pass to Judge)
8. JavaScript rendering (CSR/SSR, SPA detection)
9. IndexNow protocol

### Judge analyzes (in parallel):
1. E-E-A-T evaluation (Experience, Expertise, Authority, Trust)
2. Content quality (word count, readability, keyword optimization)
3. Schema validation (JSON-LD, types, deprecation status)
4. Image audit (alt text, dimensions, format, lazy loading)
5. Internal/external link analysis
6. AI content detection markers

**Tools**:
```bash
python scripts/seo_parse.py page.html --url [URL] --json
python scripts/seo_screenshot.py [URL] --viewport mobile --json
python scripts/seo_screenshot.py [URL] --viewport desktop --json
```

---

## Phase 3 — AI Readiness & GEO (Judge solo)

**Duration**: ~3 min | **Agent**: Judge (GEO Analyst role)

1. Check AI crawler access (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot)
2. Verify llms.txt compliance
3. Check RSL 1.0 licensing
4. Score passage-level citability (134–167 word blocks)
5. Analyze brand mention signals
6. Compute **AI Readiness Score (0–100)**

Reference: `ref/geo-signals.md`

---

## Phase 4 — Scoring & Synthesis (Chief solo)

**Duration**: ~2 min | **Agent**: Chief (Scorer role)

Compute **SEO Health Score (0–100)** from weighted categories:

| Category | Weight |
|----------|--------|
| Technical SEO | 20% |
| Content & E-E-A-T | 22% |
| On-Page SEO | 18% |
| Schema | 10% |
| Performance (CWV) | 12% |
| AI Readiness (GEO) | 12% |
| Images | 6% |

Output: Score breakdown with visual indicators per category.

---

## Phase 5 — Action Plan & Auto-Fixes (Chief solo)

**Duration**: ~3 min | **Agent**: Chief (Strategist role)

1. Classify all issues: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low
2. Identify Quick Wins (high impact / low effort)
3. Generate 30/60/90-day roadmap
4. **Auto-generate code fixes** for:
   - Missing/broken meta tags (title, description)
   - Schema JSON-LD blocks (from templates)
   - robots.txt improvements (AI crawler access)
   - llms.txt file generation
   - Image alt text suggestions
5. **Checkpoint**: "Here's the plan. Want me to apply the fixes automatically?"

---

## Phase 5b — PageSpeed Perfection Loop (Scout + Chief iterative)

> **This is the battle-tested loop from our oveanet.ch optimization.**
> Goal: Achieve **100% on all 4 PageSpeed Insights categories** (Performance, Accessibility, Best Practices, SEO).

### The Loop

```
┌─────────────────────────────────────┐
│  1. Run PageSpeed Insights audit    │
│     (via API or manual)             │
│           │                         │
│           ▼                         │
│  2. Parse failing audits            │
│     Group by category + priority    │
│           │                         │
│           ▼                         │
│  3. Apply top-priority fix          │
│     (one fix at a time)             │
│           │                         │
│           ▼                         │
│  4. Re-run PageSpeed                │
│     Verify fix + no regressions     │
│           │                         │
│           ▼                         │
│  5. Score improved?                 │
│     YES → Continue to next fix      │
│     NO → Revert and try different   │
│           approach                  │
│           │                         │
│           ▼                         │
│  6. All 4 categories = 100%?        │
│     YES → Done ✅                   │
│     NO → Go to step 2              │
└─────────────────────────────────────┘
```

### PageSpeed Fix Priority Order
1. **Performance** (hardest — tackle first):
   - Eliminate render-blocking resources
   - Properly size images (WebP/AVIF + responsive)
   - Reduce unused CSS/JS
   - Defer offscreen images
   - Minimize main-thread work
   - Reduce server response time (TTFB)
   - Preload LCP image

2. **Accessibility** (usually quick wins):
   - Add alt text to all images
   - Fix color contrast ratios (4.5:1 minimum)
   - Add ARIA labels to interactive elements
   - Ensure heading hierarchy
   - Add lang attribute to HTML
   - Ensure form labels

3. **Best Practices**:
   - HTTPS + no mixed content
   - No browser errors in console
   - Remove deprecated APIs
   - Add proper CSP headers

4. **SEO** (usually easiest):
   - Add meta description
   - Ensure crawlable links
   - Valid robots.txt
   - Proper viewport meta
   - Descriptive link text

### Key Rules
- **One fix at a time** — never batch multiple changes, you need to isolate impact
- **Always re-test** — PageSpeed scores can regress with seemingly unrelated changes
- **Mobile first** — always test mobile viewport (Google uses mobile for indexing)
- **Field vs Lab** — Lab scores (Lighthouse) can differ from field data (CrUX). Target lab 100% first

---

## Phase 6 — Monitoring (Scout, optional)

**Duration**: ongoing | **Agent**: Scout (Crawler role)

1. Save audit results to `.bmad-seo/history/[domain]-[date].json`
2. On re-audit: compare with previous results
3. Track: issues resolved, new issues, score evolution
4. Generate progress report with deltas

---

## Command Quick Reference

```bash
# Full audit (all 6 phases)
/seo full https://example.com

# Quick audit (Phases 1-4 only)
/seo quick https://example.com

# Individual commands
/seo technical https://example.com
/seo content https://example.com
/seo geo https://example.com
/seo schema https://example.com
/seo images https://example.com
/seo hreflang https://example.com

# PageSpeed perfection loop
/seo pagespeed https://example.com

# Strategic planning
/seo plan saas|ecommerce|local|publisher|agency

# Auto-fix generation
/seo fix

# Monitoring
/seo history
/seo compare
```

---

## Tips for Best Results

1. **Start with `/seo full`** for the first audit — it gives you the complete picture
2. **Use `/seo pagespeed`** after fixing major issues to chase 100% scores
3. **Re-run monthly** with `/seo compare` to track progress
4. **Feed the AI crawlers**: Allow GPTBot + ClaudeBot + PerplexityBot in robots.txt
5. **Check GEO separately**: AI search visibility evolves fast, audit quarterly with `/seo geo`
