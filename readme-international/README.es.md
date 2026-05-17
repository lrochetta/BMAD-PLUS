# ?? BMAD+ � Framework de Desarrollo Impulsado por IA Aumentada

[![Version](https://img.shields.io/badge/version-0.7.4-blue.svg)](../CHANGELOG.md)
[![Based on](https://img.shields.io/badge/based%20on-BMAD--METHOD%20v6.2.0-green.svg)](https://github.com/bmad-code-org/BMAD-METHOD)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](../LICENSE)

<div align="center">
  <a href="../README.md">English</a> | <a href="README.fr.md">Fran�ais</a> | ?? <b>Espa�ol</b> | <a href="README.de.md">Deutsch</a>
</div>

> Fork inteligente de [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.2.0 � Agentes multirrol con auto-activaci�n, modo Autopilot, ejecuci�n paralela supervisada y monitorizaci�n upstream por WhatsApp.

---

## ?? Tabla de contenidos

- [�Por qu� BMAD+?](#-por-qu�-bmad-)
- [Inicio R�pido](#-inicio-r�pido)
- [Arquitectura](#-arquitectura)
- [Los 5 Agentes](#-los-5-agentes)
- [Sistema de Packs](#-sistema-de-packs)
- [Innovaciones](#-innovaciones)
- [IDE Soportados](#-ide-soportados)
- [Monitorizaci�n Upstream](#-monitorizaci�n-upstream)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuraci�n](#-configuraci�n)
- [Historial de Versiones](#-historial-de-versiones)
- [Licencia](#-licencia)

---

## ?? �Por qu� BMAD+?

BMAD-METHOD es un excelente framework con 9 agentes especializados. Pero para un desarrollador en solitario o un equipo peque�o, 9 agentes est� demasiado fragmentado. BMAD+ resuelve este problema:

| BMAD-METHOD | BMAD+ |
|---|---|
| 9 agentes especializados | **5 agentes multirrol** (11 roles en total) |
| Activaci�n manual �nicamente | **Auto-activaci�n inteligente** en 3 niveles |
| Sin pipeline automatizado | **Modo Autopilot**: idea ? entrega |
| Ejecuci�n secuencial | **Paralelismo supervisado** |
| Sin seguimiento upstream | **Monitorizaci�n semanal** con WhatsApp |
| 1-2 IDEs soportados | **5 IDEs** con auto-detecci�n |

---

## ? Inicio R�pido

### Instalaci�n en un proyecto existente

```bash
npx bmad-plus install
```

El instalador:
1. Detecta autom�ticamente los IDE instalados (Claude Code, Gemini CLI, Codex, etc.)
2. Ofrece los packs a instalar (Core, OSINT, Maker, Audit)
3. Genera los archivos de configuraci�n adaptados
4. Crea las carpetas de artefactos

### Uso despu�s de la instalaci�n

#### ?? �Con qui�n hablar?

| Quieres... | Habla con | Ejemplo |
|---|---|---|
| Discutir una idea de proyecto | **Atlas** ?? | `Atlas, tengo una idea de proyecto: un SaaS de facturaci�n` |
| Crear un PRD / Product Brief | **Atlas** ?? | `Atlas, crea el PRD para mi proyecto` |
| Dise�ar la arquitectura t�cnica | **Forge** ??? | `Forge, prop�n una arquitectura para la app` |
| Implementar c�digo | **Forge** ??? | `Forge, implementa la historia AUTH-001` |
| Redactar documentaci�n | **Forge** ??? | `Forge, documenta la API` |
| Probar / realizar revisi�n de c�digo | **Sentinel** ?? | `Sentinel, revisa el m�dulo auth` |
| Planificar un sprint | **Nexus** ?? | `Nexus, crea �picas e historias para el MVP` |
| Automatizar todo de la A a la Z | **Nexus** ?? | `autopilot` luego describe tu proyecto |
| Investigar a una persona (OSINT) | **Shadow** ?? | `Shadow, investiga a John Doe` |
| Crear un nuevo agente BMAD+ | **Maker** ?? | `Maker, crea un agente de soporte al cliente` |

#### ?? Flujo de trabajo t�pico (modo manual)

```
1. "Atlas, haz una lluvia de ideas sobre mi [proyecto]"
   ? Atlas analiza, hace preguntas, propone enfoques

2. "Atlas, crea el product brief"
   ? Entregable: _bmad-output/discovery/product-brief.md

3. "Atlas, redacta el PRD"
   ? Entregable: _bmad-output/discovery/prd.md

4. "Forge, prop�n la arquitectura"
   ? Entregable: _bmad-output/discovery/architecture.md

5. "Nexus, divide en �picas e historias"
   ? Entregable: _bmad-output/build/stories/

6. "Forge, implementa la historia [X]"
   ? C�digo generado + pruebas

7. "Sentinel, prueba y revisa"
   ? Informe de QA + sugerencias
```

#### ? Flujo de trabajo autom�tico (modo autopilot)

```
> autopilot
> "Un SaaS de facturaci�n para pymes con gesti�n de presupuestos"
```

Nexus orquesta todo autom�ticamente con puntos de control (checkpoints) para tu aprobaci�n.

#### ?? Comandos clave

| Comando | Descripci�n |
|----------|-------------|
| `bmad-help` | Ver todos los agentes y habilidades disponibles |
| `autopilot` | Nexus toma el control del pipeline completo |
| `parallel` | Iniciar ejecuci�n multi-agente en paralelo |


#### 🔧 Comandos CLI

| Command | Description |
|---------|-------------|
| `npx bmad-plus install` | Instalador interactivo con selección de packs y detección de IDE |
| `npx bmad-plus scan [ruta]` | Descubrir e indexar proyectos en el cerebro global |
| `npx bmad-plus memory status` | Informe de salud de memoria (proyecto + cerebro global) |
| `npx bmad-plus memory export` | Exportar cerebro como archivo Markdown portable |
| `npx bmad-plus doctor` | Verificar integridad de la instalación |
| `npx bmad-plus update` | Actualizar agentes y skills (conserva config) |
| `npx bmad-plus uninstall` | Eliminar BMAD+ del proyecto actual |
| `npx bmad-plus autoconfig` | Bootstrap inteligente — auto-detección, instalación y configuración |

#### 🔬 Opciones de instalación avanzadas

```bash
npx bmad-plus install --packs all --yes
npx bmad-plus install --tools none
npx bmad-plus install --packs core,memory,osint
```

> **💡 Consejo dogfooding:** Usa `--tools none` al instalar BMAD+ en un proyecto con archivos de config IDE manuales. Instala agentes, skills y memoria sin sobrescribir tus `CLAUDE.md`, `GEMINI.md` o `AGENTS.md`.

#### 🔍 Opciones de escaneo

```bash
npx bmad-plus scan D:\DEV
npx bmad-plus scan . --active-days 7 --paused-days 90
npx bmad-plus scan D:\DEV --yes --depth 6
```

> Leyenda: 🟢 **activo** (modificado < 30 días), 🟡 **pausado** (30–180 días), ⚪ **archivado** (> 180 días). Umbrales personalizables con `--active-days` y `--paused-days`.

---

## ??? Arquitectura

```mermaid
graph TB
    subgraph Core["?? Core Pack"]
        AT[Atlas ??<br/>Strategist]
        FG[Forge ???<br/>Architect-Dev]
        SN[Sentinel ??<br/>Quality]
        NX[Nexus ??<br/>Orchestrator]
    end

    subgraph OSINT["?? OSINT Pack"]
        SH[Shadow ??<br/>OSINT Intel]
    end

    subgraph Audit["??? Audit Pack"]
        SD["Shield ???<br/>(muy pronto)"]
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

## ?? Los 5 Agentes

### Atlas � Strategist ??

**Fusiona:** Analyst (Mary) + Product Manager (John)

| Rol | Especialidad | Auto-activaci�n |
|------|-----------|-----------------|
| **Analyst** | Investigaci�n de mercado, FODA, benchmarks | "analiza", "mercado", "benchmark", nuevo proyecto |
| **Product Manager** | PRD, product briefs, historias de usuario, roadmaps | "PRD", "roadmap", "MVP", fase de planificaci�n |

**Capacidades:** Brainstorming (BP), Market Research (MR), Domain Research (DR), Technical Research (TR), Product Brief (CB), PRD (PR), UX Design (CU), Document Project (DP)

---

### Forge � Architect-Dev ???

**Fusiona:** Architect (Winston) + Developer (Amelia) + Tech Writer (Paige)

| Rol | Especialidad | Auto-activaci�n |
|------|-----------|-----------------|
| **Architect** | Dise�o t�cnico, API, escalabilidad, elecci�n de stack | "arquitectura", "API", "schema", +5 archivos modificados |
| **Developer** | Implementaci�n TDD, revisi�n de c�digo, historias | "implementa", "c�digo", "fix", post-arquitectura |
| **Tech Writer** | Documentaci�n, diagramas Mermaid, changelogs | "documenta", "README", post-implementaci�n |

**Capacidades:** Architecture (CA), Implementation Readiness (IR), Dev Story (DS), Code Review (CR), Quick Spec (QS), Quick Dev (QD), Document Project (DP)

**Acciones cr�ticas (rol Dev):**
- Leer TODA la historia ANTES de implementar
- Ejecutar las tareas EN ORDEN
- 100% pruebas aprobadas ANTES de avanzar
- NUNCA mentir sobre las pruebas

---

### Sentinel � Quality ??

**Fusiona:** QA Engineer (Quinn) + UX Designer (Sally)

| Rol | Especialidad | Auto-activaci�n |
|------|-----------|-----------------|
| **QA Engineer** | Pruebas API/E2E, edge cases, cobertura, revisi�n de c�digo | "prueba", "QA", "bug", post-implementaci�n |
| **UX Reviewer** | Evaluaci�n de UX, accesibilidad, dise�o de interacci�n | "UX", "interfaz", "responsive", cambios frontend |

**Capacidades:** QA Tests (QA), Code Review (CR), UX Design (CU)

---

### Nexus � Orchestrator ??

**Fusiona:** Scrum Master (Bob) + Quick-Flow Solo Dev (Barry) + **Autopilot** (nuevo) + **Parallel Supervisor** (nuevo)

| Rol | Especialidad | Auto-activaci�n |
|------|-----------|-----------------|
| **Scrum Master** | Planificaci�n de sprints, historias, retrospectivas | "sprint", "planificaci�n", "backlog" |
| **Quick Flow** | Specs r�pidas, hotfixes, m�nima ceremonia | "r�pido", "hotfix", "peque�o fix" |
| **Autopilot** | Pipeline automatizado idea?entrega con checkpoints | "autopilot", "gestiona todo", modo autopilot |
| **Parallel Supervisor** | M�ltiples agentes en concurrencia, reasignaci�n | "paralelo", tareas independientes detectadas |

**Capacidades:** Sprint Planning (SP), Create Story (CS), Epics & Stories (ES), Retrospective (ER), Course Correction (CC), Sprint Status (SS), Quick Spec (QS), Quick Dev (QD), **Autopilot (AP)**, **Parallel (PL)**

---

### Shadow � OSINT Intelligence ?? *(Pack OSINT)*

**Agente completo de investigaci�n OSINT.**

| Capacidad | Descripci�n |
|-----------|-------------|
| **INV** | Investigaci�n completa Fase 0?6 con informe puntuado |
| **QS** | B�squeda r�pida multi-motor |
| **LI/IG/FB** | Scraping de LinkedIn, Instagram, Facebook |
| **PP** | Psicoperfil MBTI / Big Five |
| **CE** | Enriquecimiento de contactos (email, tel�fono) |
| **DG** | Diagn�stico de herramientas/APIs disponibles |

**Tecnolog�a:** M�S de 55 actores de Apify, 7 APIs de b�squeda, python est�ndar 100%, grados A/B/C/D

---

### Maker � Agent Creator ?? *(Pack Maker)*

**Meta-agente que crea otros agentes.** Dale una descripci�n ? genera un paquete completo.

| Capacidad | Descripci�n |
|------|-------------|
| **CA** | Create Agent � creaci�n guiada en 4 fases |
| **QA** | Quick Agent � creaci�n r�pida con valores por defecto con sentido |
| **EA** | Edit Agent � modificar un SKILL.md existente |
| **VA** | Validate Agent � verificar cumplimiento BMAD+ |
| **PA** | Package Agent � generar carpeta de integraci�n |

**Pipeline:** Discovery ? Design (aprobaci�n del usuario) ? Generaci�n ? Validaci�n
**Salida:** `_bmad-output/ready-to-integrate/` � listo para copiar a BMAD+

---

## ?? Sistema de Packs

BMAD+ utiliza un sistema modular por packs. El Core siempre est� instalado, y los dem�s packs son opcionales.

```
npx bmad-plus install

???  �Qu� packs instalar?
   Core (Atlas, Forge, Sentinel, Nexus) siempre incluido.

   ?? OSINT � Shadow (investigaci�n, scraping, psicoperfil)
   ?? Agent Creator � Maker (dise�o, desarrollo, empaque)
   ??? Auditor�a de Seguridad � Shield (muy pronto)
   ?? Instalar todo
   Ninguno � Solo Core
```

| Pack | Agentes | Habilidades | Estado |
|------|--------|--------|--------|
| ?? **Core** | Atlas, Forge, Sentinel, Nexus | autopilot, parallel, sync | ? Estable |
| ?? **OSINT** | Shadow | bmad-osint-investigate | ? Estable |
| ?? **Maker** | Maker | � | ? Estable |
| ??? **Audit** | Shield | bmad-audit-scan, bmad-audit-report | ?? Muy pronto |

Cada pack define:
- Sus agentes y habilidades
- Llaves de API obligatorias/opcionales
- Paquete externo (en tu caso, osint)

---

## ? Innovaciones

### 1. Auto-Activaci�n Inteligente a 3 Niveles

Cada agente puede **autom�ticamente** cambiar de rol seg�n el contexto:

| Nivel | Mecanismo | Ejemplo |
|--------|-----------|---------|
| ?? **Patr�n** | Palabras clave en el pedido | "revisa" ? QA activado |
| ?? **Contexto** | Detecta el tipo de tarea | C�lculos financieros detectados ? QA auto-activado tras escribir c�digo |
| ?? **Razonamiento** | Cadena l�gica | Inconsistencia de arquitectura ? Architec auto-activado |

El agente **anuncia** el cambio: *"?? I'm switching to QA mode � financial calculations detected. Say 'skip' to stay in current mode."*

Configuraci�n: `src/bmad-plus/data/role-triggers.yaml`

### 2. Modo Autopilot

Introduce una idea ? Nexus gestionar� todo:

```
?? Discovery (Atlas)
  +? Brainstorming ? Product Brief ? PRD ? UX Design
  ?? CHECKPOINT: Aprobaci�n del PRD

??? Build (Forge + Sentinel)
  +? Arquitectura ? �picas ? Historias ? Sprint
  ?? CHECKPOINT: Aprobaci�n de Arquitectura
  +? Por historia: C�digo ? Pruebas ? (reintentos si falla, m�ximo 3)
  ?? NOTIFY: Estado de la historia

?? Ship (Sentinel + Forge)
  +? Revisi�n de C�digo ? UX ? Documentaci�n ? Retrospectiva
  ?? CHECKPOINT: Aprobaci�n final
```

**Puntos de control (checkpoints) configurables:**
- `require_approval` (??) � Pausa, notifica por WhatsApp, espera
- `notify_only` (??) � Notifica, contin�a (a menos que el usuario intervenga)
- `auto` (??) � Totalmente autom�tico

### 3. Ejecuci�n Paralela Supervisada

El orquestador divide las tareas as�ncronas para ejecutarlas de forma paralela:

| Proceso paralelo ? | Proceso secuencial ?? |
|---|---|
| M�ltiples historias sin dependencia | Tareas en el mismo archivo |
| Research + revisi�n t�cnica de arquitectura | Historia B depende de A |
| Tests QA + documentaci�n en docs | Arquitectura antes que el c�digo |

**Supervisi�n en ejecuci�n:** Iniciar, Detener, Reiniciar, Escalar (si un agente falla m�s de 3 veces, avisa al desarrollador)

---

## ??? IDE Soportados

El instalador detecta autom�ticamente el IDE actual para generar la configuraci�n nativa que conecte a BMAD+:

| IDE | Archivo de Config. | Detecci�n (carpeta) |
|-----|---------------|-----------|
| Claude Code | `CLAUDE.md` | `.claude/` |
| Gemini CLI | `GEMINI.md` | `.gemini/` |
| Antigravity | `.gemini/` + `.agents/` | Antigravity Extensi�n |
| Codex CLI | `AGENTS.md` | `.codex/` |
| OpenCode | `OPENCODE.md` | Opciones de opencode |

---

## ?? Monitorizaci�n Upstream

### Pipeline semanal (cron VPS, lunes 9 AM)

```
1. Obtiene actualizaciones del proyecto ra�z BMAD-METHOD
2. An�lisis "diff" sobre los archivos locales
3. Procesado por Inteligencia Artificial "Gemini API"
   ?? Compatible | ?? Revisar manualmente | ?? Incompatible o "Breaking Change"
4. Env�a la actualizaci�n usando el WhatsApp registrado (Evolution API)
5. Auto-PR en GH
```

### Stack
- **weekly-check.py** � Archivo base usado mediante cron semanal
- **ai_analyzer.py** � LLM de an�lisis (Gemini 2.0 Flash)
- **notifier.py** � WhatsApp (API Evolution auto-hosteado) / fallback a correo local
- **mcp_bridge.py** � Acceso Server para las API operativas.

---

## ?? Estructura del Proyecto

```
BMAD+/
+-- README.md                      ? Este archivo (Ingl�s)
+-- readme-international/          ? Versiones traducidas (es, fr, de)
+-- CHANGELOG.md                   ? Versiones de proyecto
+-- CLAUDE.md                      ? Config IDE: Claude
+-- GEMINI.md                      ? Config IDE: Gemini
+-- AGENTS.md                      ? Config IDE: Codex / Opencode
+-- .gitignore
�
+-- src/
�   +-- bmad-plus/                 ? MODULO PERSONALIZADO
�       +-- module.yaml            ? Packs de entorno BMAD
�       +-- module-help.csv        ? Ayuda r�pida base de datos
�       +-- agents/
�       �   +-- agent-strategist/  ? Atlas (analyst + pm)
�       �   +-- agent-architect-dev/ ? Forge (architect + dev + tw)
�       �   +-- agent-quality/     ? Sentinel (qa + ux)
�       �   +-- agent-orchestrator/ ? Nexus (sm + qf + autopilot + parallel)
�       �   +-- agent-maker/       ? Maker (meta-agente creativo) [pack: maker]
�       �   +-- agent-shadow/      ? Shadow (osint) [pack: osint]
�       +-- skills/
�       �   +-- bmad-plus-autopilot/ ? Orquestaci�n completa
�       �   +-- bmad-plus-parallel/  ? Supervisi�n concurrente
�       �   +-- bmad-plus-sync/      ? Sicronizaci�n automatizada c�digo
�       +-- data/
�           +-- role-triggers.yaml ? L�gica de variables y keywords
�
+-- monitor/                       ?? CONTROL PARA VPS DE CAMBIOS DE BMAD-METHOD
�   +-- weekly-check.py            ? Base Cron
�   +-- ai_analyzer.py             ? IA An�lisis (Gemini API)
�   +-- notifier.py                ? WhatsApp (Evolution API) y correos
�   +-- mcp_bridge.py              ? Puerto de servidor
�   +-- config.example.yaml        ? Base de las contrase�as
�   +-- docker-compose.yml         ? Config para arrancar Evolution API
�
+-- mcp-server/                    ??? AUDITOR / MCP BRIDGE
�   +-- server.py                  ? Acceso general y de herramientas.
�   +-- tools/                     ? git, github operations
�
+-- osint-agent-package/           ?? MODULO INDEPENDIENTE DE OSINT
�   +-- agents/                    ? Agente Shadow (version root)
�   +-- skills/                    ? Apify actores 55+
�   +-- install.ps1                ? Script de instalaci�n
�
+-- upstream/                      ?? CLONE ORIGINAL (EXCLUIDO DEL REGISTRO LOCAL)
    +-- (BMAD-METHOD original)
```

---

## ?? Configuraci�n M�dulo Central

### Archivo principal (`module.yaml`)

| Variable | Descripci�n | Valores Disponibles |
|----------|-------------|---------|
| `project_name` | Nombre el proyecto | Autodetectado |
| `user_skill_level` | Nivel del equipo/persona | beginner, intermediate, expert |
| `execution_mode` | Modo de uso general | manual, autopilot, hybrid |
| `auto_role_activation` | Cambio al predecir contexto | true, false |
| `parallel_execution` | Trabajos Multiagente | true, false |
| `install_packs` | Packs Seleccionados a Integrar | core, osint, maker, audit, all |

### Integraci�n Personalizada (Apikey/Hooks)

| KEY Sistema | Entorno / Pack | Actuaci�n |
|-----|------|-------|
| `GEMINI_API_KEY` | Monitor | Comparaci�n l�gica de ramas Upstream |
| `EVOLUTION_API_KEY` | Monitor | Sistema WhatsApp Notifier Server |
| `APIFY_API_TOKEN` | OSINT | Extracci�n, Web Mining |
| `PERPLEXITY_API_KEY` | OSINT | Buscador Complejo AI |

---

## ?? Historial de Versiones

| Versi�n | Fecha | Descripci�n |
|---------|------|-------------|
| **0.1.0** | 2026-03-17 | ?? Fundaci�n base de proyecto (6 agentes / 3 entornos de skills / Auto-detecci�n IDEs locales). Se incorpor� el Maker y paquete OSINT |

M�s descripciones a fondo en el archivo: [CHANGELOG.md](../CHANGELOG.md).

---

## ?? Licencias Integradas

Proyecto BMAD+ (Adaptaci�n: MIT)

Basado nativamente en el repositorio: [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT LIC)

### Reconocimientos especiales

- **BMAD-METHOD Core** por [bmad-code-org](https://github.com/bmad-code-org) � Framework base
- **OSINT Pipeline Tool** Adaptaci�n de [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT LIC)
- **Apify Actor Runner Base** integrado desde el original de [apify/agent-skills](https://github.com/apify/agent-skills) (MIT LIC)
