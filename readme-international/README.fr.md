# 🚀 BMAD+ — Augmented AI-Driven Development Framework

[![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)](../CHANGELOG.md)
[![Based on](https://img.shields.io/badge/based%20on-BMAD--METHOD%20v6.2.0-green.svg)](https://github.com/bmad-code-org/BMAD-METHOD)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](../LICENSE)

<div align="center">
  <a href="../README.md">English</a> | 🌐 <b>Français</b> | <a href="README.es.md">Español</a> | <a href="README.de.md">Deutsch</a>
</div>

> Fork intelligent de [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.2.0 — Agents multi-rôles auto-activables, mode Autopilot, exécution parallèle supervisée, et monitoring upstream WhatsApp.

---

## 📋 Table des matières

- [Pourquoi BMAD+ ?](#-pourquoi-bmad-)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Les 5 Agents](#-les-5-agents)
- [Système de Packs](#-système-de-packs)
- [Innovations](#-innovations)
- [IDE Supportés](#-ide-supportés)
- [Monitoring Upstream](#-monitoring-upstream)
- [Structure du Projet](#-structure-du-projet)
- [Configuration](#-configuration)
- [Version History](#-version-history)
- [Licence](#-licence)

---

## 💡 Pourquoi BMAD+ ?

BMAD-METHOD est un framework excellent avec 9 agents spécialisés. Mais pour un développeur solo ou une petite équipe, 9 agents c'est trop fragmenté. BMAD+ résout ce problème :

| BMAD-METHOD | BMAD+ |
|---|---|
| 9 agents spécialisés | **5 agents multi-rôles** (11 rôles au total) |
| Activation manuelle uniquement | **Auto-activation intelligente** à 3 niveaux |
| Pas de pipeline automatisé | **Mode Autopilot** : idée → livraison |
| Exécution séquentielle | **Parallélisme supervisé** |
| Pas de suivi upstream | **Monitoring hebdomadaire** avec WhatsApp |
| 1-2 IDE supportés | **5 IDE** avec détection automatique |

---

## ⚡ Quick Start

### Installation dans un projet existant

```bash
npx bmad-plus install
```

L'installeur :
1. Détecte automatiquement les IDE installés (Claude Code, Gemini CLI, Codex, etc.)
2. Propose les packs à installer (Core, OSINT, Maker, Audit)
3. Génère les fichiers de configuration adaptés
4. Crée les dossiers d'artefacts

### Utilisation après installation

#### 💬 À qui parler ?

| Tu veux... | Parle à | Exemple |
|---|---|---|
| Discuter d'une idée de projet | **Atlas** 🎯 | `Atlas, j'ai une idée de projet : un SaaS de facturation` |
| Créer un PRD / Product Brief | **Atlas** 🎯 | `Atlas, crée le PRD pour mon projet` |
| Concevoir l'architecture technique | **Forge** 🏗️ | `Forge, propose une architecture pour l'app` |
| Implémenter du code | **Forge** 🏗️ | `Forge, implémente la story AUTH-001` |
| Écrire la documentation | **Forge** 🏗️ | `Forge, documente l'API` |
| Tester / faire une revue de code | **Sentinel** 🔍 | `Sentinel, review le module auth` |
| Planifier un sprint | **Nexus** 🎼 | `Nexus, crée les epics et stories pour le MVP` |
| Tout automatiser de A à Z | **Nexus** 🎼 | `autopilot` puis décris ton projet |
| Investiguer une personne (OSINT) | **Shadow** 🔍 | `Shadow, investigate Jean Dupont` |
| Créer un nouvel agent BMAD+ | **Maker** 🧬 | `Maker, crée un agent de support client` |

#### 🚀 Workflow typique (mode manuel)

```
1. "Atlas, brainstorme sur mon idée de [projet]"
   → Atlas analyse, pose des questions, propose des angles

2. "Atlas, crée le product brief"
   → Deliverable: _bmad-output/discovery/product-brief.md

3. "Atlas, rédige le PRD"
   → Deliverable: _bmad-output/discovery/prd.md

4. "Forge, propose l'architecture"
   → Deliverable: _bmad-output/discovery/architecture.md

5. "Nexus, découpe en epics et stories"
   → Deliverable: _bmad-output/build/stories/

6. "Forge, implémente la story [X]"
   → Code généré + tests

7. "Sentinel, teste et review"
   → Rapport QA + suggestions
```

#### ⚡ Workflow automatique (mode autopilot)

```
> autopilot
> "Un SaaS de facturation pour PME avec gestion des devis"
```

Nexus orchestre tout automatiquement avec des checkpoints pour ton approbation.

#### 🔑 Commandes clés

| Commande | Description |
|----------|-------------|
| `bmad-help` | Voir tous les agents et skills disponibles |
| `autopilot` | Nexus prend le contrôle du pipeline complet |
| `parallel` | Lancer l'exécution multi-agents en parallèle |

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Core["⚙️ Core Pack"]
        AT[Atlas 🎯<br/>Strategist]
        FG[Forge 🏗️<br/>Architect-Dev]
        SN[Sentinel 🔍<br/>Quality]
        NX[Nexus 🎼<br/>Orchestrator]
    end

    subgraph OSINT["🔍 OSINT Pack"]
        SH[Shadow 🔍<br/>OSINT Intel]
    end

    subgraph Audit["🛡️ Audit Pack"]
        SD["Shield 🛡️<br/>(coming soon)"]
    end

    NX -->|orchestre| AT
    NX -->|orchestre| FG
    NX -->|orchestre| SN
    NX -->|peut invoquer| SH

    subgraph Skills["Custom Skills"]
        AP[Autopilot]
        PL[Parallel]
        SY[Sync]
    end

    NX --> AP
    NX --> PL
    NX --> SY

    subgraph VPS["VPS Infrastructure"]
        MCP[MCP Server<br/>35 tools]
        EVO[Evolution API<br/>WhatsApp]
        MON[Weekly Monitor]
    end

    SY --> MCP
    MON --> EVO
    MON --> MCP
```

---

## 🎭 Les 5 Agents

### Atlas — Strategist 🎯

**Fusionne :** Analyst (Mary) + Product Manager (John)

| Rôle | Spécialité | Auto-activation |
|------|-----------|-----------------|
| **Analyst** | Recherche marché, SWOT, benchmarks, domain expertise | "analyse", "marché", "benchmark", nouveau projet |
| **Product Manager** | PRD, product briefs, user stories, roadmaps | "PRD", "roadmap", "MVP", phase planning |

**Capabilities :** Brainstorming (BP), Market Research (MR), Domain Research (DR), Technical Research (TR), Product Brief (CB), PRD (PR), UX Design (CU), Document Project (DP)

---

### Forge — Architect-Dev 🏗️

**Fusionne :** Architect (Winston) + Developer (Amelia) + Tech Writer (Paige)

| Rôle | Spécialité | Auto-activation |
|------|-----------|-----------------|
| **Architect** | Design technique, API, scalabilité, choix stack | "architecture", "API", "schema", +5 fichiers modifiés |
| **Developer** | Implémentation TDD, code review, story execution | "implement", "code", "fix", post-architecture |
| **Tech Writer** | Documentation, diagrammes Mermaid, changelogs | "document", "README", post-implémentation |

**Capabilities :** Architecture (CA), Implementation Readiness (IR), Dev Story (DS), Code Review (CR), Quick Spec (QS), Quick Dev (QD), Document Project (DP)

**Actions critiques (rôle Dev) :**
- Lire TOUTE la story AVANT implémentation
- Exécuter les tâches DANS L'ORDRE
- Tests 100% passants AVANT de passer à la suite
- JAMAIS mentir sur les tests

---

### Sentinel — Quality 🔍

**Fusionne :** QA Engineer (Quinn) + UX Designer (Sally)

| Rôle | Spécialité | Auto-activation |
|------|-----------|-----------------|
| **QA Engineer** | Tests API/E2E, edge cases, coverage, code review | "test", "QA", "bug", post-implémentation |
| **UX Reviewer** | Evaluation UX, accessibilité, interaction design | "UX", "interface", "responsive", changements frontend |

**Capabilities :** QA Tests (QA), Code Review (CR), UX Design (CU)

---

### Nexus — Orchestrator 🎼

**Fusionne :** Scrum Master (Bob) + Quick-Flow Solo Dev (Barry) + **Autopilot** (nouveau) + **Parallel Supervisor** (nouveau)

| Rôle | Spécialité | Auto-activation |
|------|-----------|-----------------|
| **Scrum Master** | Sprint planning, stories, retros, course correction | "sprint", "planning", "backlog" |
| **Quick Flow** | Specs rapides, hotfixes, minimum ceremony | "rapide", "hotfix", "petit fix" |
| **Autopilot** | Pipeline automated idea→delivery avec checkpoints | "autopilot", "gère tout", mode autopilot |
| **Parallel Supervisor** | Multi-agent concurrent, conflict detection, reallocation | "parallèle", tâches indépendantes détectées |

**Capabilities :** Sprint Planning (SP), Create Story (CS), Epics & Stories (ES), Retrospective (ER), Course Correction (CC), Sprint Status (SS), Quick Spec (QS), Quick Dev (QD), **Autopilot (AP)**, **Parallel (PL)**

---

### Shadow — OSINT Intelligence 🔍 *(Pack OSINT)*

**Agent d'investigation OSINT complet.**

| Capability | Description |
|-----------|-------------|
| **INV** | Investigation complète Phase 0→6 avec dossier scoré |
| **QS** | Quick search multi-moteurs |
| **LI/IG/FB** | Scraping LinkedIn, Instagram, Facebook |
| **PP** | Psychoprofil MBTI / Big Five |
| **CE** | Enrichissement contact (email, téléphone) |
| **DG** | Diagnostic des outils/APIs disponibles |

**Stack :** 55+ Apify actors, 7 APIs de recherche, 100% Python stdlib, grades de confiance A/B/C/D

---

### Maker — Agent Creator 🧬 *(Pack Maker)*

**Méta-agent qui crée d'autres agents.** Donne-lui une description → il génère un package complet.

| Code | Description |
|------|-------------|
| **CA** | Create Agent — création guidée en 4 phases |
| **QA** | Quick Agent — création rapide avec défauts sensés |
| **EA** | Edit Agent — modifier un SKILL.md existant |
| **VA** | Validate Agent — vérifier la conformité BMAD+ |
| **PA** | Package Agent — générer le dossier d'intégration |

**Pipeline :** Discovery → Design (validation user) → Generation → Validation
**Output :** `_bmad-output/ready-to-integrate/` — prêt à copier dans BMAD+

---

## 📦 Système de Packs

BMAD+ utilise un système modulaire par packs. Le Core est toujours installé, les packs additionnels sont optionnels.

```
npx bmad-plus install

🎛️  Quels packs installer ?
   Core (Atlas, Forge, Sentinel, Nexus) est toujours inclus.

   🔍 OSINT — Shadow (investigation, scraping, psychoprofil)
   🧬 Agent Creator — Maker (design, build, package)
   🛡️ Audit Sécurité — Shield (scan vulnérabilités) [bientôt]
   🤖 Tout installer
   Aucun — Core uniquement
```

| Pack | Agents | Skills | Status |
|------|--------|--------|--------|
| ⚙️ **Core** | Atlas, Forge, Sentinel, Nexus | autopilot, parallel, sync | ✅ Stable |
| 🔍 **OSINT** | Shadow | bmad-osint-investigate | ✅ Stable |
| 🧬 **Maker** | Maker | — | ✅ Stable |
| 🛡️ **Audit** | Shield | bmad-audit-scan, bmad-audit-report | 🔜 Coming soon |

Chaque pack définit :
- Ses agents et skills
- Ses clés API requises/optionnelles
- Son package externe (si applicable)

---

## ✨ Innovations

### 1. Auto-Activation Intelligente à 3 Niveaux

Chaque agent peut **automatiquement** switcher de rôle quand le contexte le demande :

| Niveau | Mécanisme | Exemple |
|--------|-----------|---------|
| 🔤 **Pattern** | Mots-clés dans la demande | "review" → QA activé |
| 🌐 **Contextuel** | Domaine détecté pendant le travail | Calculs financiers → QA auto-activé après le code |
| 🧠 **Raisonnement** | Chaîne logique en cours d'exécution | Incohérence architecture → Architect auto-activé |

L'agent **annonce** ses auto-activations : *"💡 I'm switching to QA mode — financial calculations detected. Say 'skip' to stay in current mode."*

Configuration : `src/bmad-plus/data/role-triggers.yaml`

### 2. Mode Autopilot

Donnez une idée projet → Nexus orchestre le pipeline complet :

```
📋 Discovery (Atlas)
  └→ Brainstorming → Product Brief → PRD → UX Design
  🔴 CHECKPOINT: Approbation PRD

🏗️ Build (Forge + Sentinel)
  └→ Architecture → Epics → Stories → Sprint
  🔴 CHECKPOINT: Approbation Architecture
  └→ Pour chaque story: Code → Tests → (retry si échec, max 3)
  🟡 NOTIFY: Status story

🚀 Ship (Sentinel + Forge)
  └→ Code Review → UX Review → Documentation → Retro
  🔴 CHECKPOINT: Approbation finale
```

**Checkpoints configurables :**
- `require_approval` (🔴) — Pause, notification WhatsApp, attente
- `notify_only` (🟡) — Notification, continue sauf intervention
- `auto` (🟢) — Continue automatiquement

### 3. Exécution Parallèle Supervisée

L'Orchestrateur détecte les tâches indépendantes et les lance en parallèle :

| Parallélisable ✅ | Séquentiel 🚫 |
|---|---|
| Stories sans dépendances | Même fichier modifié |
| Recherche + audit tech | Story B dépend de Story A |
| Tests + documentation | Architecture avant code |

**Actions de supervision :** Launch, Monitor, Stop, Restart, Reallocate, Escalate (3 échecs → notification humaine)

---

## 🖥️ IDE Supportés

L'installeur détecte automatiquement les IDE et génère les configs :

| IDE | Fichier Config | Détection |
|-----|---------------|-----------|
| Claude Code | `CLAUDE.md` | Dossier `.claude/` |
| Gemini CLI | `GEMINI.md` | Dossier `.gemini/` |
| Antigravity | `.gemini/` + `.agents/` | Extension Antigravity |
| Codex CLI | `AGENTS.md` | Dossier `.codex/` |
| OpenCode | `OPENCODE.md` | Config opencode |

---

## 📡 Monitoring Upstream

### Pipeline hebdomadaire (cron VPS, lundi 9h)

```
1. git fetch upstream BMAD-METHOD
2. Diff analysis (commits, fichiers modifiés)
3. Analyse IA via Gemini API → classification
   🟢 Compatible | 🟡 À vérifier | 🔴 Breaking
4. Notification WhatsApp via Evolution API
5. Auto-PR si changements compatibles
```

### Stack
- **weekly-check.py** — Script principal (cron)
- **ai_analyzer.py** — Analyse IA (Gemini 2.0 Flash)
- **notifier.py** — WhatsApp (Evolution API self-hosted) + email fallback
- **mcp_bridge.py** — Pont vers Audit 360° MCP Server (git/github ops)

---

## 📁 Structure du Projet

```
BMAD+/
├── README.md                      ← Ce fichier (Anglais)
├── readme-international/          ← Traductions en autres langues
├── CHANGELOG.md                   ← Historique des versions
├── CLAUDE.md                      ← Config Claude Code
├── GEMINI.md                      ← Config Gemini CLI
├── AGENTS.md                      ← Config Codex CLI / OpenCode
├── .gitignore
│
├── src/
│   └── bmad-plus/                 ⭐ MODULE CUSTOM
│       ├── module.yaml            ← Config module + packs
│       ├── module-help.csv        ← Aide contextuelle
│       ├── agents/
│       │   ├── agent-strategist/  ← Atlas (analyst + pm)
│       │   ├── agent-architect-dev/ ← Forge (architect + dev + tw)
│       │   ├── agent-quality/     ← Sentinel (qa + ux)
│       │   ├── agent-orchestrator/ ← Nexus (sm + qf + autopilot + parallel)
│       │   ├── agent-maker/       ← Maker (meta-agent) [pack: maker]
│       │   └── agent-shadow/      ← Shadow (osint) [pack: osint]
│       ├── skills/
│       │   ├── bmad-plus-autopilot/ ← Pipeline automatisé
│       │   ├── bmad-plus-parallel/  ← Exécution parallèle
│       │   └── bmad-plus-sync/      ← Synchronisation upstream
│       └── data/
│           └── role-triggers.yaml ← Règles auto-activation
│
├── monitor/                       🤖 SURVEILLANCE VPS
│   ├── weekly-check.py            ← Script principal (cron)
│   ├── ai_analyzer.py             ← Analyse IA (Gemini API)
│   ├── notifier.py                ← WhatsApp + email
│   ├── mcp_bridge.py              ← Pont vers MCP Server
│   ├── config.example.yaml        ← Template configuration
│   └── docker-compose.yml         ← Evolution API
│
├── mcp-server/                    🛡️ AUDIT 360° MCP
│   ├── server.py                  ← 35 tools, 7 modules
│   └── tools/                     ← git_ops, github_ops, etc.
│
├── osint-agent-package/           🔍 OSINT PACKAGE
│   ├── agents/                    ← Agent Shadow (original)
│   ├── skills/                    ← 55+ Apify actors
│   └── install.ps1                ← Script d'installation
│
└── upstream/                      📦 RÉFÉRENCE UPSTREAM
    └── (clone de BMAD-METHOD)     ← Exclu du repo (.gitignore)
```

---

## ⚙️ Configuration

### Variables du module (`module.yaml`)

| Variable | Description | Valeurs |
|----------|-------------|---------|
| `project_name` | Nom du projet | Auto-détecté |
| `user_skill_level` | Niveau du dev | beginner, intermediate, expert |
| `execution_mode` | Mode d'exécution | manual, autopilot, hybrid |
| `auto_role_activation` | Auto-switch de rôles | true, false |
| `parallel_execution` | Parallélisme | true, false |
| `install_packs` | Packs installés | core, osint, maker, audit, all |

### Clés API (selon les packs)

| Clé | Pack | Usage |
|-----|------|-------|
| `GEMINI_API_KEY` | Monitor | Analyse IA des diffs upstream |
| `EVOLUTION_API_KEY` | Monitor | Notifications WhatsApp |
| `APIFY_API_TOKEN` | OSINT | Scraping réseaux sociaux |
| `PERPLEXITY_API_KEY` | OSINT | Recherche enrichie |

---

## 📜 Version History

| Version | Date | Description |
|---------|------|-------------|
| **0.1.0** | 2026-03-17 | 🎉 Foundation — 6 agents (Atlas, Forge, Sentinel, Nexus, Shadow, Maker), 3 skills, pack system, monitoring, multi-IDE support |

Voir [CHANGELOG.md](../CHANGELOG.md) pour le détail complet.

---

## 📄 Licence

MIT — Basé sur [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)

### Crédits

- **BMAD-METHOD** by [bmad-code-org](https://github.com/bmad-code-org) — Framework de base
- **OSINT Pipeline** basé sur [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT)
- **Apify Actor Runner** intégré de [apify/agent-skills](https://github.com/apify/agent-skills) (MIT)
