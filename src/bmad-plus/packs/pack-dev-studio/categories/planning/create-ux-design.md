---
name: bmad-create-ux-design
description: Define task flows, interaction states, visual constraints and accessibility acceptance for a product.
---

# Create UX design

Load the [execution guide](../../shared/execution.md) and
[Rachel](ux-designer-agent.md). Produce an implementable design specification
that connects user tasks to observable behavior and presentation.

## Inputs

Use the product request or PRD, intended users and tasks, supported surfaces,
known constraints and any existing interface, components or brand guidance.
Inspect the current product when available. A missing prototype does not prevent
a useful draft, but unobserved behavior must remain unverified.

## Procedure

1. **Establish scope and evidence.** Identify the task the user must complete,
   its starting conditions and success outcome. Read existing requirements,
   relevant product screens or source components and design conventions.
   Distinguish observed problems from proposed improvements. Record unresolved
   product decisions before choosing a layout to conceal them.
2. **Map the information and journey.** Define relevant destinations, navigation,
   entry points and how a user knows where they are. Describe the main path,
   alternate entry, back or cancel behavior and recovery. Map each step to a
   product requirement or documented need.
3. **Define the behavior contract.** For each important interaction, specify:
   - Actor, trigger, prerequisites and access conditions.
   - Inputs, validation timing and the resulting state or navigation.
   - Default, loading, empty, success and error states where applicable.
   - Recovery, retry, cancellation and preservation of user-entered data.
   - Effects on stored data or external systems, including confirmation when
     the actual operation warrants it.
   - Repeated submissions, delayed responses, offline behavior or competing
     changes when relevant to the product.
     Mark a state not applicable with a reason instead of inventing features.
     Keep invariants explicit, such as preserving a draft after a failed save.
4. **Define the visual contract.** Reuse suitable established components and
   tokens. Specify hierarchy, content density, typography, color roles, spacing,
   layout constraints and component variants needed for this task. State narrow
   and wide viewport behavior, long-content wrapping and text enlargement.
   Describe focus and error appearance without relying on color alone. Explain
   the purpose of motion and define reduced-motion behavior where motion exists.
   Record asset sources and placeholders. A palette or mockup remains a proposal
   until its relevant contrast and rendering checks have been performed.
5. **Define accessibility behavior.** Specify semantic structure, accessible
   names, label and instruction relationships, keyboard order and controls,
   focus movement after dialogs or navigation, visible focus, status and error
   announcements, and alternatives for nontext content. Identify checks for
   contrast, zoom or reflow, text size, touch interaction and reduced motion
   where applicable. Name the project's target accessibility standard if known;
   an unconfirmed target remains open. Do not equate an automated scan with
   complete conformance.
6. **Create a reviewable representation.** Use a flow diagram, annotated
   wireframe, component example or prototype appropriate to the request and
   available tools. Map its states back to the behavior contract. Label
   illustrative content and distinguish a static representation from working
   interaction. Do not report generated imagery or a screenshot as usability
   evidence.
7. **Walk through and check.** Follow a primary task and a consequential failure
   path. Check wording, state transitions and consistency with requirements.
   If a runnable interface is available, inspect relevant keyboard interaction,
   viewport behavior, focus and errors; record environment and observed results.
   If only a specification exists, review its acceptance scenarios and mark
   browser, assistive-technology and user testing as not performed.
8. **Resolve and hand off.** Correct demonstrated inconsistencies. Record
   remaining product decisions, technical feasibility questions and validation
   gaps. Provide implementers with explicit acceptance scenarios and traceable
   component or requirement references.

## Output

Produce a UX specification containing:

- Scope, users, tasks and inspected evidence.
- Information architecture and task flows.
- Behavior contract and state transitions.
- Visual contract, reusable components and responsive constraints.
- Accessibility behavior and acceptance checks.
- Reviewable representation and its limitations.
- Acceptance scenarios, check results and unresolved decisions.

For each acceptance scenario, record its precondition, user action, expected
visible or accessible result and relevant requirement. For example, a failed
submission can require an announced error, retained input and a usable retry;
the exact behavior must follow the product's actual needs.

The report lists supplied inputs, changed design artifacts and what has been
specified, implemented and verified separately. Use the invoked workflow's
report path or the user's requested canonical destination.

## Acceptance and continuation

The main task and relevant failure paths must be understandable without guessing
missing states. Important visual and accessibility decisions need checkable
criteria. Do not report user validation, rendering verification or accessibility
conformance that was not performed.

On resume, compare requirements, component versions and previous decisions.
Revisit affected flows and states, preserve unaffected user edits and rerun
checks whose inputs changed. Hand off feasibility questions to
[Architecture](../architecture/create-architecture.md) or implementation work to
[Quick development](../implementation/quick-dev.md) only within the active task.
