# Core Web Vitals — Thresholds & Optimization Guide (March 2026)

> Author: Laurent Rochetta | BMAD+ SEO Engine v2.0

## Current Metrics

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤2.5s | 2.5–4.0s | >4.0s |
| **INP** (Interaction to Next Paint) | ≤200ms | 200–500ms | >500ms |
| **CLS** (Cumulative Layout Shift) | ≤0.1 | 0.1–0.25 | >0.25 |

> **INP replaced FID on March 12, 2024.** FID was fully removed from all Chrome tools on September 9, 2024. Never reference FID.

## Key Facts
- Evaluation uses the **75th percentile** of real user data (CrUX field data)
- Assessment at **page level** AND **origin level**
- CWV is a **tiebreaker** signal — matters most when content quality is similar
- Thresholds **unchanged since original definitions**
- December 2025 core update appeared to weight **mobile CWV more heavily**
- As of October 2025: 57.1% desktop, 49.7% mobile sites pass all three CWV
- **Mobile-first indexing 100% complete** since July 5, 2024

## LCP Diagnostic Subparts (Feb 2025 CrUX)

| Subpart | Description | Target |
|---------|-------------|--------|
| TTFB | Server response time | <800ms |
| Resource Load Delay | TTFB to resource request | Minimize |
| Resource Load Time | LCP resource download | Size-dependent |
| Element Render Delay | Loaded to painted | Minimize |

**Total LCP = TTFB + Load Delay + Load Time + Render Delay**

## Common Bottlenecks

### LCP
- Unoptimized hero images → use WebP/AVIF, add `<link rel="preload">`
- Render-blocking CSS/JS → defer, async, critical CSS inline
- Slow TTFB (>200ms) → CDN, caching, edge compute
- Third-party blocking → defer analytics, chat widgets
- Font delay → `font-display: swap` + preload

### INP
- Long JS tasks on main thread → break tasks <50ms, use `scheduler.yield()`
- Heavy event handlers → debounce, requestAnimationFrame
- Excessive DOM (>1,500 elements)
- Third-party scripts hijacking main thread
- Layout thrashing (forced reflows)

### CLS
- Images/iframes without width/height dimensions
- Dynamic content injected above existing content
- Font swap causing layout shift → preload + font-display
- Ads/embeds without reserved space

## Measurement Sources

### Field Data (used for ranking)
- Chrome User Experience Report (CrUX)
- PageSpeed Insights (uses CrUX)
- Search Console Core Web Vitals report

### Lab Data (for debugging)
- Lighthouse 13.0 (Oct 2025, restructured audits)
- WebPageTest
- Chrome DevTools

## Optimization Priority
1. **LCP** — Most impactful for perceived performance
2. **CLS** — Most common UX issue
3. **INP** — Critical for interactive applications

## API Tools
```bash
# PageSpeed Insights API
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=URL&key=API_KEY"

# Lighthouse CLI
npx lighthouse URL --output json --output-path report.json
```

## 2025–2026 Updates
- **Lighthouse 13.0** (Oct 2025): reorganized performance categories
- **CrUX Vis** replaced CrUX Dashboard (Nov 2025) → cruxvis.withgoogle.com
- **LCP subparts** in CrUX (Feb 2025)
- **Soft Navigations API** (Chrome 139+, July 2025): experimental SPA CWV measurement — no ranking impact yet
