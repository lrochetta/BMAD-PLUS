# 🏗️ Pack Dev Studio — BMAD+

> Full Software Development Lifecycle powered by 6 Torah-named AI agents

**Source:** Adapted from [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.6.0 (47K+ ⭐)
**Format:** BWML (BMAD+ Workflow Markup Language)
**License:** MIT

---

## Overview

Pack Dev Studio transforms your AI IDE into a complete software engineering team. Six specialized agents guide you through the entire development lifecycle — from brainstorming to deployment — with structured workflows, validation gates, and anti-regression guards.

Unlike generic AI assistants, each agent embodies deep domain expertise with a distinct voice, methodology, and perspective. Named after figures from the Torah whose characteristics mirror their roles.

## Agents

### 📊 Miriam (מרים) — Business Analyst
*"Like the prophetess who watched over Moses, Miriam observes patterns others miss"*

Strategic analysis, market research, competitive landscape, requirements elicitation, product briefs, PRFAQ challenges. Channels Porter's strategic rigor and Minto's Pyramid Principle.

### 📚 Huldah (חולדה) — Technical Writer
*"As Huldah authenticated the Book of the Law, she authenticates your documentation"*

Documentation mastery, CommonMark, DITA, OpenAPI, Mermaid diagrams, editorial review. Turns complex concepts into accessible structured docs.

### 📋 Yosef (יוסף) — Product Manager
*"Like Joseph interpreting Pharaoh's dreams, Yosef interprets user needs into actionable specs"*

PRD creation/validation, feature prioritization, Jobs-to-be-Done methodology, user value first. Every "why?" tightens the net.

### 🎨 Rachel (רחל) — UX Designer
*"Rachel's empathy and devotion mirror the UX designer's commitment to the user"*

User experience design, wireframes, user flows, accessibility, empathy mapping, edge-case rigor. Paints user stories that make you feel the problem.

### 🏗️ Bezalel (בצלאל) — System Architect
*"The master architect of the Tabernacle, filled with divine wisdom for design"*

Architecture decisions, system design, tech stack selection, ADRs, boring technology philosophy. Measures trade-offs, not verdicts.

### 💻 Oholiab (אהליאב) — Senior Engineer
*"Bezalel's master craftsman partner — precision in every implementation"*

TDD red-green-refactor, story implementation, code review, sprint management. Terminal-prompt precision, AC-first delivery.

## Development Lifecycle

```
Phase 1 — Analysis
  Miriam → Brainstorm → Product Brief / PRFAQ
  Huldah → Document existing project

Phase 2 — Planning
  Yosef  → PRD (create, edit, validate)
  Rachel → UX Design (wireframes, user flows)

Phase 3 — Architecture
  Bezalel → Architecture → Epics & Stories → Readiness Check

Phase 4 — Implementation
  Oholiab → Sprint Planning → [Create Story → Dev Story → Code Review] → Retrospective

Cross-cutting — Utilities
  Distillator, Party Mode, Adversarial Reviews, Editorial Reviews
```

## Workflows (30+)

### Analysis (8 skills)
| Skill | Description |
|-------|-------------|
| `analyst-agent` | Miriam — full business analyst persona |
| `tech-writer-agent` | Huldah — technical documentation expert |
| `product-brief` | Guided product brief creation |
| `prfaq` | Amazon Working Backwards PRFAQ challenge |
| `document-project` | Analyze existing project for documentation |
| `market-research` | Market analysis and competitive landscape |
| `domain-research` | Industry domain deep dive |
| `technical-research` | Technical feasibility assessment |

### Planning (7 skills)
| Skill | Description |
|-------|-------------|
| `pm-agent` | Yosef — product manager persona |
| `ux-designer-agent` | Rachel — UX designer persona |
| `create-prd` | PRD creation via coached discovery |
| `prd` | Full PRD workflow (create/edit/validate) |
| `edit-prd` | Update existing PRD |
| `validate-prd` | PRD validation checklist |
| `create-ux-design` | Guided UX design workflow |

### Architecture (5 skills + 9 step files)
| Skill | Description |
|-------|-------------|
| `architect-agent` | Bezalel — system architect persona |
| `create-architecture` | 8-step architecture design workflow |
| `create-epics-stories` | Break architecture into implementable units |
| `implementation-readiness` | Pre-coding alignment check |
| `generate-project-context` | LLM-optimized project context generation |

### Implementation (12 skills)
| Skill | Description |
|-------|-------------|
| `dev-agent` | Oholiab — senior engineer persona |
| `sprint-planning` | Sprint plan from epics |
| `create-story` | Prepare story with full context |
| `dev-story` | Full TDD implementation cycle (486 lines!) |
| `code-review` | Senior developer code review |
| `quick-dev` | Fast track: intent → code |
| `sprint-status` | Sprint progress report |
| `retrospective` | Epic completion review |
| `correct-course` | Navigate major changes |
| `investigate` | Forensic issue investigation |
| `checkpoint-preview` | Guided commit/PR walkthrough |
| `qa-e2e-tests` | Automated test generation |

### Utilities (12 skills)
| Skill | Description |
|-------|-------------|
| `distillator` | Lossless document compression for LLM |
| `party-mode` | Multi-agent roundtable discussion |
| `brainstorming` | Expert-guided brainstorming facilitation |
| `adversarial-review` | Adversarial document critique |
| `edge-case-hunter` | Find edge cases and failure modes |
| `editorial-review-prose` | Prose quality review |
| `editorial-review-structure` | Document structure review |
| `advanced-elicitation` | Deep requirement extraction |
| `shard-doc` | Intelligent document splitting |
| `index-docs` | Documentation index creation |
| `bmad-help` | Contextual "what's next?" guidance |
| `customize` | Agent customization guide |

## BWML — Our Workflow DSL

Pack Dev Studio uses **BWML** (BMAD+ Workflow Markup Language), a proprietary DSL that extends XML-based workflows with 12 new primitives. See `shared/bwml-spec.md` for the full specification.

## File Structure

```
pack-dev-studio/
├── dev-studio-orchestrator.md     ← Entry point
├── upstream-sync.yaml             ← BMAD-METHOD v6.6.0 tracking
├── README.md                      ← This file
├── categories/
│   ├── analysis/        (8 skills)
│   ├── planning/        (7 skills)
│   ├── architecture/    (5 skills + 9 steps)
│   ├── implementation/  (12 skills + 4 code-review steps + checklist)
│   └── utilities/       (12 skills)
└── shared/
    ├── bwml-spec.md                ← BWML DSL specification
    ├── module-help.csv             ← Navigation catalog
    └── architecture-decision-template.md
```

## Attribution

Adapted from [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.6.0 by BMad Code, LLC (MIT License).
Enhanced with BWML workflow language and Torah-inspired personas by [Laurent Rochetta](https://github.com/lrochetta/BMAD-PLUS).
