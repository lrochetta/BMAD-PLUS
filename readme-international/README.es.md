# 🚀 BMAD+ — Framework de Desarrollo Impulsado por IA Aumentada

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](../CHANGELOG.md)
[![Based on](https://img.shields.io/badge/based%20on-BMAD--METHOD%20v6.2.0-green.svg)](https://github.com/bmad-code-org/BMAD-METHOD)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](../LICENSE)

<div align="center">
  <a href="../README.md">English</a> | <a href="README.fr.md">Français</a> | 🌐 <b>Español</b> | <a href="README.de.md">Deutsch</a>
</div>

> Fork inteligente de [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.2.0 — Agentes multirrol con auto-activación, modo Autopilot, ejecución paralela supervisada y monitorización upstream por WhatsApp.

---

## 📋 Tabla de contenidos

- [¿Por qué BMAD+?](#-por-qué-bmad-)
- [Inicio Rápido](#-inicio-rápido)
- [Arquitectura](#-arquitectura)
- [Los 5 Agentes](#-los-5-agentes)
- [Sistema de Packs](#-sistema-de-packs)
- [Innovaciones](#-innovaciones)
- [IDE Soportados](#-ide-soportados)
- [Monitorización Upstream](#-monitorización-upstream)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración)
- [Historial de Versiones](#-historial-de-versiones)
- [Licencia](#-licencia)

---

## 💡 ¿Por qué BMAD+?

BMAD-METHOD es un excelente framework con 9 agentes especializados. Pero para un desarrollador en solitario o un equipo pequeño, 9 agentes está demasiado fragmentado. BMAD+ resuelve este problema:

| BMAD-METHOD | BMAD+ |
|---|---|
| 9 agentes especializados | **5 agentes multirrol** (11 roles en total) |
| Activación manual únicamente | **Auto-activación inteligente** en 3 niveles |
| Sin pipeline automatizado | **Modo Autopilot**: idea → entrega |
| Ejecución secuencial | **Paralelismo supervisado** |
| Sin seguimiento upstream | **Monitorización semanal** con WhatsApp |
| 1-2 IDEs soportados | **5 IDEs** con auto-detección |

---

## ⚡ Inicio Rápido

### Instalación en un proyecto existente

```bash
npx bmad-plus install
```

El instalador:
1. Detecta automáticamente los IDE instalados (Claude Code, Gemini CLI, Codex, etc.)
2. Ofrece los packs a instalar (Core, OSINT, Maker, Audit)
3. Genera los archivos de configuración adaptados
4. Crea las carpetas de artefactos

### Uso después de la instalación

#### 💬 ¿Con quién hablar?

| Quieres... | Habla con | Ejemplo |
|---|---|---|
| Discutir una idea de proyecto | **Atlas** 🎯 | `Atlas, tengo una idea de proyecto: un SaaS de facturación` |
| Crear un PRD / Product Brief | **Atlas** 🎯 | `Atlas, crea el PRD para mi proyecto` |
| Diseñar la arquitectura técnica | **Forge** 🏗️ | `Forge, propón una arquitectura para la app` |
| Implementar código | **Forge** 🏗️ | `Forge, implementa la historia AUTH-001` |
| Redactar documentación | **Forge** 🏗️ | `Forge, documenta la API` |
| Probar / realizar revisión de código | **Sentinel** 🔍 | `Sentinel, revisa el módulo auth` |
| Planificar un sprint | **Nexus** 🎼 | `Nexus, crea épicas e historias para el MVP` |
| Automatizar todo de la A a la Z | **Nexus** 🎼 | `autopilot` luego describe tu proyecto |
| Investigar a una persona (OSINT) | **Shadow** 🔍 | `Shadow, investiga a John Doe` |
| Crear un nuevo agente BMAD+ | **Maker** 🧬 | `Maker, crea un agente de soporte al cliente` |

#### 🚀 Flujo de trabajo típico (modo manual)

```
1. "Atlas, haz una lluvia de ideas sobre mi [proyecto]"
   → Atlas analiza, hace preguntas, propone enfoques

2. "Atlas, crea el product brief"
   → Entregable: _bmad-output/discovery/product-brief.md

3. "Atlas, redacta el PRD"
   → Entregable: _bmad-output/discovery/prd.md

4. "Forge, propón la arquitectura"
   → Entregable: _bmad-output/discovery/architecture.md

5. "Nexus, divide en épicas e historias"
   → Entregable: _bmad-output/build/stories/

6. "Forge, implementa la historia [X]"
   → Código generado + pruebas

7. "Sentinel, prueba y revisa"
   → Informe de QA + sugerencias
```

#### ⚡ Flujo de trabajo automático (modo autopilot)

```
> autopilot
> "Un SaaS de facturación para pymes con gestión de presupuestos"
```

Nexus orquesta todo automáticamente con puntos de control (checkpoints) para tu aprobación.

#### 🔑 Comandos clave

| Comando | Descripción |
|----------|-------------|
| `bmad-help` | Ver todos los agentes y habilidades disponibles |
| `autopilot` | Nexus toma el control del pipeline completo |
| `parallel` | Iniciar ejecución multi-agente en paralelo |

---

## 🏗️ Arquitectura

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
        SD["Shield 🛡️<br/>(muy pronto)"]
    end

    NX -->|orquesta| AT
    NX -->|orquesta| FG
    NX -->|orquesta| SN
    NX -->|puede invocar| SH

    subgraph Skills["Custom Skills"]
        AP[Autopilot]
        PL[Parallel]
        SY[Sync]
    end

    NX --> AP
    NX --> PL
    NX --> SY

    subgraph VPS["Infraestructura VPS"]
        MCP[MCP Server<br/>35 tools]
        EVO[Evolution API<br/>WhatsApp]
        MON[Weekly Monitor]
    end

    SY --> MCP
    MON --> EVO
    MON --> MCP
```

---

## 🎭 Los 5 Agentes

### Atlas — Strategist 🎯

**Fusiona:** Analyst (Mary) + Product Manager (John)

| Rol | Especialidad | Auto-activación |
|------|-----------|-----------------|
| **Analyst** | Investigación de mercado, FODA, benchmarks | "analiza", "mercado", "benchmark", nuevo proyecto |
| **Product Manager** | PRD, product briefs, historias de usuario, roadmaps | "PRD", "roadmap", "MVP", fase de planificación |

**Capacidades:** Brainstorming (BP), Market Research (MR), Domain Research (DR), Technical Research (TR), Product Brief (CB), PRD (PR), UX Design (CU), Document Project (DP)

---

### Forge — Architect-Dev 🏗️

**Fusiona:** Architect (Winston) + Developer (Amelia) + Tech Writer (Paige)

| Rol | Especialidad | Auto-activación |
|------|-----------|-----------------|
| **Architect** | Diseño técnico, API, escalabilidad, elección de stack | "arquitectura", "API", "schema", +5 archivos modificados |
| **Developer** | Implementación TDD, revisión de código, historias | "implementa", "código", "fix", post-arquitectura |
| **Tech Writer** | Documentación, diagramas Mermaid, changelogs | "documenta", "README", post-implementación |

**Capacidades:** Architecture (CA), Implementation Readiness (IR), Dev Story (DS), Code Review (CR), Quick Spec (QS), Quick Dev (QD), Document Project (DP)

**Acciones críticas (rol Dev):**
- Leer TODA la historia ANTES de implementar
- Ejecutar las tareas EN ORDEN
- 100% pruebas aprobadas ANTES de avanzar
- NUNCA mentir sobre las pruebas

---

### Sentinel — Quality 🔍

**Fusiona:** QA Engineer (Quinn) + UX Designer (Sally)

| Rol | Especialidad | Auto-activación |
|------|-----------|-----------------|
| **QA Engineer** | Pruebas API/E2E, edge cases, cobertura, revisión de código | "prueba", "QA", "bug", post-implementación |
| **UX Reviewer** | Evaluación de UX, accesibilidad, diseño de interacción | "UX", "interfaz", "responsive", cambios frontend |

**Capacidades:** QA Tests (QA), Code Review (CR), UX Design (CU)

---

### Nexus — Orchestrator 🎼

**Fusiona:** Scrum Master (Bob) + Quick-Flow Solo Dev (Barry) + **Autopilot** (nuevo) + **Parallel Supervisor** (nuevo)

| Rol | Especialidad | Auto-activación |
|------|-----------|-----------------|
| **Scrum Master** | Planificación de sprints, historias, retrospectivas | "sprint", "planificación", "backlog" |
| **Quick Flow** | Specs rápidas, hotfixes, mínima ceremonia | "rápido", "hotfix", "pequeño fix" |
| **Autopilot** | Pipeline automatizado idea→entrega con checkpoints | "autopilot", "gestiona todo", modo autopilot |
| **Parallel Supervisor** | Múltiples agentes en concurrencia, reasignación | "paralelo", tareas independientes detectadas |

**Capacidades:** Sprint Planning (SP), Create Story (CS), Epics & Stories (ES), Retrospective (ER), Course Correction (CC), Sprint Status (SS), Quick Spec (QS), Quick Dev (QD), **Autopilot (AP)**, **Parallel (PL)**

---

### Shadow — OSINT Intelligence 🔍 *(Pack OSINT)*

**Agente completo de investigación OSINT.**

| Capacidad | Descripción |
|-----------|-------------|
| **INV** | Investigación completa Fase 0→6 con informe puntuado |
| **QS** | Búsqueda rápida multi-motor |
| **LI/IG/FB** | Scraping de LinkedIn, Instagram, Facebook |
| **PP** | Psicoperfil MBTI / Big Five |
| **CE** | Enriquecimiento de contactos (email, teléfono) |
| **DG** | Diagnóstico de herramientas/APIs disponibles |

**Tecnología:** MÁS de 55 actores de Apify, 7 APIs de búsqueda, python estándar 100%, grados A/B/C/D

---

### Maker — Agent Creator 🧬 *(Pack Maker)*

**Meta-agente que crea otros agentes.** Dale una descripción → genera un paquete completo.

| Capacidad | Descripción |
|------|-------------|
| **CA** | Create Agent — creación guiada en 4 fases |
| **QA** | Quick Agent — creación rápida con valores por defecto con sentido |
| **EA** | Edit Agent — modificar un SKILL.md existente |
| **VA** | Validate Agent — verificar cumplimiento BMAD+ |
| **PA** | Package Agent — generar carpeta de integración |

**Pipeline:** Discovery → Design (aprobación del usuario) → Generación → Validación
**Salida:** `_bmad-output/ready-to-integrate/` — listo para copiar a BMAD+

---

## 📦 Sistema de Packs

BMAD+ utiliza un sistema modular por packs. El Core siempre está instalado, y los demás packs son opcionales.

```
npx bmad-plus install

🎛️  ¿Qué packs instalar?
   Core (Atlas, Forge, Sentinel, Nexus) siempre incluido.

   🔍 OSINT — Shadow (investigación, scraping, psicoperfil)
   🧬 Agent Creator — Maker (diseño, desarrollo, empaque)
   🛡️ Auditoría de Seguridad — Shield (muy pronto)
   🤖 Instalar todo
   Ninguno — Solo Core
```

| Pack | Agentes | Habilidades | Estado |
|------|--------|--------|--------|
| ⚙️ **Core** | Atlas, Forge, Sentinel, Nexus | autopilot, parallel, sync | ✅ Estable |
| 🔍 **OSINT** | Shadow | bmad-osint-investigate | ✅ Estable |
| 🧬 **Maker** | Maker | — | ✅ Estable |
| 🛡️ **Audit** | Shield | bmad-audit-scan, bmad-audit-report | 🔜 Muy pronto |

Cada pack define:
- Sus agentes y habilidades
- Llaves de API obligatorias/opcionales
- Paquete externo (en tu caso, osint)

---

## ✨ Innovaciones

### 1. Auto-Activación Inteligente a 3 Niveles

Cada agente puede **automáticamente** cambiar de rol según el contexto:

| Nivel | Mecanismo | Ejemplo |
|--------|-----------|---------|
| 🔤 **Patrón** | Palabras clave en el pedido | "revisa" → QA activado |
| 🌐 **Contexto** | Detecta el tipo de tarea | Cálculos financieros detectados → QA auto-activado tras escribir código |
| 🧠 **Razonamiento** | Cadena lógica | Inconsistencia de arquitectura → Architec auto-activado |

El agente **anuncia** el cambio: *"💡 I'm switching to QA mode — financial calculations detected. Say 'skip' to stay in current mode."*

Configuración: `src/bmad-plus/data/role-triggers.yaml`

### 2. Modo Autopilot

Introduce una idea → Nexus gestionará todo:

```
📋 Discovery (Atlas)
  └→ Brainstorming → Product Brief → PRD → UX Design
  🔴 CHECKPOINT: Aprobación del PRD

🏗️ Build (Forge + Sentinel)
  └→ Arquitectura → Épicas → Historias → Sprint
  🔴 CHECKPOINT: Aprobación de Arquitectura
  └→ Por historia: Código → Pruebas → (reintentos si falla, máximo 3)
  🟡 NOTIFY: Estado de la historia

🚀 Ship (Sentinel + Forge)
  └→ Revisión de Código → UX → Documentación → Retrospectiva
  🔴 CHECKPOINT: Aprobación final
```

**Puntos de control (checkpoints) configurables:**
- `require_approval` (🔴) — Pausa, notifica por WhatsApp, espera
- `notify_only` (🟡) — Notifica, continúa (a menos que el usuario intervenga)
- `auto` (🟢) — Totalmente automático

### 3. Ejecución Paralela Supervisada

El orquestador divide las tareas asíncronas para ejecutarlas de forma paralela:

| Proceso paralelo ✅ | Proceso secuencial 🚫 |
|---|---|
| Múltiples historias sin dependencia | Tareas en el mismo archivo |
| Research + revisión técnica de arquitectura | Historia B depende de A |
| Tests QA + documentación en docs | Arquitectura antes que el código |

**Supervisión en ejecución:** Iniciar, Detener, Reiniciar, Escalar (si un agente falla más de 3 veces, avisa al desarrollador)

---

## 🖥️ IDE Soportados

El instalador detecta automáticamente el IDE actual para generar la configuración nativa que conecte a BMAD+:

| IDE | Archivo de Config. | Detección (carpeta) |
|-----|---------------|-----------|
| Claude Code | `CLAUDE.md` | `.claude/` |
| Gemini CLI | `GEMINI.md` | `.gemini/` |
| Antigravity | `.gemini/` + `.agents/` | Antigravity Extensión |
| Codex CLI | `AGENTS.md` | `.codex/` |
| OpenCode | `OPENCODE.md` | Opciones de opencode |

---

## 📡 Monitorización Upstream

### Pipeline semanal (cron VPS, lunes 9 AM)

```
1. Obtiene actualizaciones del proyecto raíz BMAD-METHOD
2. Análisis "diff" sobre los archivos locales
3. Procesado por Inteligencia Artificial "Gemini API"
   🟢 Compatible | 🟡 Revisar manualmente | 🔴 Incompatible o "Breaking Change"
4. Envía la actualización usando el WhatsApp registrado (Evolution API)
5. Auto-PR en GH
```

### Stack
- **weekly-check.py** — Archivo base usado mediante cron semanal
- **ai_analyzer.py** — LLM de análisis (Gemini 2.0 Flash)
- **notifier.py** — WhatsApp (API Evolution auto-hosteado) / fallback a correo local
- **mcp_bridge.py** — Acceso Server para las API operativas.

---

## 📁 Estructura del Proyecto

```
BMAD+/
├── README.md                      ← Este archivo (Inglés)
├── readme-international/          ← Versiones traducidas (es, fr, de)
├── CHANGELOG.md                   ← Versiones de proyecto
├── CLAUDE.md                      ← Config IDE: Claude
├── GEMINI.md                      ← Config IDE: Gemini
├── AGENTS.md                      ← Config IDE: Codex / Opencode
├── .gitignore
│
├── src/
│   └── bmad-plus/                 ⭐ MODULO PERSONALIZADO
│       ├── module.yaml            ← Packs de entorno BMAD
│       ├── module-help.csv        ← Ayuda rápida base de datos
│       ├── agents/
│       │   ├── agent-strategist/  ← Atlas (analyst + pm)
│       │   ├── agent-architect-dev/ ← Forge (architect + dev + tw)
│       │   ├── agent-quality/     ← Sentinel (qa + ux)
│       │   ├── agent-orchestrator/ ← Nexus (sm + qf + autopilot + parallel)
│       │   ├── agent-maker/       ← Maker (meta-agente creativo) [pack: maker]
│       │   └── agent-shadow/      ← Shadow (osint) [pack: osint]
│       ├── skills/
│       │   ├── bmad-plus-autopilot/ ← Orquestación completa
│       │   ├── bmad-plus-parallel/  ← Supervisión concurrente
│       │   └── bmad-plus-sync/      ← Sicronización automatizada código
│       └── data/
│           └── role-triggers.yaml ← Lógica de variables y keywords
│
├── monitor/                       🤖 CONTROL PARA VPS DE CAMBIOS DE BMAD-METHOD
│   ├── weekly-check.py            ← Base Cron
│   ├── ai_analyzer.py             ← IA Análisis (Gemini API)
│   ├── notifier.py                ← WhatsApp (Evolution API) y correos
│   ├── mcp_bridge.py              ← Puerto de servidor
│   ├── config.example.yaml        ← Base de las contraseñas
│   └── docker-compose.yml         ← Config para arrancar Evolution API
│
├── mcp-server/                    🛡️ AUDITOR / MCP BRIDGE
│   ├── server.py                  ← Acceso general y de herramientas.
│   └── tools/                     ← git, github operations
│
├── osint-agent-package/           🔍 MODULO INDEPENDIENTE DE OSINT
│   ├── agents/                    ← Agente Shadow (version root)
│   ├── skills/                    ← Apify actores 55+
│   └── install.ps1                ← Script de instalación
│
└── upstream/                      📦 CLONE ORIGINAL (EXCLUIDO DEL REGISTRO LOCAL)
    └── (BMAD-METHOD original)
```

---

## ⚙️ Configuración Módulo Central

### Archivo principal (`module.yaml`)

| Variable | Descripción | Valores Disponibles |
|----------|-------------|---------|
| `project_name` | Nombre el proyecto | Autodetectado |
| `user_skill_level` | Nivel del equipo/persona | beginner, intermediate, expert |
| `execution_mode` | Modo de uso general | manual, autopilot, hybrid |
| `auto_role_activation` | Cambio al predecir contexto | true, false |
| `parallel_execution` | Trabajos Multiagente | true, false |
| `install_packs` | Packs Seleccionados a Integrar | core, osint, maker, audit, all |

### Integración Personalizada (Apikey/Hooks)

| KEY Sistema | Entorno / Pack | Actuación |
|-----|------|-------|
| `GEMINI_API_KEY` | Monitor | Comparación lógica de ramas Upstream |
| `EVOLUTION_API_KEY` | Monitor | Sistema WhatsApp Notifier Server |
| `APIFY_API_TOKEN` | OSINT | Extracción, Web Mining |
| `PERPLEXITY_API_KEY` | OSINT | Buscador Complejo AI |

---

## 📜 Historial de Versiones

| Versión | Fecha | Descripción |
|---------|------|-------------|
| **0.1.0** | 2026-03-17 | 🎉 Fundación base de proyecto (6 agentes / 3 entornos de skills / Auto-detección IDEs locales). Se incorporó el Maker y paquete OSINT |

Más descripciones a fondo en el archivo: [CHANGELOG.md](../CHANGELOG.md).

---

## 📄 Licencias Integradas

Proyecto BMAD+ (Adaptación: MIT)

Basado nativamente en el repositorio: [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT LIC)

### Reconocimientos especiales

- **BMAD-METHOD Core** por [bmad-code-org](https://github.com/bmad-code-org) — Framework base
- **OSINT Pipeline Tool** Adaptación de [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT LIC)
- **Apify Actor Runner Base** integrado desde el original de [apify/agent-skills](https://github.com/apify/agent-skills) (MIT LIC)
