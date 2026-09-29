# Dev Studio for BMAD+

Dev Studio provides six specialist personas and 38 workflows for product
discovery, planning, architecture, implementation and review. The current coding
assistant executes the Markdown instructions with its available tools. The CLI
can prepare their context; it does not run an autonomous development team.

The public workflow IDs and persona names remain stable. The execution
instructions are original BMAD+ adaptations. The declared BMAD-METHOD baseline
remains v6.6.0; reviewing newer upstream ideas is separate from claiming that the
whole upstream release has been integrated.

## Start

Install the pack into the intended project with the BMAD+ installer:

```sh
npx bmad-plus install --packs core,dev-studio
```

Then ask the coding assistant directly:

> Miriam, use product-brief to define a small issue triage tool for our support team.

> Oholiab, use investigate to reproduce the failing import described in docs/issue.md.

The assistant reads the [pack skill](SKILL.md),
[execution guide](shared/execution.md), selected persona and workflow. A request
for a narrow fix does not require a complete discovery-to-sprint pipeline.

With the CLI available in the project, inspect or prepare a route:

```sh
npx --no-install bmad-plus studio list --json
npx --no-install bmad-plus studio prepare product-brief --directory . --request "Define the smallest useful issue triage tool" --json
npx --no-install bmad-plus studio prepare validate-prd --directory . --input docs/prd.md --json
```

Use `bmad-plus` directly when it is available on your PATH. Input files must exist
inside the selected project. Repeat `--input` to supply several explicit artifacts.
An artifact workflow needs at least one file; request and project workflows need
a request or a file. Missing context returns `needs-input`.

Preparation is read-only. It resolves configuration, loads actual shipped
instructions and selected input files, records their hashes and proposes a report
path. It does not inspect an entire project, write the deliverable, run tests or
certify that a model followed the workflow. Give the prepared contents to the
assistant and have it perform the selected procedure.

## Personas

| Persona | Role | Instructions |
| --- | --- | --- |
| Miriam | Business analysis and research | [Analyst](categories/analysis/analyst-agent.md) |
| Huldah | Technical documentation | [Technical writer](categories/analysis/tech-writer-agent.md) |
| Yosef | Product requirements and priorities | [Product manager](categories/planning/pm-agent.md) |
| Rachel | User experience and interaction | [UX designer](categories/planning/ux-designer-agent.md) |
| Bezalel | System architecture and technical decisions | [Architect](categories/architecture/architect-agent.md) |
| Oholiab | Implementation, debugging and verification | [Engineer](categories/implementation/dev-agent.md) |

Core personas can coexist with Dev Studio. Choose the role needed for the task;
the persona name describes instructions, not a separate running process.

## Workflow catalog

The [machine-readable catalog](shared/catalog.json) contains the routes and
required resources. The [CSV index](shared/module-help.csv) provides a compact
navigation view. Workflow IDs in text are routing suggestions, not automatic
triggers or mandatory dependencies.

| Category | Workflow | Expected result |
| --- | --- | --- |
| Analysis | [product-brief](categories/analysis/product-brief.md) | Product problem, audience and first useful scope |
| Analysis | [prfaq](categories/analysis/prfaq.md) | Proposed launch narrative and questions that challenge it |
| Analysis | [document-project](categories/analysis/document-project.md) | Documentation grounded in inspected project files |
| Analysis | [market-research](categories/analysis/market-research.md) | Sourced market and alternative analysis |
| Analysis | [domain-research](categories/analysis/domain-research.md) | Domain concepts, constraints and evidence gaps |
| Analysis | [technical-research](categories/analysis/technical-research.md) | Feasibility options and a concrete next check |
| Planning | [create-prd](categories/planning/create-prd.md) | Testable requirements and scope |
| Planning | [prd](categories/planning/prd.md) | Selection of PRD creation, edit or validation |
| Planning | [edit-prd](categories/planning/edit-prd.md) | Traceable requirements changes |
| Planning | [validate-prd](categories/planning/validate-prd.md) | Evidence-based requirements findings |
| Planning | [create-ux-design](categories/planning/create-ux-design.md) | User flows, interaction states and acceptance checks |
| Architecture | [create-architecture](categories/architecture/create-architecture.md) | Technical decisions, boundaries and tradeoffs |
| Architecture | [create-epics-stories](categories/architecture/create-epics-stories.md) | Deliverable increments and implementable stories |
| Architecture | [implementation-readiness](categories/architecture/implementation-readiness.md) | Alignment gaps and readiness evidence |
| Architecture | [generate-project-context](categories/architecture/generate-project-context.md) | Current project constraints with provenance |
| Implementation | [sprint-planning](categories/implementation/sprint-planning.md) | Scoped work, dependencies and capacity assumptions |
| Implementation | [create-story](categories/implementation/create-story.md) | A story with context and acceptance criteria |
| Implementation | [dev-story](categories/implementation/dev-story.md) | Implementation and verification against a story |
| Implementation | [code-review](categories/implementation/code-review.md) | Substantiated findings or a scoped zero-finding report |
| Implementation | [quick-dev](categories/implementation/quick-dev.md) | A bounded change with proportionate checks |
| Implementation | [sprint-status](categories/implementation/sprint-status.md) | Progress and blockers supported by current evidence |
| Implementation | [retrospective](categories/implementation/retrospective.md) | Lessons and actionable process changes |
| Implementation | [correct-course](categories/implementation/correct-course.md) | A reasoned response to a material change |
| Implementation | [investigate](categories/implementation/investigate.md) | Hypotheses, reproduction evidence and next action |
| Implementation | [checkpoint-preview](categories/implementation/checkpoint-preview.md) | A reviewable explanation of a change |
| Implementation | [qa-e2e-tests](categories/implementation/qa-e2e-tests.md) | Relevant automated checks and actual run evidence |
| Utilities | [distillator](categories/utilities/distillator.md) | A compact brief with sources and disclosed omissions |
| Utilities | [party-mode](categories/utilities/party-mode.md) | Compared perspectives and a decision record |
| Utilities | [brainstorming](categories/utilities/brainstorming.md) | Distinct options and a small experiment |
| Utilities | [adversarial-review](categories/utilities/adversarial-review.md) | Supported objections, refutations and open questions |
| Utilities | [edge-case-hunter](categories/utilities/edge-case-hunter.md) | Concrete boundary and failure scenarios |
| Utilities | [editorial-review-prose](categories/utilities/editorial-review-prose.md) | Precise wording improvements |
| Utilities | [editorial-review-structure](categories/utilities/editorial-review-structure.md) | A reader-oriented outline and section mapping |
| Utilities | [advanced-elicitation](categories/utilities/advanced-elicitation.md) | Resolved uncertainties and testable requirements |
| Utilities | [shard-doc](categories/utilities/shard-doc.md) | Linked sections with source coverage checks |
| Utilities | [index-docs](categories/utilities/index-docs.md) | An index of inspected documents |
| Utilities | [bmad-help](categories/utilities/bmad-help.md) | Relevant routes and a justified next step |
| Utilities | [customize](categories/utilities/customize.md) | Verified configuration or explicit instruction changes |

## Configuration and reports

Configuration comes from `_bmad/config.yaml` in the selected project:

```yaml
user_name: user
communication_language: English
document_output_language: English
output_folder: _bmad-output
project_name: Example project
```

Each missing value uses the displayed default, except `project_name`, which
defaults to the selected directory's name. A missing file is valid. A malformed
present file or an invalid known field is an error. Preserve unrelated settings
when customizing. The current user request and applicable host/project instructions
take precedence over conversation and document language preferences.

Reports default to `_bmad-output/dev-studio/WORKFLOW_ID.md`, adjusted for the
configured output folder. Code changes stay in the actual project. Reports record
scope, inputs, decisions, completed work, checks, unresolved questions and the next
action. On resume, read the previous report and revalidate changed inputs. A report
does not authorize overwriting user changes or repeating publication.

## Execution limits and migration

There is no BWML interpreter or TOML customization resolver in this pack. See the
[BWML migration note](shared/bwml-spec.md) for the supported replacement behavior.
Independent agent execution, browsing and command execution depend on the host.
When one assistant explores several perspectives, it must say so. Unavailable
checks and missing reviews remain visible.

Research requires accessible sources to support current factual claims. A static
resource check establishes that instructions were delivered; actual execution and
model behavior need separate evidence. No workflow guarantees defect-free code or
lossless summarization.

## Attribution

BMAD+ is maintained by Laurent Rochetta. Dev Studio's retained names and workflow
lineage acknowledge [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
by BMad Code, LLC, under the MIT License. The current delivery and execution
instructions are written for BMAD+; no upstream runtime is bundled by implication.
