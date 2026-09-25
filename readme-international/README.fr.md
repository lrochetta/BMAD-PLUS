# BMAD+

<div align="center">
  <a href="../README.md">English</a> | 🌐 <b>Français</b> | <a href="README.es.md">Español</a> | <a href="README.de.md">Deutsch</a>
</div>

[![Version](https://img.shields.io/badge/version-0.18.0-blue)](https://www.npmjs.com/package/bmad-plus)

**Version 0.18.0** · Node.js `>=20.0.0` · MIT

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
npx bmad-plus@0.18.0 install
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
Sentinel, relis ce changement selon les critères d’acceptation. Vérifie les principaux cas de réussite et d’échec, signale les problèmes restants et résume ce que la prochaine session doit savoir.
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

## Nouveautés de la 0.18.0

Des pages de recette qui gardent chaque réponse

La page de recette vérifie désormais chaque enregistrement, restaure vos réponses au rechargement avant toute autre chose, distingue les passages d’autres révisions et d’autres onglets, et nomme seize garanties que la construction refuse de perdre. Rien ne change dans l’installation ou la mise à jour ; reconstruisez vos pages de recette pour obtenir la nouvelle page.

- Une écriture dans le navigateur ne compte qu’une fois relue. Un enregistrement refusé (quota, fenêtre privée, stockage bloqué) est nommé sur la page, quitter est questionné et l’export reste possible — la page ne dit jamais « enregistré » sur parole.
- Vos réponses reviennent au rechargement avant que le serveur local ou la base de l’artefact ne répondent, et la copie la plus récente gagne toujours : une copie distante plus ancienne n’écrase jamais ce que vous venez de cocher.
- Un passage qui a répondu à une autre révision de la recette est proposé, pas réinjecté : les lignes inchangées gardent leurs réponses, les lignes modifiées sont redemandées, le passage précédent reste intact et exportable, et le nouveau passage note d’où viennent ses réponses.
- Deux onglets ou deux appareils sur le même passage convergent vers la dernière modification et le disent. Un passage enregistré illisible est signalé et exportable, jamais supprimé.
- La barre de progression expose la part de lignes renseignées — renseignées, pas réussies — avec les comptes vu, pas vu et bloqué ; la page dit où vivent les réponses et ce qui peut les faire disparaître.
- Terminer avec des lignes non renseignées est questionné sur la page même et confirmé par un second clic ; un passage terminé dit qu’il n’est pas une validation, et une modification faite après la fin est datée et affichée.
- uat build liste les seize garanties que porte la page et refuse un gabarit qui en a perdu une ; uat serve refuse une copie plus ancienne d’un passage et tout nom d’hôte autre que le sien. Un nom sans lettre latine signe son passage par une empreinte stable.
- Le skill de recette demande à l’agent de construire la page avec la commande, jamais à la main, de jouer le passage essentiel dans un vrai navigateur avant de la remettre, et de dire quels contrôles ont tourné. Les textes de la page gagnent vingt-deux phrases en dix langues.

## Historique des versions

Ces dates identifient les notes relues du CHANGELOG, pas les dates de publication sur npm. Le site vérifie séparément les dates de publication npm.

| Version | Date des notes | Résumé relu |
| --- | --- | --- |
| 0.18.0 | 2026-09-25 | La page de recette vérifie désormais chaque enregistrement, restaure vos réponses au rechargement avant toute autre chose, distingue les passages d’autres révisions et d’autres onglets, et nomme seize garanties que la construction refuse de perdre. Rien ne change dans l’installation ou la mise à jour ; reconstruisez vos pages de recette pour obtenir la nouvelle page. |
| 0.17.1 | 2026-09-24 | Installer par-dessus une autre version s’arrête désormais et renvoie vers update, une réinstallation conserve vos réglages, et les mises à jour retirent les fichiers qu’une version ne livre plus en gardant une sauvegarde restaurable. Certains comportements d’installation changent : vérifiez vos scripts avant de les relancer. |
| 0.17.0 | 2026-09-22 | Les pages de recette empêchent désormais la perte silencieuse des réponses et les exports vides. Une recette se construit avec son identifiant, et les contrôles de publication utilisent directement Node sous Windows. Les guides ajoutent des prompts pour relire les résultats et conserver le contexte du projet. |

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
