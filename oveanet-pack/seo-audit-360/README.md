# Audit SEO / GEO 360° — Agent BMAD Réutilisable

> **v3.0.0** — PageSpeed Perfection Playbook battle-tested ajouté

Agent expert automatisé pour auditer et optimiser n'importe quel site web pour les moteurs de recherche classiques ET les moteurs IA. Inclut désormais un **playbook PageSpeed 4 phases** testé en production (6+ itérations, 99-100% atteint).

## Structure

```
Audit SEO GEO 360/
├── README.md                    ← Ce fichier
├── agent/
│   └── seo-geo-360-auditor.md   ← Agent BMAD (format XML persona)
├── checklist.md                 ← Checklist complète à cocher (10 sections)
├── pagespeed-playbook.md        ← 🆕 Playbook PageSpeed battle-tested
└── templates/
    ├── robots.txt               ← Template robots.txt universel
    ├── llms.txt                 ← Template llms.txt pour IA
    └── schema-templates.json    ← Templates Schema.org
```

## Comment utiliser

### Option 1 : Comme agent BMAD
Copiez `agent/seo-geo-360-auditor.md` dans votre dossier `_bmad/core/agents/` et activez l'agent.

### Option 2 : En standalone
Utilisez la `checklist.md` comme guide d'audit manuel et les templates comme base pour vos fichiers SEO.

### Option 3 : Via l'IA
Demandez à votre assistant IA : _"Charge l'agent `Audit SEO GEO 360/agent/seo-geo-360-auditor.md` et lance un audit complet de mon site"_.

## Fonctionnalités de l'agent

| Commande | Description |
|---|---|
| `[FA]` | Audit complet 360° (les 10 catégories) |
| `[TA]` | Audit technique SEO uniquement |
| `[GA]` | Audit GEO (optimisation pour IA) uniquement |
| `[LA]` | Audit SEO local |
| `[GF]` | Génère robots.txt, sitemap.xml, llms.txt, Schema.org |
| `[FAQ]` | Génère section FAQ + FAQPage Schema |
| `[I18N]` | Optimisation SEO/GEO multilingue |
| `[SC]` | Scorecard rapide (scores sur 10) |
| `[PS]` | 🆕 **PageSpeed Perfection Loop** — Boucle itérative 4 phases vers 100% |
| `[AB]` | Auto-Backup avec scores dans le nom |

## Catégories d'audit

1. **Technical SEO** — robots.txt, sitemap, canonical, hreflang, performance
2. **On-Page SEO** — title, meta, H1/H2, images, contenu
3. **Schema.org** — ProfessionalService, FAQPage, Service, WebPage
4. **GEO** — llms.txt, contenu structuré pour IA, FAQ, crawlers IA
5. **Local SEO** — geo tags, NAP, Google Business Profile
6. **Accessibility** — skip-nav, aria, contrast WCAG AA, keyboard
7. **Social** — Open Graph, Twitter Cards, og:locale
8. **Multilingual** — html lang, hreflang, bilingual meta/schema
9. **Content** — keywords, intent, location-based targeting
10. **PageSpeed 100%** — 🆕 Self-host fonts, inline CSS, cache, CLS, contrastes

