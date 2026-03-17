---
description: How to update README translations when the main English README changes
---

# README International Update Workflow

When the main `README.md` (English) is updated, all translations in `readme-international/` must be updated too.

## Translation files

| Language | File |
|----------|------|
| 🇫🇷 French | `readme-international/README.fr.md` |
| 🇪🇸 Spanish | `readme-international/README.es.md` |
| 🇩🇪 German | `readme-international/README.de.md` |
| 🇨🇳 Chinese | `readme-international/README.zh.md` |
| 🇧🇷 Portuguese | `readme-international/README.pt.md` |

## Steps

1. After updating `README.md`, identify what changed (new agents, packs, features, commands)
2. Update each translation file with the equivalent changes
3. The translations are **condensed** versions — they contain:
   - Quick start section
   - "Who to talk to" agent usage table
   - Key commands
   - Pack system table
   - Link to main English README for full documentation
4. Commit with message: `i18n: update translations for [description of change]`
5. Push to GitHub

## Important rules

- Main README is ALWAYS in **English**
- Translations link back to main README for complete docs
- All 5 translations must stay in sync
- When adding a new agent or pack, add it to ALL translation files' usage tables
