# Hreflang — Audit Rules & Best Practices (March 2026)

> Author: Laurent Rochetta | BMAD+ SEO Engine v2.0

## What is Hreflang?

`hreflang` tells search engines which language/region version of a page to serve.
Errors cause wrong language indexing, duplicate content penalties, and lost organic traffic.

---

## Implementation Methods

| Method | Best For | Max Pages |
|--------|----------|-----------|
| `<link>` in `<head>` | Small sites (<50 pages) | ~50 |
| HTTP header `Link:` | Non-HTML files (PDFs) | ~50 |
| Sitemap `<xhtml:link>` | Large sites (50+) | Unlimited |

> **Recommendation**: Use sitemap for sites with 50+ pages. HTTP headers for non-HTML resources.

---

## Validation Rules

### Rule 1: Valid Language Codes
- Use **ISO 639-1** (2-letter): `en`, `fr`, `de`, `es`, `ja`, `zh`
- Optional **ISO 3166-1 Alpha-2** for region: `en-US`, `en-GB`, `fr-FR`, `fr-CA`, `pt-BR`
- **Case insensitive** but convention is lowercase lang, uppercase country

| ✅ Valid | ❌ Invalid | Why |
|---------|-----------|-----|
| `en` | `english` | Must be ISO 639-1 |
| `fr-FR` | `fr-FRA` | Country must be 2-letter |
| `zh-Hans` | `cn` | `cn` is not a valid language code |
| `x-default` | `default` | Must use exact `x-default` |

### Rule 2: Self-Referencing (MANDATORY)
Every page MUST include a hreflang tag pointing to itself.

```html
<!-- On the English page (example.com/en/) -->
<link rel="alternate" hreflang="en" href="https://example.com/en/" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/" />
<link rel="alternate" hreflang="x-default" href="https://example.com/en/" />
```

**Error if missing**: Google may ignore all hreflang tags on that page.

### Rule 3: Return Tags (MANDATORY)
If page A links to page B with hreflang, page B MUST link back to page A.

```
Page A (en) → hreflang="fr" → Page B (fr)
Page B (fr) → hreflang="en" → Page A (en)   ← MANDATORY
```

**Error if missing**: Called "orphan hreflang" — Google ignores the one-way tag.

### Rule 4: x-default (STRONGLY RECOMMENDED)
Designate a fallback page for users whose language/region doesn't match any variant.

```html
<link rel="alternate" hreflang="x-default" href="https://example.com/" />
```

Common choices for x-default:
- Language selector/redirect page
- English version (most common)
- Homepage of the main domain

### Rule 5: Canonical + Hreflang Consistency
- Each hreflang URL **must be the canonical version** (not a redirect, not a URL with parameters)
- If a page has `rel="canonical"` pointing elsewhere, hreflang tags on that page are **ignored**
- Canonical and hreflang must agree: don't have hreflang point to a URL that canonicalizes to a different URL

### Rule 6: Absolute URLs Only
```html
<!-- ✅ Correct -->
<link rel="alternate" hreflang="fr" href="https://example.com/fr/page" />

<!-- ❌ Wrong -->
<link rel="alternate" hreflang="fr" href="/fr/page" />
```

### Rule 7: No Hreflang on Non-200 Pages
- Don't include hreflang tags on pages that return 3xx, 4xx, or 5xx
- Don't point hreflang to pages that redirect

---

## Common Error Patterns

### Error 1: Missing Return Tags
**Symptom**: hreflang is configured on the main language but not on alternate versions.
**Fix**: Add reciprocal hreflang tags on ALL language variants.

### Error 2: Wrong Canonical + Hreflang
**Symptom**: Page A hreflang → Page B, but Page B canonical → Page C.
**Fix**: Align canonical and hreflang targets.

### Error 3: Missing Self-Reference
**Symptom**: Page lists other language versions but not itself.
**Fix**: Add `hreflang` tag with the current page's own language/URL.

### Error 4: Inconsistent URLs
**Symptom**: hreflang uses `http://` but site is on `https://`, or trailing slash mismatch.
**Fix**: Use exact canonical URL (protocol, www/non-www, trailing slash).

### Error 5: Language vs Region Confusion
**Symptom**: Using `hreflang="fr"` for France and `hreflang="fr"` for Canada.
**Fix**: Use `hreflang="fr-FR"` and `hreflang="fr-CA"` to differentiate.

### Error 6: Missing x-default
**Symptom**: Users in unsupported regions see random language version.
**Fix**: Add `x-default` pointing to language selector or English version.

---

## Sitemap Implementation (Recommended for 50+ pages)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/en/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/page"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/page"/>
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/page"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/page"/>
  </url>
</urlset>
```

---

## Audit Checklist

| # | Check | Priority |
|---|-------|----------|
| 1 | All hreflang language codes are valid ISO 639-1 | 🔴 Critical |
| 2 | All hreflang country codes are valid ISO 3166-1 | 🔴 Critical |
| 3 | Every page has self-referencing hreflang | 🔴 Critical |
| 4 | All hreflang tags have return tags | 🔴 Critical |
| 5 | All hreflang URLs are absolute | 🔴 Critical |
| 6 | x-default is specified | 🟠 High |
| 7 | Hreflang URLs match canonical URLs | 🟠 High |
| 8 | No hreflang on non-200 pages | 🟠 High |
| 9 | No hreflang pointing to redirecting URLs | 🟠 High |
| 10 | Consistent protocol (https) and www/non-www | 🟡 Medium |
| 11 | Language/region differentiation correct | 🟡 Medium |
| 12 | Sitemap implementation for 50+ pages | 🟡 Medium |
