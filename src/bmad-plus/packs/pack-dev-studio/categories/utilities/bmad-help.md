---
name: bmad-help
description: Explain available Dev Studio routes and recommend the next useful workflow from the project's actual state.
---

# Dev Studio Help

Read the [execution guide](../../shared/execution.md) and adopt
[Miriam](../analysis/analyst-agent.md). Use the
[catalog](../../shared/catalog.json) for available agents and routes.

## Inputs

No input is required to list capabilities. For a recommendation, use the user's
current objective and accessible project evidence. Do not require a project brief
just to answer which agents are available.

## Procedure

1. Determine whether the user needs a roster, an invocation example, a specific
   workflow or advice on the next step. Honor an explicit workflow choice when it
   fits the request.
2. For a roster, show the six personas and relevant routes from the catalog. For
   project guidance, inspect the supplied artifacts and relevant current state:
   planning documents, implementation changes or recorded blockers. Distinguish
   absent documents from documents you could not inspect.
3. Recommend the smallest useful route and explain its expected deliverable and
   required inputs. A narrow fix may use quick-dev; an unclear failure may need
   investigate; a defined proposal may need a brief, PRD or review. Do not impose
   every lifecycle phase on every project.
4. Show a natural-language request and, when useful, the matching CLI command.
   The command prepares context for the host; it does not execute the workflow.
   If the user already asked for the actual work, load that workflow and continue
   with its procedure instead of stopping after a menu.
5. Record remaining uncertainty and the next action. Report a missing pack file or
   unavailable route directly; do not invent a similarly named installed skill.

## Invocation examples

With the BMAD+ CLI already available in this project:

```sh
npx --no-install bmad-plus studio list --json
npx --no-install bmad-plus studio prepare product-brief --directory . --request "Define the smallest useful version of our issue triage tool" --json
npx --no-install bmad-plus studio prepare validate-prd --directory . --input docs/prd.md --json
```

The input path in the last command must exist in the selected project. A direct
host request can be: "Miriam, use product-brief to clarify this product idea."

## Output and checks

For a simple roster or invocation question, answer directly without creating a
report file solely for the listing. For project guidance, use the common report
with inspected state, recommended route, evidence and required next input.
Recommendations must name catalog routes and distinguish CLI preparation from
host execution. On resume, use the latest objective and project state instead of
repeating a stale recommendation.
