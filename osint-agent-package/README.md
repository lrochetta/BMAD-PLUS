# 🔍 OSINT Agent Package — BMAD Compatible

> [!WARNING]
> **Avis juridique et éthique — à lire avant toute utilisation / Legal & ethics notice**
>
> - **Base légale obligatoire (RGPD art. 6).** Toute collecte ou analyse de données sur une personne identifiable est un traitement de données personnelles : il faut une base légale documentée (intérêt légitime mis en balance, obligation légale, mission d'intérêt public…) *avant* de lancer une investigation. La consigner dans [`lawful-basis-record.md`](skills/bmad-osint-investigate/osint/assets/lawful-basis-record.md).
> - **Données sensibles (RGPD art. 9).** Opinions politiques, religion, santé, orientation sexuelle, données biométriques, etc. sont interdites de traitement sauf exception de l'art. 9(2). Le psychoprofilage peut *inférer* ce type de données : ne pas le faire sans base légale explicite.
> - **Pas de profilage de particuliers sans base légale.** Aucun ciblage, surveillance ou profilage de personnes privées (ex-conjoint, voisin, salarié, candidat…) par curiosité ou pour harceler. Les personnalités publiques ne sont couvertes que pour leur rôle public.
> - **Conditions d'utilisation des plateformes.** Le scraping (Apify, LinkedIn, Instagram, Facebook, TikTok…) peut violer les CGU des plateformes et le droit local ; vérifier avant usage.
> - **Responsabilité de l'utilisateur.** Vous êtes le responsable de traitement : BMAD+ fournit un outil, pas une autorisation. Le résultat est généré par IA, peut être faux et doit être vérifié par un humain avant toute décision.
>
> Cadre de référence : [`gdpr-osint.md`](skills/bmad-osint-investigate/osint/references/gdpr-osint.md). La porte de conformité intégrée à l'agent (« Phase −1 — Lawful Basis Gate » du `SKILL.md`, qui refuse toute investigation nominative sans base légale) reste active et ne doit pas être contournée.
>
> *EN — You need a documented GDPR Art. 6 lawful basis (and an Art. 9(2) exception for special-category data) before investigating anyone; respect platform ToS; never profile private individuals without a legal basis; you, the user, are the data controller and bear full responsibility.*

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
- Outil Python Apify issu du pipeline OSINT ci-dessus ; inspiration des [skills Apify](https://github.com/apify/agent-skills), dont le dépôt déclare Apache-2.0. Voir les [notices tierces BMAD+](../THIRD-PARTY-LICENSES.md).

## Licence
MIT
