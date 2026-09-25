---
name: dev-studio-orchestrator
description: Route a concrete software task to one of Dev Studio's six personas and 38 shipped workflows.
---

# Dev Studio Orchestrator

Read the [execution guide](shared/execution.md) and use the
[catalog](shared/catalog.json) to resolve agent and workflow paths. The
[pack skill](SKILL.md) is the installed entry point; the
[README](README.md) explains commands and configuration.

## Routing procedure

1. Identify the user's intended result and the work already authorized. Read the
   relevant project instructions, memory and supplied artifacts. An existing plan
   or request can be sufficient; do not force a menu before doing clear work.
2. Choose the smallest workflow that produces the intended result. Respect an
   explicit route when it fits. For ambiguous requests, investigate available
   context and ask only for essential unresolved information.
3. Resolve the selected workflow and persona using the catalog. Read both files
   and their declared resources. A textual workflow ID is a route, not proof that
   its instructions have been loaded.
4. Apply the workflow's input requirements. The optional CLI can prepare a
   read-only bundle, but the host must inspect project evidence and carry out the
   procedure. Missing input or unavailable capability remains a specific dependency.
5. Execute within the actual task scope, recording observations and checks.
   Continue into a dependent workflow only when it is necessary for the requested
   result and its inputs are ready. A lifecycle diagram does not authorize new work.
6. Deliver the artifact and evidence. Read the existing report before updating it;
   on resume compare inputs and project state, then continue at the first
   incomplete step. Do not treat a recorded recommendation as permission to publish.

## Personas and typical routes

| Persona | Read | Typical need |
| --- | --- | --- |
| Miriam | [Analyst](categories/analysis/analyst-agent.md) | Clarify a product, research a market or resolve uncertainty |
| Huldah | [Technical writer](categories/analysis/tech-writer-agent.md) | Explain a project, structure documents or improve wording |
| Yosef | [Product manager](categories/planning/pm-agent.md) | Create, edit or validate requirements |
| Rachel | [UX designer](categories/planning/ux-designer-agent.md) | Design user flows, interaction states and acceptance checks |
| Bezalel | [Architect](categories/architecture/architect-agent.md) | Decide system boundaries and technical tradeoffs |
| Oholiab | [Engineer](categories/implementation/dev-agent.md) | Implement, investigate, test or review a change |

For uncertain failures, inspect evidence through investigate before estimating a
large fix. For a scoped change with clear behavior, quick-dev may be sufficient.
For a new product, product-brief can establish the next planning input. Use
bmad-help to explain available routes or recommend the next task.

## Parallel work and review

Parallel execution requires real host support and independent assignments. Record
the assigned scope, actual agent identifier and returned evidence. Check outputs
at integration; a completion message alone does not prove acceptance. When the
host cannot create independent agents, use sequential perspectives and describe
that mode accurately. Do not present it as independent review.

The orchestrator is an instruction role, not a scheduler or background service.
It supplies no implicit notification, commit, deployment or publication authority.
For the old XML notation, see the [migration note](shared/bwml-spec.md).
