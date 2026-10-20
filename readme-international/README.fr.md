# BMAD+

<div align="center">
  <a href="../README.md">English</a> | 🌐 <b>Français</b> | <a href="README.es.md">Español</a> | <a href="README.de.md">Deutsch</a>
</div>

[![Version](https://img.shields.io/badge/version-0.23.1-blue)](https://www.npmjs.com/package/bmad-plus)

**Version 0.23.1** · Node.js `>=20.0.0` · MIT

Dix packs de rôles et de workflows IA propres à chaque projet (design, SEO, GRC, OSINT, mémoire), avec un intake qui pose les questions avant d’agir, des swarms sous budget, des mises à jour sûres et des adaptateurs pour sept outils de code IA

[Site web](https://bmad-plus.rochetta.fr/fr/) · [Démarrer](https://bmad-plus.rochetta.fr/fr/docs/#start) · [Exemples](https://bmad-plus.rochetta.fr/fr/docs/#examples) · [Nouveautés](https://bmad-plus.rochetta.fr/fr/docs/#news)

BMAD+ installe des instructions de projet, des rôles et des workflows pour l’outil de code IA que vous utilisez déjà. Par défaut, l’exécution est gérée par l’hôte : votre outil fournit le modèle, les autorisations, l’exécution des commandes et, le cas échéant, le travail d’agents en parallèle. Nexus peut aussi lancer une commande locale ou un processus Codex CLI explicitement planifié sous un superviseur au premier plan, enregistrer son résultat et exiger des vérifications indépendantes avant acceptation. Les autorisations de l’hôte continuent de s’appliquer ; il n’existe ni planificateur en arrière-plan ni intégration universelle au cycle de vie des hôtes. Les abonnements aux modèles et les accès API sont distincts.

BMAD+ propose dix packs. Demander d’abord : `bmad-plus intake` pose les questions d’un pack quelques-unes à la fois, propose des valeurs par défaut, consigne ce que vous ignorez et produit le brief sur lequel le pack travaille ensuite. Swarms : `bmad-plus swarm` distribue des unités simulées, remet un brief à chaque sous-agent, valide chaque réponse et ne compte que les valides, dans un budget que vous fixez. Atelier, le moteur de design du pack Design, construit, audite et refait des interfaces selon des règles vérifiables.

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
npx bmad-plus@0.23.1 install
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
| SEO | SEO classique et GEO, visibilité dans les réponses générées par IA : inspection technique et performance (Scout), qualité du contenu, données structurées et préparation à la recherche par IA (Judge), notation, stratégie et rapports (Chief). |
| Memory | Notes de projet, décisions et transmissions entre sessions pour conserver le contexte utile. |
| Dev Studio | Des rôles et workflows spécialisés en produit, design, ingénierie et documentation. |
| Backup | Des instructions et utilitaires pour les sauvegardes horodatées, la restauration et la rotation. |
| Animated | Un workflow dédié à la création de sites dont le défilement s’appuie sur la vidéo. |
| Design | Atelier, le moteur de design : construire, auditer et refondre des interfaces selon des règles vérifiables, interview d’abord. |

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

### Concevoir un écran avec Atelier

À utiliser avec le pack Design facultatif installé. Atelier pose d’abord ses questions, puis suit des règles vérifiables.

```text
Atelier, fais la lecture design de la liste des factures de mon application, construis l’écran et termine par le verdict de pré-vol.
```

Résultat attendu : la lecture design enregistrée, l’écran avec tous ses états couverts, et le verdict de pré-vol cité en dernière ligne.

## Nouveautés de la 0.23.1

Un site plus fidèle, des commandes plus régulières

Le site de documentation est refait en quatre langues, avec sept vidéos. Plusieurs commandes se comportent désormais exactement comme leurs pages le disent : les refus se lisent partout de la même façon, une revue de l’arbre de travail part de HEAD et le fichier de configuration est du YAML simple. Installation et mise à jour ne changent pas.

- Le site compte désormais 52 pages de documentation, chacune en anglais, français, espagnol et allemand, une landing refaite et sept vidéos de présentation avec sous-titres et transcriptions décrites, dont une étude de cas sur la refonte du site lui-même par un essaim d’agents.
- Une mise à jour --auto que la politique n’autorise pas est refusée avec le même message partout : Update refused: automatic-updates-not-authorized. Les refus pour inventaire de propriété ancien et pour conflits locaux suivent la même forme Update refused:.
- bmad-plus review scope --workspace part de HEAD quand vous ne donnez pas --base : relire du travail non commité n’échoue plus et n’embarque plus le dernier commit.
- _bmad/config.yaml est écrit en YAML simple (auto_role_activation: true, et non un !!bool 'true' typé), quelle que soit la version prise en charge de js-yaml qui l’écrit.
- Les fichiers d’instructions générés demandent de passer le contrôle de version sans le mentionner quand npx ne trouve pas de copie locale de bmad-plus ; les erreurs de Nexus portent une seule fois le préfixe Nexus: au lieu de deux.
- Shield nomme PCI DSS v4.0.1 partout, les compétences swarm annoncent trois types, la variante Bash du pack Backup affiche la taille de l’archive comme la variante PowerShell, et la description npm, les mots-clés et les crédits du README sont mis à jour.

## Historique des versions

Ces dates identifient les notes relues du CHANGELOG, pas les dates de publication sur npm. Le site vérifie séparément les dates de publication npm.

| Version | Date des notes | Résumé relu |
| --- | --- | --- |
| 0.23.1 | 2026-10-19 | Le site de documentation est refait en quatre langues, avec sept vidéos. Plusieurs commandes se comportent désormais exactement comme leurs pages le disent : les refus se lisent partout de la même façon, une revue de l’arbre de travail part de HEAD et le fichier de configuration est du YAML simple. Installation et mise à jour ne changent pas. |
| 0.23.0 | 2026-10-17 | Un pack déclare désormais les questions auxquelles il lui faut une réponse avant d’agir, et Nexus peut lancer un essaim de sous-agents, un panel simulé ou un jury, dans un budget que vous fixez. Atelier, le moteur de design, devient le dixième pack. Installation et mise à jour ne changent pas. |
| 0.22.0 | 2026-09-29 | BMAD+ déclare désormais chaque envoi de données et chaque processus qu’il lance, et sa CI refuse tout ce qui n’est pas déclaré. La page de recette et le rapport SEO ne chargent plus rien depuis d’autres sites, les appels OSINT passent uniquement en HTTPS, et Shield gagne un dossier de sécurité fondé sur des preuves exécutées et un registre des traitements IA. Rien ne change dans l’installation ou la mise à jour. |

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

**Écrit par Laurent Rochetta**
- **Extensions de Core** — Autopilot, Parallel et Sync (0.1.0), exécution durable de Nexus (0.15.0), recettes d’acceptation humaine (`uat`, 0.16.0), revues vérifiables (0.19.0), et en 0.23.0 l’intake de pack (`bmad-plus intake`) et le runtime de swarm (`bmad-plus swarm`), avec les champs du registre et la barrière de déclencheurs qui les alimentent
- **Dev Studio** — 6 agents SDLC spécialisés : Miriam (analyste métier), Huldah (rédactrice technique), Yosef (chef de produit), Rachel (designer UX), Bezalel (architecte système), Oholiab (ingénieur senior) — 38 workflows, écrits comme instructions BMAD+ originales ; les noms des personas et la filiation des workflows reconnaissent BMAD-METHOD 6.6.0 (MIT). Le registre du pack est `src/bmad-plus/packs/pack-dev-studio/upstream-sync.yaml`
- **Maker** — concevoir, construire, valider et empaqueter vos propres agents BMAD+ (2026-03-17)
- **Design** — Atelier, bâti sur le paquet npm public de l’auteur [design-skill](https://github.com/lrochetta/design-skill) (MIT) : le paquet fournit les trois skills et leurs règles, BMAD+ ajoute le persona, l’intake et l’aiguillage
- **Memory** — agent Zecher pour une mémoire persistante entre les sessions, avec scanner de projets et détection de cerveau ; les Karpathy guardrails qu’il intègre sont adaptés, voir plus bas
- **SEO** — 3 agents (Scout, Chief, Judge), pipeline d’audit en 6 phases, boucle d’optimisation PageSpeed, intégrations Google Search Console et GA4 ; la version 2.0 a reconstruit le premier agent d’audit SEO, écrit chez Oveanet, et conservé son playbook PageSpeed
- **Backup** et **Animated** — sauvegardes de projet horodatées et sites web à défilement vidéo ; écrits chez Oveanet, la société de Laurent Rochetta, et intégrés à BMAD+ en 0.2.0 (2026-03-18) avec le premier agent SEO

**Dérivé de BMAD-METHOD** (MIT)
- **BMAD-METHOD** par [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — méthodologie multi-agents d’origine (MIT) ; BMAD+ est un dérivé indépendant, pas une version officielle
- **Core** — Atlas, Forge, Sentinel et Nexus : BMAD+ est né d’un fork de BMAD-METHOD 6.2.0 et a été étendu par Laurent Rochetta (voir Extensions de Core ci-dessus). Les quatre personas suivent son format de persona et reprennent une partie de la formulation de ses personas analyste (Atlas), architecte (Forge), QA (Sentinel) et scrum master (Nexus) ; la fusion de rôles en un persona commutable et l’activation automatique sont des ajouts de BMAD+

**Adapté d’autres projets open source**
- **Shield** — 27 agents de conformité + 11 workflows adaptés des [compétences GRC de Hemant Naik](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT), avec leurs 79 fichiers de référence ; les workflows RGPD et AI Act s’inspirent aussi de l’architecture du catalogue de compétences [Lawve.ai](https://lawve.ai) (Oliver Schmidt-Prietz). L’orchestrateur, la cartographie entre référentiels, les modèles de rapport, le dossier d’assurance, le registre des traitements IA et les règles de revue de conformité sont des ajouts de BMAD+
- **OSINT** — pipeline et assistants Python adaptés de [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT) ; la barrière de base légale et la notice juridique sont des ajouts de BMAD+
- **Intégration Apify** — assistant OSINT inspiré des [compétences d’agent Apify](https://github.com/apify/agent-skills) (licence Apache-2.0 déclarée en amont ; voir les mentions)
- **Karpathy Guardrails** — adaptation pour Memory des [recommandations communautaires de forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspirées d’Andrej Karpathy (MIT déclarée en amont)
