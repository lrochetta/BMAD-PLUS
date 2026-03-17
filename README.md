# BMAD+ — Augmented AI-Driven Development Framework

> Fork intelligent de [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.2.0 avec agents multi-rôles, autopilot, exécution parallèle et monitoring upstream.

## 🚀 Quick Start

```bash
npx bmad-plus install
```

## 🏗️ Architecture

### 📦 Core Pack (toujours installé)

| Agent | Persona | Rôles |
|-------|---------|-------|
| **Strategist** | Atlas 🎯 | Analyst, Product Manager |
| **Architect-Dev** | Forge 🏗️ | Architect, Developer, Tech Writer |
| **Quality** | Sentinel 🔍 | QA Engineer, UX Reviewer |
| **Orchestrator** | Nexus 🎼 | Scrum Master, Quick Flow, Autopilot, Parallel Supervisor |

### 📦 Pack OSINT (optionnel)

| Agent | Persona | Capacités |
|-------|---------|-----------|
| **Shadow** | Shadow 🔍 | OSINT Investigation, Psychoprofil, 55+ Apify Actors |

### 📦 Pack Audit Sécurité (bientôt)

| Agent | Persona | Capacités |
|-------|---------|-----------|
| **Shield** | Shield 🛡️ | Scan vulnérabilités, Audit code, Compliance |

## ✨ Innovations

### 🎭 Agents Multi-Rôles
Chaque agent embarque plusieurs rôles spécialisés avec **auto-activation intelligente** à 3 niveaux :
- **Pattern** — Mots-clés détectés dans la demande
- **Contextuel** — Domaine détecté pendant le travail
- **Raisonnement** — Chaîne logique en cours d'exécution

### 🚀 Mode Autopilot
Donnez une idée projet → Nexus orchestre tout le pipeline :
Discovery → Architecture → Sprint → Implementation → QA → Documentation → Livraison

### 🔀 Exécution Parallèle
L'Orchestrateur détecte les tâches indépendantes et les lance en parallèle avec supervision (launch/stop/restart/reallocate/escalate).

### 📱 Monitoring Upstream
Vérification hebdomadaire des changements BMAD-METHOD avec :
- Analyse IA (Gemini API)
- Notifications WhatsApp (Evolution API)
- Auto-PR pour les changements compatibles

## 🖥️ IDE Supportés

| IDE | Fichier Config |
|-----|---------------|
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| Antigravity | `.gemini/` + `.agents/` |
| Codex CLI | `AGENTS.md` |
| OpenCode | `OPENCODE.md` |

## 📁 Structure

```
BMAD+/
├── src/bmad-plus/          ← Module custom
│   ├── agents/             ← 5 agents (4 core + 1 OSINT)
│   ├── skills/             ← 3 skills (autopilot, parallel, sync)
│   └── data/               ← Triggers auto-activation
├── monitor/                ← Surveillance upstream (VPS)
├── mcp-server/             ← Audit 360° MCP (35 tools)
├── osint-agent-package/    ← Package OSINT standalone
└── tools/                  ← CLI installeur
```

## 📄 Licence

MIT — Basé sur [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)
