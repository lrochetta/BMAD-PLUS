# Guide de Déploiement — Agent Audit SEO/GEO 360°

## Comment déployer cet agent dans un nouveau projet

### Prérequis

Votre projet doit utiliser le framework BMAD (dossier `_bmad/` à la racine).

---

## Méthode 1 : Déploiement BMAD (recommandé)

### Étape 1 — Copier l'agent

```
Copiez le fichier :
  Audit SEO GEO 360/agent/seo-geo-360-auditor.md

Dans le dossier de votre projet :
  {votre-projet}/_bmad/core/agents/seo-geo-360-auditor.md
```

### Étape 2 — Vérifier la config

Assurez-vous que votre `_bmad/core/config.yaml` contient :

```yaml
user_name: Laurent
communication_language: French
document_output_language: English
output_folder: "{project-root}/_bmad-output"
```

### Étape 3 — Activer l'agent

Demandez à votre IA :
> _"Charge l'agent `_bmad/core/agents/seo-geo-360-auditor.md` et active-le"_

L'agent affichera son menu avec les 8 commandes disponibles.

---

## Méthode 2 : Usage standalone (sans BMAD)

### Étape 1 — Copier le dossier complet

```
Copiez le dossier entier :
  Audit SEO GEO 360/

À la racine de votre projet :
  {votre-projet}/Audit SEO GEO 360/
```

### Étape 2 — Utiliser la checklist

Ouvrez `checklist.md` et cochez les items un par un pendant votre audit.

### Étape 3 — Utiliser les templates

Copiez les fichiers depuis `templates/` vers la racine web de votre site :

| Template | Destination | Action |
|---|---|---|
| `templates/robots.txt` | `{site}/robots.txt` | Remplacez `YOUR-DOMAIN.com` |
| `templates/llms.txt` | `{site}/llms.txt` | Remplissez les `[BRACKETS]` |
| `templates/schema-templates.json` | Dans le `<head>` | Copiez les blocs JSON-LD nécessaires |

---

## Structure de dossiers

```
votre-projet/
├── _bmad/
│   └── core/
│       ├── agents/
│       │   ├── bmad-master.md
│       │   └── seo-geo-360-auditor.md    ← ICI (méthode BMAD)
│       ├── config.yaml
│       └── ...
├── website/  (ou public/, src/, etc.)
│   ├── robots.txt       ← Généré par l'agent
│   ├── sitemap.xml      ← Généré par l'agent
│   ├── llms.txt         ← Généré par l'agent
│   └── index.php/html   ← Schema.org injecté ici
└── _bmad-output/
    └── seo-geo-audit-360.md  ← Rapport d'audit généré
```

---

## Commandes rapides une fois l'agent activé

| # | Commande | Ce que ça fait |
|---|---|---|
| `FA` | Audit complet 360° | Analyse tout et génère un rapport |
| `GF` | Génère les fichiers | Crée robots.txt, sitemap, llms.txt, Schema |
| `SC` | Scorecard | Scores rapides sur 10 par catégorie |
| `FAQ` | Génère la FAQ | Section FAQ + FAQPage Schema bilingue |
| `GA` | Audit GEO | Focus optimisation pour ChatGPT/Perplexity/Gemini |

---

## Projets compatibles

Cet agent fonctionne avec **tout type de projet web** :

- PHP (WordPress, Laravel, sites statiques)
- JavaScript (Next.js, Nuxt, Vite, React)
- HTML statique
- Python (Django, Flask)
- Sites JAMstack (Astro, Gatsby, Hugo)

L'agent détecte automatiquement le framework et adapte ses recommandations.
