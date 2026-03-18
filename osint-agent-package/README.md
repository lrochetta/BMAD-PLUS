# 🔍 OSINT Agent Package — BMAD Compatible

Agent d'intelligence OSINT pour les installations BMAD. De un nom ou pseudo à un dossier complet avec psychoprofil, parcours professionnel et grades de confiance.

## Features
- 🔎 Investigation complète Phase 0→6 (recherche → dossier formaté)
- 🧠 Psychoprofile MBTI / Big Five
- 📊 55+ Apify actors (Instagram, LinkedIn, Facebook, TikTok, YouTube...)
- 🌐 7 APIs de recherche (Perplexity, Exa, Tavily, Jina, Parallel, BrightData)
- ⚡ Recherche parallèle multi-moteurs
- 🐍 **100% Python stdlib** — zéro dépendance externe
- 🖥️ **Cross-platform** — Windows, macOS, Linux

## Prérequis
- Python 3.10+
- BMAD Method installé
- Au minimum 1 clé API (voir [SETUP_KEYS.md](SETUP_KEYS.md))

## Installation rapide

### Option 1 : Script automatique (Windows)
```powershell
.\install.ps1
```

### Option 2 : Manuel
1. Copier l'agent dans BMAD :
```
agents/osint-investigator.md  →  {project}/_bmad/bmm/agents/
```

2. Copier les 2 skills :
```
skills/bmad-osint-investigator/  →  {project}/.agents/skills/
skills/bmad-osint-investigate/   →  {project}/.agents/skills/
```

3. Configurer les clés API (voir [SETUP_KEYS.md](SETUP_KEYS.md))

4. Tester :
```
python skills/bmad-osint-investigate/osint/scripts/diagnose.py
```

## Utilisation
1. Invoquer le skill `bmad-osint-investigator` dans votre AI agent
2. L'agent "Shadow" s'active avec son menu :
   - `[INV]` Investigation complète
   - `[QS]` Recherche rapide
   - `[LI]` Scrape LinkedIn
   - `[IG]` Scrape Instagram
   - `[PP]` Psychoprofile
   - `[CE]` Enrichissement contact
   - `[DG]` Diagnostic outils

## Structure du package
```
osint-agent-package/
├── README.md               ← Ce fichier
├── SETUP_KEYS.md            ← Guide de configuration des clés API
├── install.ps1              ← Script d'installation (Windows)
├── install.sh               ← Script d'installation (macOS/Linux)
├── agents/
│   └── osint-investigator.md   ← Agent BMAD "Shadow"
└── skills/
    ├── bmad-osint-investigator/
    │   └── SKILL.md            ← Point d'entrée agent
    └── bmad-osint-investigate/
        ├── SKILL.md            ← Skill d'investigation
        └── osint/
            ├── SKILL.md        ← Pipeline complet (452 lignes)
            ├── assets/         ← Template dossier
            ├── references/     ← Docs plateformes, outils, psycho
            └── scripts/        ← 10 scripts Python (stdlib only)
```

## Sécurité
- ✅ Audit de sécurité complet réalisé (14 fichiers analysés)
- ✅ Aucun trojan, backdoor, ou code malveillant
- ✅ Zéro dépendance externe — uniquement Python stdlib
- ✅ Les clés API restent locales (variables d'environnement)

## Crédits
- Pipeline OSINT basé sur [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT License)
- Apify Actor Runner intégré de [apify/agent-skills](https://github.com/apify/agent-skills) (MIT License)

## Licence
MIT
