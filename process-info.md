# 🧠 BMAD+ : Mémoire & Processus de Déploiement (AI / Master Protocol)

> **⚠️ NOTE AUX FUTURES IA (Antigravity, Claude, etc.)** :  
> Ce document contient les règles architecturales et les protocoles de publication stricts du projet BMAD+. Lisez-le avant de proposer des fusions, des publications NPM ou de modifier l'architecture système.

---

## 🏗️ 1. Architecture "Golden vs Distribution"

BMAD+ fonctionne avec une architecture à double dépôt pour isoler l'infrastructure privée du code open-source.

### A. Le "Golden Repo" (Privé)
- **URL** : `lrochetta/BMAD-PLUS-GOLDEN`
- **Rôle** : L'environnement de travail quotidien. Il contient TOUT.
- **Dossiers sensibles inclus** : `monitor/` (VPS/Evolution API), `mcp-server/` (Audit 360), `secrets/` (Tokens d'accès).
- **Règle absolue** : Les secrets (ex: `github_pat.txt`) doivent toujours rester dans des répertoires ignorés par `.gitignore` (ex: `secrets/`).

### B. Le "Distribution Repo" (Public)
- **URL** : `lrochetta/BMAD-PLUS`
- **Rôle** : La vitrine publique que les développeurs clonent.
- **Règle absolue** : Ne **JAMAIS** pousser de code manuellement sur ce dépôt. Il est écrasé/mis à jour exclusivement par la GitHub Action du Golden Repo.

---

## 🚀 2. Processus de Release (Mise à jour d'une version)

Lorsque Laurent demande de "publier une nouvelle version", suivez EXCLUSEMENT ces étapes dans l'ordre :

### Étape 1 : Préparation & Documentation
1. Mettre à jour `CHANGELOG.md` avec la nouvelle version et les changements.
2. Mettre à jour le numéro de version dans `package.json`.
3. **Règle d'Internationalisation** : Si le `README.md` principal (anglais) a été modifié, vérifier et demander la synchronisation avec les versions traduites dans `readme-international/` (fr, es, de).

### Étape 2 : Publication NPM (Node Package Manager)
1. Demander à Laurent de taper `npm login` dans son terminal s'il n'est pas connecté.
2. Une fois loggué, lancer publiquement le package :
   ```bash
   npm publish --access public
   ```
   *(Laurent devra cliquer sur le lien d'authentification web qui s'ouvrira dans son navigateur pour valider le 2FA NPM).*

### Étape 3 : Synchronisation vers le Dépôt Public (Distribution)
1. S'assurer que tout le code est commité sur le master du Golden Repo.
2. Lancer la GitHub Action de distribution en ligne de commande :
   ```bash
   gh workflow run publish-distribution.yml
   ```
   *Ce script clonera le repo, supprimera les dossiers privés (`monitor`, `mcp-server`, `secrets`), remplacera le README par `README-DIST.md`, et fera un force-push sur la branche principale du repo public `lrochetta/BMAD-PLUS`.*

---

## 🤖 3. Modifications des Agents (Pack Maker / Core)

- Si un agent Core est modifié, mettre à jour son `SKILL.md` dans `src/bmad-plus/agents/`.
- Tout nouvel agent public doit être intégré à l'installeur interactif Node.js (`tools/cli/commands/install.js`) et listé dans la constante `PACKS`.
- Ajouter la ou les "Capabilities" de l'agent dans le `README.md` et `README-DIST.md`.
- Assurez-vous que les dépendances externes d'un agent public ne requièrent pas l'infrastructure VPS locale de Laurent.

---

## 👨‍💻 4. Informations d'Auteur

Lorsqu'on génère de la documentation ou des fichiers de base, l'attribution doit être claire :
- **Framework** : "BMAD+ created by Laurent Rochetta"
- **Oveanet Agents** : "By Oveanet × Laurent Rochetta"
- **LinkedIn** : `https://www.linkedin.com/in/laurentrochetta/`
- **GitHub** : `https://github.com/lrochetta/BMAD-PLUS`
- **Oveanet** : `https://oveanet.fr`

---

## 🔀 5. Synchronisation Oveanet → BMAD+

### Architecture
Le dossier `oveanet-pack/` dans BMAD+ contient 3 agents utilitaires fusionnés depuis le projet **oveanet-agents** :
- `seo-audit-360/` — Audit SEO + AI en 9 catégories
- `universal-backup/` — Backup ZIP horodaté intelligent
- `animated-website/` — Site scroll animé de luxe depuis vidéo

### Source de Vérité
- **`oveanet-pack/` dans le Golden BMAD+** est la source de vérité pour ces agents.
- Si un agent est modifié dans le repo `oveanet-agents-dev`, copier manuellement les changements vers `oveanet-pack/` dans le Golden BMAD+.

### Processus de mise à jour d'un agent Oveanet
1. Modifier l'agent dans `oveanet-pack/<agent-name>/`
2. Bump la version dans `package.json`
3. Commit + push sur le Golden
4. `npm publish --access public`
5. `gh workflow run publish-distribution.yml`

### Ce qui est inclus dans NPM
Le tableau `files` de `package.json` inclut `oveanet-pack`, donc les 3 agents sont distribués avec `npx bmad-plus install`.
