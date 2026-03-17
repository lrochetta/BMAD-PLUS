# Architecture de Déploiement : Golden Repo vs Distribution Repo

Ce document décrit la stratégie de déploiement "Golden vs Distribution" pour le projet BMAD+. Le but est de te permettre de développer confortablement sur ton environnement complet (Golden), tout en distribuant automatiquement une version "propre" et sécurisée au grand public (Distribution).

---

## 1. Le Concept

### 🏆 Le "Golden Repo" (Ton dépôt privé/complet)
C'est le dépôt où tu travailles tous les jours : `lrochetta/BMAD-PLUS`.
Il contient la **totalité** du projet, y compris tes configurations d'infrastructure personnelles :
- ✅ Le code source des agents (`src/bmad-plus/`)
- ✅ Les scripts d'installation CLI (`tools/cli/`)
- 🔒 L'infrastructure de surveillance VPS (`monitor/`) : Evolution API, Webhooks WhatsApp.
- 🔒 Le Serveur MCP privatif (`mcp-server/`) : Ponts API, opérations Git.
- 🔒 Les packages "locaux" ou en cours de dev (ex: `osint-agent-package/` ou versions privées de Shield).

### 🌍 Le "Distribution Repo" (Dépôt public)
C'est le dépôt que tout le monde voit et installe : ex. `lrochetta/BMAD-METHOD-PLUS` (ou simplement `bmad-plus` publié sur npm).
Il ne contient **que** ce qui est utile pour l'utilisateur final :
- ✅ Le framework de base
- ✅ L'installeur NPM (`npx bmad-plus install`)
- ✅ Un README adapté "Grand Public" (sans les références au VPS ou à Evolution API auxquels ils n'ont pas accès).
- ❌ Pas de trace de ton VPS.
- ❌ Pas de scripts MCP propres à ton serveur.

---

## 2. Le Workflow de Publication (CI/CD Automatisé)

Nous allons mettre en place une **GitHub Action** sur le Golden Repo. 
Quand tu seras prêt à publier une nouvelle version publique (par exemple : `v0.1.0`), tu créeras un "Tag" ou une "Release" sur GitHub. 

Voici ce que l'automatisation fera en tâche de fond (en 30 secondes) :

1. **Clone** du Golden Repo (`BMAD-PLUS`).
2. **Nettoyage (Scrubbing)** : Le script supprime les dossiers privés :
   ```bash
   rm -rf monitor/
   rm -rf mcp-server/
   rm -rf private-experiments/
   ```
3. **Réécriture (Sanitization)** :
   - Le script remplace le fichier `module.yaml` ou le `.gitignore` si nécessaire.
   - Il swappe le `README.md` actuel avec un `README-DIST.md` spécialement conçu pour le public.
4. **Publication GitHub (Push cross-repo)** :
   - Le code "propre" est forcé (`git push --force` ou commité proprement) vers le véritable dépôt public URL (Distribution Repo).
5. **Publication NPM** (Optionnelle mais recommandée) :
   - Le script fait un `npm publish` pour mettre à jour la commande `npx bmad-plus install` utilisée dans le monde entier.

---

## 3. Pourquoi c'est la seule bonne méthode ?

1. **Sécurité Absolue** : Même avec un `.gitignore` parfait, il suffit d'une erreur (un `git add -f config.yaml`) pour fuiter une clé API ou une IP de serveur VPS. Sur un repo privé "Golden", ça n'a pas d'impact. Sur un repo public, c'est mortel.
2. **Clarté pour l'utilisateur (DX)** : Un développeur qui clone/installe le repo n'a pas envie de télécharger des dossiers Docker ou des scripts Python (`monitor/`) qu'il ne pourra de toute façon pas exécuter.
3. **Zéro Friction de Développement pour Toi** : Tu n'as pas à avoir deux projets ouverts dans VSCode. Tu codes, tu testes, tout marche ensemble. L'export vers le public est "magique" et automatisé.

---

## 4. Ce qu'il reste à implémenter pour activer ce système :

1. **Créer le dépôt GitHub de destination** (vide pour le moment) qui sera le "Distribution Repo".
2. **Créer le fichier `README-DIST.md`** à la racine de ce dossier (le README sans les sections VPS/Monitoring).
3. **Créer le fichier `.github/workflows/publish-distribution.yml`** qui contiendra le script de transfert.
4. **Créer un "Personal Access Token" (PAT)** sur ton compte GitHub pour que l'Action GitHub du repo privé ait le droit d'écrire sur le repo public.
