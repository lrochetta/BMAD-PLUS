# BMAD+

<div align="center">
  <a href="../README.md">English</a> | 🌐 <b>Français</b> | <a href="README.es.md">Español</a> | <a href="README.de.md">Deutsch</a>
</div>

[![Version](https://img.shields.io/badge/version-0.22.0-blue)](https://www.npmjs.com/package/bmad-plus)

**Version 0.22.0** · Node.js `>=20.0.0` · MIT

Des workflows de développement IA propres à chaque projet, avec des rôles clairs, un contexte partagé, des mises à jour sûres et des adaptateurs pour vos outils de code.

[Site web](https://bmad-plus.rochetta.fr/fr/) · [Démarrer](https://bmad-plus.rochetta.fr/fr/docs/#start) · [Exemples](https://bmad-plus.rochetta.fr/fr/docs/#examples) · [Nouveautés](https://bmad-plus.rochetta.fr/fr/docs/#news)

BMAD+ installe des instructions de projet, des rôles et des workflows pour l’outil de code IA que vous utilisez déjà. Par défaut, l’exécution est gérée par l’hôte : votre outil fournit le modèle, les autorisations, l’exécution des commandes et, le cas échéant, le travail d’agents en parallèle. Nexus peut aussi lancer une commande locale ou un processus Codex CLI explicitement planifié sous un superviseur au premier plan, enregistrer son résultat et exiger des vérifications indépendantes avant acceptation. Les autorisations de l’hôte continuent de s’appliquer ; il n’existe ni planificateur en arrière-plan ni intégration universelle au cycle de vie des hôtes. Les abonnements aux modèles et les accès API sont distincts.

Adaptateurs : Claude Code, Gemini CLI, Antigravity, Cursor, Codex CLI, OpenCode, Aider.

## Démarrer

Nécessite Node.js `>=20.0.0`. Certains packs facultatifs nécessitent d’autres environnements ou des accès API. Lancez les commandes du terminal depuis le dossier de votre projet.

### 1. Ouvrir le dossier du projet

Ouvrez un terminal dans le dépôt sur lequel vous souhaitez travailler, puis vérifiez la version de Node.js. Conservez votre méthode habituelle de gestion de versions.

**Dans le terminal du projet :**

```sh
node --version
```

La commande doit afficher v20 ou plus récent. Installez ou mettez à jour Node.js séparément si nécessaire.

### 2. Installer BMAD+ et choisir vos outils

Lancez l’installateur. Sélectionnez les adaptateurs de vos outils IA et les packs utiles au projet. Core contient Atlas, Forge, Sentinel et Nexus.

**Dans le terminal du projet :**

```sh
npx bmad-plus@0.22.0 install
```

L’installateur crée les instructions des agents, le socle partagé et les adaptateurs sélectionnés. Certains packs facultatifs nécessitent d’autres environnements ou des accès API.

### 3. Démarrer une session dans ce même dossier

Ouvrez ou redémarrez votre assistant de code IA dans le projet pour qu’il charge son adaptateur et AGENTS.md. Demandez-lui les agents et workflows installés.

**Dans votre assistant IA :**

```text
bmad-help
```

Aucune commande d’initialisation BMAD+ supplémentaire n’est nécessaire. bmad-help est un message à l’assistant, pas une commande de terminal.

### 4. Confier une tâche précise à un rôle

Décrivez l’objectif, les contraintes et le résultat attendu. Pour une idée nouvelle, commencez avec Atlas. Pour modifier du code existant, commencez avec Forge.

**Dans votre assistant IA :**

```text
Atlas, aide-moi à cadrer une petite application de facturation pour indépendants. Pose des questions sur les utilisateurs, identifie le premier parcours utile et rédige un brief avec des critères d’acceptation.
```

Relisez le brief avant de demander à Forge d’implémenter une story. Un livrable précis facilite la vérification des progrès.

### 5. Vérifier le résultat et conserver le contexte

Demandez à Sentinel de contrôler le changement selon les critères d’acceptation. Demandez les résultats des tests et une courte transmission pour la prochaine session.

**Dans votre assistant IA :**

```text
Sentinel, relis ce changement selon les critères d’acceptation. Vérifie les principaux cas de réussite et d’échec, signale les problèmes restants et résume ce que la prochaine session doit savoir. Si le CLI BMAD+ est disponible, scelle le périmètre avec bmad-plus review scope, applique les règles de sa checklist, cite le code de chaque remarque, rends compte de chaque fichier retenu, puis rapporte ce que répond bmad-plus review gate.
```

Relisez les changements et les résultats des tests. L’assistant suit les autorisations et les capacités de son outil hôte.

## Rôles principaux

| Rôle | Domaine | Objectif |
| --- | --- | --- |
| Atlas | Stratégie & produit | Définir ce qui mérite d’être construit. |
| Forge | Architecture & développement | Rendre le plan concret. |
| Sentinel | Qualité & revue | Trouver ce que le premier passage a manqué. |
| Nexus | Planification & coordination | Faire avancer le travail ensemble. |

## Packs

| Pack | Ce qu’il apporte |
| --- | --- |
| Core | Stratégie, architecture, développement, qualité et coordination avec les quatre rôles principaux. |
| OSINT | Des workflows d’investigation pour recueillir des informations publiques et évaluer les sources. |
| Maker | Un workflow pour concevoir, valider et distribuer vos propres agents BMAD+. |
| Shield | Des workflows spécialisés en conformité et gouvernance, notamment RGPD et ISO 27001. |
| SEO | Inspection technique, analyse de contenu et optimisation pour la recherche, avec des outils dédiés. |
| Memory | Notes de projet, décisions et transmissions entre sessions pour conserver le contexte utile. |
| Dev Studio | Des rôles et workflows spécialisés en produit, design, ingénierie et documentation. |
| Backup | Des instructions et utilitaires pour les sauvegardes horodatées, la restauration et la rotation. |
| Animated | Un workflow dédié à la création de sites dont le défilement s’appuie sur la vidéo. |

## Exemples

### Passer d’une idée à une première version

À utiliser après avoir décrit les utilisateurs et le problème.

```text
Nexus, planifie la première version utilisable de mon application de prise de rendez-vous. Demande à Atlas de cadrer le périmètre, à Forge de proposer l’implémentation minimale et à Sentinel de définir les contrôles d’acceptation. Liste les dépendances et arrête-toi à la revue du plan avant l’implémentation.
```

Résultat attendu : un plan priorisé, une première story limitée et des points de revue explicites.

### Corriger un bug dans un projet existant

Indiquez le comportement observé, les étapes de reproduction et les erreurs pertinentes.

```text
Forge, cherche pourquoi l’enregistrement d’une facture modifiée crée un doublon. Reproduis le problème, trouve sa cause et propose la correction minimale. Ajoute un contrôle de régression correspondant à l’échec réel, puis demande à Sentinel de revoir le parcours concerné.
```

Résultat attendu : un échec reproduit, une correction ciblée et la preuve que la régression est couverte.

### Coordonner du travail indépendant

À utiliser si votre outil hôte gère les agents en parallèle et si les tâches n’écrivent pas dans les mêmes fichiers.

```text
Nexus, découpe le travail approuvé en tâches indépendantes. Donne à chaque rôle un périmètre, des fichiers à sa charge et une définition de terminé. Utilise des agents en parallèle uniquement si cet outil le permet ; sinon, exécute les tâches successivement. Intègre les résultats et demande à Sentinel de vérifier le parcours complet.
```

Résultat attendu : des missions délimitées, des dépendances explicites et une revue intégrée. L’exécution parallèle est fournie par l’outil hôte.

### Faire confirmer une livraison par une personne

À utiliser quand une version arrive sur votre environnement de test et que quelqu’un doit la vérifier à l’écran.

```text
Sentinel, écris la recette de cette livraison sur notre environnement de test. Une étape par geste, un fait vérifiable par ligne, les libellés cités depuis le code, et signale les étapes qui écrivent pour de vrai. Fabrique la page, puis donne-moi le lien, la durée et ce que je ne dois pas sauter. Utilise si possible des données d’essai jetables, nomme le dossier et les fichiers que chaque commande modifie, et distingue les preuves automatisées des réponses de la personne. Avant de me remettre la page, construis-la avec uat build, vérifie les garanties qu’elle liste, joue toi-même le passage essentiel dans un vrai navigateur — démarrer, cocher, écrire une remarque, recharger, tout revient — et dis-moi quels contrôles ont tourné.
```

Résultat attendu : une page qu’une personne non technique peut jouer, et un passage que l’agent relit pour classer chaque échec avant toute correction.

### Sauvegarder une session avec Zecher

À utiliser avant de terminer une session, avec le pack Memory facultatif installé.

```text
Zecher, mets à jour la mémoire de ce projet à partir des changements et des vérifications réellement effectués. Distingue ce qui est développé, testé, publié et encore en attente. Consigne les décisions et les preuves utiles, archive les notes remplacées sans les supprimer et écris un court prompt pour la prochaine session. Garde la mémoire dans ce projet et exclus les secrets.
```

Résultat attendu : un contexte actuel concis, une passation datée et un prompt de reprise qui indique la prochaine tâche inachevée.

### Relire un passage sans deviner

À utiliser lorsqu’une personne a terminé ou interrompu une recette.

```text
Sentinel, lis le dernier passage de recette et compare son empreinte avec la recette actuelle. Demande ce qui a réellement été fait lorsque les réponses et les preuves se contredisent. Classe les échecs avant de proposer des corrections, vérifie les étapes d’écriture en lecture seule et distingue les observations humaines, les contrôles automatisés et toute acceptation explicite de risque par son responsable nommé. Ne valide jamais une étape non réalisée.
```

Résultat attendu : un verdict clair, des preuves pour les écritures confirmées et une courte liste des contrôles qui restent à effectuer.

### Reprendre sans perdre les décisions

À utiliser au début d’une nouvelle session dans le même projet ; aucun pack facultatif n’est nécessaire.

```text
Lis AGENTS.md et la mémoire de projet disponible. Résume le dernier état vérifié, les décisions ouvertes et la prochaine tâche inachevée. Distingue les fonctionnalités publiées des candidates locales, et les contrôles automatisés de la recette humaine. Vérifie que les notes correspondent encore au code avant de continuer.
```

Résultat attendu : une reprise courte et fondée sur des éléments vérifiés. Les notes apportent du contexte, à confronter au travail actuel.

## Nouveautés de la 0.22.0

Ce qui sort de votre machine, déclaré et vérifié

BMAD+ déclare désormais chaque envoi de données et chaque processus qu’il lance, et sa CI refuse tout ce qui n’est pas déclaré. La page de recette et le rapport SEO ne chargent plus rien depuis d’autres sites, les appels OSINT passent uniquement en HTTPS, et Shield gagne un dossier de sécurité fondé sur des preuves exécutées et un registre des traitements IA. Rien ne change dans l’installation ou la mise à jour.

- Le registre indique ce que BMAD+ envoie, à qui, quand et avec quel consentement ; SECURITY.md l’affiche et les instructions installées pour les agents le résument. Une vérification de build échoue quand un appel réseau ou un processus lancé n’est pas déclaré. BMAD+ n’a aucune télémétrie, et la vérification de mise à jour peut être désactivée.
- La page de recette ne charge plus Google Fonts ni rien d’un autre site : l’ouvrir ne le signale à personne. Le build refuse une page qui le ferait, et un vrai navigateur contrôle chaque requête d’un passage. Le rapport HTML SEO s’ouvre aussi hors ligne.
- La clé d’API Google du pack SEO voyage dans un en-tête de requête, jamais dans une URL, et n’apparaît pas dans les messages d’erreur. Les appels aux fournisseurs OSINT refusent tout sauf HTTPS et ne suivent jamais une redirection vers un autre hôte.
- Les captures d’écran SEO n’atteignent que l’adresse vérifiée : Chromium ne résout rien d’autre, et les redirections ou ressources qui pointent ailleurs sont bloquées et listées.
- Shield : bmad-plus assurance construit un dossier de sécurité dont chaque preuve est une vérification réellement exécutée, consignée dans un journal infalsifiable ; bmad-plus ai-register tient le registre des outils IA d’un projet et signale ceux qui n’y figurent pas ; six règles de revue nomment les contrôles de conformité qu’un changement touche.
- Le serveur MCP ferme proprement les flux SSE quand un client part ou que le serveur s’arrête, et accepte les dates de jeton avec un décalage horaire.

## Historique des versions

Ces dates identifient les notes relues du CHANGELOG, pas les dates de publication sur npm. Le site vérifie séparément les dates de publication npm.

| Version | Date des notes | Résumé relu |
| --- | --- | --- |
| 0.22.0 | 2026-09-29 | BMAD+ déclare désormais chaque envoi de données et chaque processus qu’il lance, et sa CI refuse tout ce qui n’est pas déclaré. La page de recette et le rapport SEO ne chargent plus rien depuis d’autres sites, les appels OSINT passent uniquement en HTTPS, et Shield gagne un dossier de sécurité fondé sur des preuves exécutées et un registre des traitements IA. Rien ne change dans l’installation ou la mise à jour. |
| 0.21.0 | 2026-09-28 | Une revue enregistre désormais pourquoi elle s’est arrêtée et ce qu’elle a consommé, écrit un contrôle lisible par une étape de CI, et reprend sur le périmètre qu’elle a scellé. Le récupérateur SEO ne se connecte qu’aux adresses qu’il a validées, et le serveur MCP passe au SDK officiel sous Python 3.12. Rien ne change dans l’installation ou la mise à jour. |
| 0.20.0 | 2026-09-28 | bmad-plus review donne désormais au relecteur les règles qui s’appliquent aux fichiers modifiés, fixe la profondeur d’une revue avant qu’elle commence, compare une revue avec une précédente sans déclarer corrigée une remarque non vérifiée, et masque les identifiants dans ce qu’il écrit. Rien ne change dans l’installation ou la mise à jour. |

[Historique des versions et guide de mise à jour](https://bmad-plus.rochetta.fr/fr/docs/#changelog) · [Toutes les versions publiées sur npm](https://www.npmjs.com/package/bmad-plus?activeTab=versions)

---

## Licence

MIT — Basé sur [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)

BMAD+ est un projet communautaire indépendant dérivé de BMAD-METHOD (MIT) de BMad Code, LLC. Il n’est ni affilié à BMad Code, LLC, ni approuvé ou certifié par cette société. BMad™ et BMad Method™ sont des marques de BMad Code, LLC ; consultez les [règles d’usage des marques BMad](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/TRADEMARK.md).
Attributions et conditions des sources intégrées : [Mentions tierces](../THIRD-PARTY-LICENSES.md).

Le pack OSINT est encadré : toute recherche sur une personne nommée exige une finalité et une base légale consignées. Consultez la [notice juridique OSINT](../osint-agent-package/skills/bmad-osint-investigate/osint/references/gdpr-osint.md) (en anglais).

### Crédits

**Créateur**
- **BMAD+** créé par [Laurent Rochetta](https://github.com/lrochetta) ([LinkedIn](https://www.linkedin.com/in/laurentrochetta/))

**Packs originaux** (créés par Laurent Rochetta)
- **Dev Studio** — 6 agents SDLC spécialisés : Miriam (analyste métier), Huldah (rédactrice technique), Yosef (chef de produit), Rachel (designer UX), Bezalel (architecte système), Oholiab (ingénieur senior) — 38 workflows couvrant tout le cycle, du brainstorming au déploiement
- **SEO Engine** — 3 agents (Scout, Chief, Judge), pipeline d’audit en 6 phases, boucle d’optimisation PageSpeed, intégrations Google Search Console et GA4
- **Memory Pack** — agent Zecher pour une mémoire persistante entre les sessions, avec scanner de projets

**Sources externes et inspirations**
- **BMAD-METHOD** par [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — méthodologie multi-agents d’origine (MIT)
- **Shield GRC** — 27 agents de conformité et 11 workflows adaptés des [compétences GRC de Hemant Naik](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT)
- **Pipeline OSINT** basé sur [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT)
- **Intégration Apify** — assistant OSINT inspiré des [compétences d’agent Apify](https://github.com/apify/agent-skills) (licence Apache-2.0 déclarée en amont ; voir les mentions)
- **Karpathy Guardrails** — adaptation pour le Memory Pack des [recommandations communautaires de forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspirées d’Andrej Karpathy (MIT déclarée en amont)
