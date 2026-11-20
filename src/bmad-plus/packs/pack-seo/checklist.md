# SEO/GEO 360° Audit Checklist

## Usage
Use this checklist as a template for any website audit. Copy it to your project's output folder and check items as you go.

---

## 1. Technical SEO
- [ ] `robots.txt` exists and is correctly configured
- [ ] `sitemap.xml` exists with all pages, `lastmod`, `changefreq`, `priority`
- [ ] Sitemap includes `xhtml:link` hreflang alternates (if multilingual)
- [ ] Canonical URLs present on all pages
- [ ] Hreflang tags for each language variant
- [ ] Meta robots: `index, follow, max-image-preview:large, max-snippet:-1`
- [ ] HTTPS enforced
- [ ] No render-blocking resources (fonts preloaded, CSS inlined or local)
- [ ] Mobile viewport meta tag present
- [ ] Favicon present (SVG preferred, fallback PNG)
- [ ] 404 error page exists
- [ ] Page load time < 3 seconds

## 2. On-Page SEO
- [ ] `<title>` tag: 50-60 chars, contains primary keyword, unique per page
- [ ] `<meta description>`: 150-160 chars, contains CTA, unique per page
- [ ] `<meta keywords>`: relevant long-tail keywords
- [ ] `<meta author>`: present
- [ ] Single `<h1>` per page, descriptive, keyword-rich
- [ ] Logical H2-H6 hierarchy
- [ ] Images: `alt` tags, `width`/`height`, `loading="lazy"`, WebP format
- [ ] Internal linking between pages
- [ ] External links: `rel="noopener"` on `target="_blank"`
- [ ] Content length adequate (300+ words for landing pages)

## 3. Schema.org / Structured Data
- [ ] Primary schema type (Organization/LocalBusiness/ProfessionalService)
- [ ] Service schema for each service offered
- [ ] FAQPage schema with real Q&As (minimum 5 questions)
- [ ] WebPage schema (datePublished, dateModified, inLanguage)
- [ ] BreadcrumbList schema
- [ ] Person schema for founder/team (if applicable)
- [ ] Review/AggregateRating schema (if applicable)
- [ ] Validated with Google Rich Results Test

## 4. GEO (Generative Engine Optimization)
- [ ] `llms.txt` file at site root with structured business info
- [ ] Content uses clear headings with question-based format
- [ ] FAQ section with expandable answers
- [ ] Concise, factual content per section (answers visible without interaction)
- [ ] AI crawlers allowed in `robots.txt`:
  - [ ] GPTBot
  - [ ] ChatGPT-User
  - [ ] PerplexityBot
  - [ ] ClaudeBot
  - [ ] Google-Extended
- [ ] Content freshness: `dateModified` in schema, visible update dates
- [ ] E-E-A-T signals: author credentials, "About" info, LinkedIn links
- [ ] Tested queries in ChatGPT, Perplexity, and Gemini

## 5. Local SEO
- [ ] Geo meta tags: `geo.region`, `geo.placename`, `geo.position`, `ICBM`
- [ ] NAP (Name, Address, Phone/Email) in footer
- [ ] `<address>` HTML element used
- [ ] Schema includes `geo` (GeoCoordinates), `areaServed`, `address`
- [ ] Google Business Profile created and optimized
- [ ] Local keywords in title, description, and H1
- [ ] Citations on directories (Pages Jaunes, Google Maps, etc.)

## 6. Accessibility
- [ ] Skip navigation link
- [ ] `aria-hidden="true"` on decorative SVGs and elements
- [ ] `aria-label` on `<section>` and `<nav>` elements
- [ ] `aria-pressed` on toggle buttons
- [ ] Color contrast WCAG AA (4.5:1 minimum)
- [ ] Keyboard-navigable form elements
- [ ] `<html lang>` attribute set correctly (dynamic for multilingual)
- [ ] `prefers-reduced-motion` media query support

## 7. Social & Sharing
- [ ] Open Graph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- [ ] `og:site_name` present
- [ ] `og:locale` with `og:locale:alternate` for other languages
- [ ] `og:image` dimensions 1200×630px
- [ ] Twitter Card: `twitter:card` (summary_large_image)
- [ ] Social preview tested with sharing debugger tools

## 8. Multilingual SEO (if applicable)
- [ ] `<html lang>` dynamic based on selected language
- [ ] Bilingual `<title>` and `<meta description>` (via server-side logic)
- [ ] Hreflang tags for each page × each language
- [ ] `x-default` hreflang set
- [ ] Schema.org `description` in correct language
- [ ] OG tags in correct language (`og:locale`)
- [ ] Sitemap includes hreflang alternates per URL
- [ ] Language preference persisted (localStorage/cookie)
- [ ] Auto-detection of browser language (`navigator.language`)
- [ ] Legal pages (Privacy, Terms) translated

## 9. Content & Keywords
- [ ] Primary keyword identified per page
- [ ] Long-tail keyword variants in content
- [ ] Location-based keywords (city, region, country)
- [ ] Service-specific keywords
- [ ] Competitor keyword gap analysis
- [ ] Content matches search intent (informational, transactional, navigational)

## 10. PageSpeed 100% — Performance Perfection Loop
> Reference: See `pagespeed-playbook.md` for complete technique catalog with code examples.

### Performance (Impact-Ordered)
- [ ] Self-hosted fonts (woff2) — no Google CDN
- [ ] Font preload with `fetchpriority="high"` for critical weight
- [ ] `font-display: swap` on all `@font-face` rules
- [ ] ALL CSS inlined in production HTML (zero render-blocking)
- [ ] `.htaccess` cache headers: 1yr for static assets, 1hr for HTML
- [ ] Gzip/Brotli compression enabled (mod_deflate)
- [ ] ALL `<img>` tags have explicit `width` and `height` attributes
- [ ] Below-fold images have `loading="lazy"`
- [ ] LCP image has `fetchpriority="high"`
- [ ] Third-party scripts use `async defer`
- [ ] CLS = 0 (no layout shifts during load)

### Accessibility (WCAG AA)
- [ ] ALL text/background combos ≥ 4.5:1 contrast ratio
- [ ] White text on orange backgrounds replaced with dark text (#1a0800)
- [ ] Dim/muted text on dark backgrounds brightened to ≥ #a0b0b8
- [ ] Badge text with transparency backgrounds ≥ #d4dde3
- [ ] Checked: CTA buttons, active nav states, badges, footer, form labels, tags

### Best Practices
- [ ] No console errors from own code
- [ ] Third-party console errors documented as known limitations
- [ ] All external links have `rel="noopener noreferrer"`
- [ ] All resources loaded over HTTPS

### Anti-Patterns (NEVER DO)
- [ ] ❌ Never use `media="print" onload` for CSS (causes CLS 0.936)
- [ ] ❌ Never load fonts from external CDN without local fallback
- [ ] ❌ Never leave `<img>` tags without width/height dimensions
- [ ] ❌ Never fix contrast issues one at a time (batch ALL at once)

