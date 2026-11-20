# 🎯 PageSpeed Perfection Playbook — Battle-Tested Guide

> **Version 1.0.0** — Based on 6+ real-world iterations achieving 99-100% on oveanet.ch, montpellier.ai, and oveanet.fr
> By Laurent ROCHETTA × AI

---

## 📐 Architecture: The 4-Phase Protocol

```
Phase 1: DIAGNOSTIC → Extract scores, identify all failing audits
Phase 2: PERFORMANCE → Self-host fonts → Inline CSS → Cache → CLS
Phase 3: ACCESSIBILITY → WCAG AA contrast fixes (systematic)
Phase 4: BEST PRACTICES & SEO → Console errors, security, meta tags
```

Each phase runs sequentially. **Backup before each phase.** Re-test after each phase.

---

## ⚠️ Anti-Patterns — Things That BREAK Scores

> [!CAUTION]
> These are real mistakes made during optimization that caused score REGRESSIONS.

### 🔴 NEVER: Async CSS Loading
```html
<!-- ❌ DISASTER — causes CLS 0.936 on mobile -->
<link rel="stylesheet" href="styles.css" media="print" onload="this.media='all'"/>
<noscript><link rel="stylesheet" href="styles.css"/></noscript>
```
**What happens:** The page renders with no styles, then FLASHES when CSS loads. PageSpeed measures this as a massive Cumulative Layout Shift (0.936 — nearly maximum). Performance dropped from 86 to 75.

**Fix:** Either load CSS synchronously or inline it entirely.

### 🔴 NEVER: External Font CDN Without Fallback
```html
<!-- ❌ Adds 300-800ms to LCP on mobile 4G -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700" rel="stylesheet"/>
```
**What happens:** DNS lookup + TLS handshake to `fonts.googleapis.com`, then another to `fonts.gstatic.com`. On 4G simulation, this adds 500ms+ to LCP.

### 🔴 NEVER: Images Without Dimensions
```html
<!-- ❌ Causes CLS because browser doesn't know the space to reserve -->
<img src="logo.svg" alt="Logo"/>
```
**Fix:** Always add `width` and `height`:
```html
<img src="logo.svg" alt="Logo" width="100" height="20"/>
```

---

## 🏆 Technique Catalog — Ordered by Impact

### [P1] Self-Host Fonts (Biggest LCP Win)

**Impact:** LCP -30-50% on mobile, eliminates 2 external requests

**Step 1:** Download fonts from Google Fonts API or copy from existing projects:
```
fonts/
├── space-grotesk-400-latin.woff2
├── space-grotesk-600-latin.woff2
└── space-grotesk-700-latin.woff2
```

**Step 2:** Update CSS `@font-face` declarations:
```css
/* ✅ Self-hosted — zero external requests */
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('fonts/space-grotesk-400-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('fonts/space-grotesk-600-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('fonts/space-grotesk-700-latin.woff2') format('woff2');
}
```

**Step 3:** Preload critical fonts in HTML `<head>`:
```html
<link rel="preload" href="fonts/space-grotesk-400-latin.woff2"
      as="font" type="font/woff2" crossorigin fetchpriority="high"/>
<link rel="preload" href="fonts/space-grotesk-600-latin.woff2"
      as="font" type="font/woff2" crossorigin/>
```

**Step 4:** Remove ALL Google Fonts CDN references:
```diff
-<link rel="preconnect" href="https://fonts.googleapis.com"/>
-<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
-<link href="https://fonts.googleapis.com/css2?..." rel="stylesheet"/>
+<!-- Fonts are self-hosted, no external CDN needed -->
```

### How to get woff2 files from Google Fonts:
```bash
# Method 1: Use google-webfonts-helper
# https://gwfh.mranftl.com/fonts

# Method 2: Direct download with curl (set woff2 user-agent)
curl -H "User-Agent: Mozilla/5.0" \
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" \
  | grep -oP 'url\(\K[^)]+' | while read url; do
    wget "$url" -P fonts/
  done
```

---

### [P2] Inline ALL CSS (Zero Render-Blocking)

**Impact:** Eliminates render-blocking CSS request, reduces FCP by 100-300ms

**For PHP sites** (like montpellier.ai):
```php
<!-- ✅ CSS inlined at build time — zero render-blocking -->
<style><?php echo file_get_contents(__DIR__ . '/styles.css'); ?></style>
```

**For static HTML sites** (build script):

PowerShell build script:
```powershell
# build-dist.ps1 — Inline CSS into HTML for production
$css = Get-Content "styles.css" -Raw
$html = Get-Content "index.html" -Raw

$cssInline = "  <style>`n$css`n  </style>"

# Replace the critical CSS + external link with full inline
$pattern = '  <!-- Critical CSS.*?</style>\s*\r?\n.*?<link rel="stylesheet" href="styles.css"/>'
$html = $html -replace $pattern, $cssInline

$html | Set-Content "dist/index.html" -Encoding UTF8
```

Bash build script:
```bash
#!/bin/bash
# build-dist.sh — Inline CSS into HTML for production
CSS=$(cat styles.css)
sed -e '/<!-- Critical CSS/,/<link rel="stylesheet"/c\  <style>'"$CSS"'</style>' \
    index.html > dist/index.html
```

> [!IMPORTANT]
> Keep source files separate (index.html + styles.css) for development.
> Only the dist/ version gets the inlined CSS for production.

---

### [P3] Cache Headers (.htaccess Template)

**Impact:** Fixes "Use efficient cache policy" audit

```apache
# === PageSpeed Cache & Compression — Ready to Deploy ===

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault "access plus 1 month"
  ExpiresByType text/html "access plus 1 hour"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
  ExpiresByType application/font-woff2 "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\.(css|js|svg|png|webp|woff2|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\.(html|php)$">
    Header set Cache-Control "public, max-age=3600, must-revalidate"
  </FilesMatch>
  <FilesMatch "\.(txt|xml)$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>
</IfModule>

# Gzip Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript
  AddOutputFilterByType DEFLATE text/javascript application/json text/xml
  AddOutputFilterByType DEFLATE image/svg+xml text/plain
</IfModule>
```

---

### [P4] CLS Prevention Checklist

| Element | Required Fix |
|---------|-------------|
| `<img>` tags | Add `width` and `height` attributes |
| CSS-loaded fonts | Use `font-display: swap` |
| CSS loading | NEVER use `media="print" onload` trick |
| Dynamic content | Reserve space with min-height |
| Embeds/iframes | Set explicit dimensions |

---

## 🎨 Accessibility — Contrast Ratio Reference

### The Rule
WCAG AA requires **4.5:1** contrast ratio for normal text, **3:1** for large text (18px+ or 14px+ bold).

### Common Color Combos on Dark Backgrounds (#0B0C15)

| Text Color | Hex | Ratio vs #0B0C15 | Pass? |
|-----------|-----|:-----------------:|:-----:|
| Pure white | `#ffffff` | 19.2:1 | ✅ |
| Light gray | `#d4dde3` | 12.5:1 | ✅ |
| Medium gray | `#a0b0b8` | 6.5:1 | ✅ |
| Muted gray | `#b0bec5` | 8.0:1 | ✅ |
| Dim gray | `#6b7b8a` | 3.7:1 | ❌ |
| Very dim | `#4a5568` | 2.3:1 | ❌ |

### Common Color Combos on Orange (#E8632B)

| Text Color | Hex | Ratio vs #E8632B | Pass? |
|-----------|-----|:-----------------:|:-----:|
| White | `#ffffff` | 3.3:1 | ❌ FAIL |
| Light cream | `#fff5e6` | 3.1:1 | ❌ FAIL |
| Dark brown | `#1a0800` | 8.5:1 | ✅ |
| Black | `#000000` | 4.0:1 | ✅ (large) |

> [!WARNING]
> **White text on orange buttons is a classic fail.** Ratio is only 3.3:1.
> Use dark text (`#1a0800`) instead for buttons, badges, and active states with orange backgrounds.

### Elements Commonly Flagged by PageSpeed
1. **CTA buttons** (`.btn-primary`) — white on primary color
2. **Active language buttons** (`.lang-btn.active`) — white on primary
3. **Pricing badges** ("Most Popular") — white on primary
4. **Footer text** — dim on very dark background
5. **Form labels** — muted on dark
6. **Badge text** (partner badges, sponsor badges) — muted on dark with transparency

---

## 📊 Score Tracking Template

```markdown
| Iteration | Perf (M) | A11y (M) | Perf (D) | A11y (D) | BP  | SEO | Changes |
|:---------:|:--------:|:--------:|:--------:|:--------:|:---:|:---:|---------|
| Baseline  | ?        | ?        | ?        | ?        | ?   | ?   | Initial |
| #1        |          |          |          |          |     |     |         |
| #2        |          |          |          |          |     |     |         |
```

---

## 🔧 PageSpeed JavaScript Extraction Snippets

Use these in the browser to extract structured data from PageSpeed results:

### Extract All Scores
```javascript
JSON.stringify({
  gauges: Array.from(document.querySelectorAll('.lh-gauge__percentage'))
    .map(g => g.textContent.trim()),
  labels: Array.from(document.querySelectorAll('.lh-gauge__label'))
    .map(l => l.textContent.trim())
});
```

### Extract Core Web Vitals
```javascript
JSON.stringify({
  metrics: Array.from(document.querySelectorAll('.lh-metric'))
    .map(m => ({
      name: m.querySelector('.lh-metric__title')?.textContent?.trim(),
      value: m.querySelector('.lh-metric__value')?.textContent?.trim()
    }))
});
```

### Extract Failing Audits
```javascript
JSON.stringify({
  failed: Array.from(document.querySelectorAll('.lh-audit--fail .lh-audit__title'))
    .map(a => a.textContent.trim().substring(0, 150)),
  warnings: Array.from(document.querySelectorAll('.lh-audit--average .lh-audit__title'))
    .map(a => a.textContent.trim().substring(0, 150))
});
```

---

## 🏁 Exit Conditions

The PageSpeed Perfection Loop STOPS when:
- ✅ **ALL 4 scores = 100/100** → Perfection achieved
- ⚠️ **After 8 iterations** → Report remaining issues with root cause analysis
- 🟡 **Only server-side issues remain** (TTFB, CDN, HTTP/2) → Report as "requires server-side changes"
- 🟡 **Only third-party script issues remain** (Cloudflare Turnstile, analytics) → Report as "not fixable client-side"

---

*Built with ❤️ in Montpellier, France — by Laurent ROCHETTA × AI*
