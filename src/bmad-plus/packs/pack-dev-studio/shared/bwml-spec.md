# BMAD+ Workflow Markup Language (BWML) — Specification v1.0

> **Pack:** Dev Studio
> **Purpose:** Define the BMAD+ proprietary workflow DSL that surpasses BMAD-METHOD v6 XML format
> **Created by:** Laurent Rochetta — https://github.com/lrochetta/BMAD-PLUS
> **License:** MIT

---

## Overview

BWML (BMAD+ Workflow Markup Language) is an XML-based DSL optimized for LLM execution. It extends the concepts from BMAD-METHOD v6 with advanced orchestration primitives: multi-agent delegation, parallel execution, validation gates, memory persistence, anti-regression guards, and structured artifact emission.

LLMs parse XML natively and reliably. BWML leverages this with semantically meaningful tags that guide deterministic execution while preserving LLM reasoning flexibility.

---

## Core Elements (inherited from BMAD v6, enhanced)

### `<workflow>` — Root container
```xml
<workflow id="dev-story" version="1.0" agent="oholiab">
  <!-- All steps live here -->
</workflow>
```

### `<phase>` — Named execution phase (NEW)
Groups steps into logical phases with optional gating.
```xml
<phase name="analysis" gate="required">
  <step>...</step>
  <step>...</step>
</phase>
```
- `gate="required"` — Must complete before next phase
- `gate="optional"` — Can be skipped

### `<step>` — Numbered execution step
```xml
<step n="1" goal="Load project context" tag="init">
  <action>...</action>
</step>
```

### `<action>` — Single action to execute
```xml
<action>Read the complete story file</action>
<action if="no stories found">HALT: inform user</action>
```

### `<check>` — Conditional branch
```xml
<check if="sprint_status file exists">
  <action>Load sprint data</action>
</check>
```

### `<critical>` — Must-follow rule (violation = HALT)
```xml
<critical>Execute ALL steps in exact order; do NOT skip steps</critical>
```

### `<output>` — Formatted user-facing output
```xml
<output>✅ **Context Loaded** — Story and project context ready</output>
```

### `<ask>` — Prompt user for input
```xml
<ask>Which story would you like to develop?</ask>
```

### `<goto>` — Jump to step or anchor
```xml
<goto step="9">Completion sequence</goto>
<goto anchor="task_check" />
```

### `<anchor>` — Jump target
```xml
<anchor id="task_check" />
```

---

## BMAD+ Extensions (NEW — our competitive advantage)

### `<agent>` — Invoke another BMAD+ agent inline
Enables cross-agent orchestration without leaving the workflow.
```xml
<agent name="bezalel" task="Review this architecture decision">
  <context>Current PRD and technical constraints</context>
  <expect>Architecture recommendation with trade-offs</expect>
</agent>
```
- `name` — BMAD+ agent to invoke (specialist personas or pack agents)
- `task` — What to ask the agent
- `<context>` — What context to pass
- `<expect>` — Expected output format

### `<parallel>` — Execute multiple actions concurrently
```xml
<parallel>
  <action>Run unit tests</action>
  <action>Run linting checks</action>
  <action>Validate acceptance criteria</action>
</parallel>
```

### `<loop>` — Iterative execution with break conditions
```xml
<loop over="incomplete_tasks" as="task">
  <action>Implement {{task}}</action>
  <action>Run tests for {{task}}</action>
  <validate>All tests pass for {{task}}</validate>
  <action>Mark {{task}} complete</action>
  <break if="HALT condition triggered" />
</loop>
```

### `<validate>` — Built-in validation gate with pass/fail
```xml
<validate id="dod-check" severity="blocking">
  <criterion>All tasks marked [x]</criterion>
  <criterion>All acceptance criteria satisfied</criterion>
  <criterion>Full test suite passes with 0 failures</criterion>
  <criterion>No regressions detected</criterion>
  <on-fail>HALT — Do NOT proceed until all criteria pass</on-fail>
  <on-pass>Continue to next step</on-pass>
</validate>
```

### `<guard>` — Anti-regression protection
Prevents common AI mistakes explicitly.
```xml
<guard type="anti-regression">
  Never delete existing code without explicit user approval
</guard>
<guard type="scope">
  Only modify files listed in the story spec
</guard>
<guard type="quality">
  Never mark a task complete without running tests
</guard>
```

### `<emit>` — Produce structured artifacts
```xml
<emit type="story-status" format="yaml">
  story_key: {{story_key}}
  status: review
  completed_tasks: {{completed_count}}
  date: {{date}}
</emit>
```
- `type` — Artifact type (story-status, report, checklist, etc.)
- `format` — Output format (yaml, markdown, json)

### `<context>` — Load external context
```xml
<context source="file" path="**/project-context.md" />
<context source="file" path="architecture.md" optional="true" />
<context source="memory" key="last-sprint-decisions" />
```

### `<memory>` — Persist/recall across sessions
```xml
<memory action="store" key="sprint-velocity" value="{{calculated_velocity}}" />
<memory action="recall" key="last-review-findings" />
```

### `<escalate>` — Escalation to human or higher agent
```xml
<escalate to="user" severity="high">
  Architecture decision required: monolith vs microservices.
  Trade-offs documented in {{arch_doc_path}}.
</escalate>
<escalate to="bezalel" severity="medium">
  Implementation diverges from architecture — review needed.
</escalate>
```

### `<retry>` — Auto-retry with limits
```xml
<retry max="3" backoff="progressive">
  <action>Run failing test suite</action>
  <action>Fix identified issues</action>
  <on-exhaust>HALT — 3 consecutive failures, request human guidance</on-exhaust>
</retry>
```

### `<fallback>` — Graceful degradation
```xml
<fallback>
  <try>
    <agent name="miriam" task="Analyze market data" />
  </try>
  <catch>
    <action>Perform analysis directly using available context</action>
  </catch>
</fallback>
```

### `<metric>` — Track quantitative progress
```xml
<metric name="test-coverage" target="80%" current="{{coverage}}" />
<metric name="tasks-completed" value="{{done}}/{{total}}" />
```

---

## Composition Example

```xml
<workflow id="dev-story" version="1.0" agent="oholiab">
  <critical>Execute ALL steps in exact order; do NOT skip</critical>
  <critical>Never stop for "milestones" or "session boundaries"</critical>
  
  <guard type="anti-regression">
    Never delete existing functionality without explicit approval
  </guard>
  <guard type="scope">
    Only modify files specified in the story tasks
  </guard>

  <phase name="initialization" gate="required">
    <step n="1" goal="Find and load story">
      <context source="file" path="sprint-status.yaml" optional="true" />
      <check if="story_path provided">
        <action>Load story file directly</action>
        <goto anchor="implementation" />
      </check>
      <check if="sprint status exists">
        <action>Find first ready-for-dev story</action>
      </check>
      <escalate to="user" if="no ready stories found">
        No stories available. Options: create-story, validate existing, or specify path.
      </escalate>
    </step>
  </phase>

  <phase name="implementation" gate="required">
    <anchor id="implementation" />
    <loop over="incomplete_tasks" as="task">
      <step goal="Implement {{task}} following TDD">
        <!-- RED -->
        <action>Write FAILING tests first</action>
        <validate severity="info">Tests fail as expected</validate>
        
        <!-- GREEN -->
        <action>Implement MINIMAL code to pass tests</action>
        <validate severity="blocking">All tests pass</validate>
        
        <!-- REFACTOR -->
        <action>Improve code structure, keep tests green</action>
        <validate severity="blocking">No regressions after refactor</validate>
        
        <action>Mark {{task}} [x] in story file</action>
        <metric name="tasks-completed" value="{{done}}/{{total}}" />
      </step>
      
      <retry max="3">
        <action>Fix any failing tests</action>
        <on-exhaust>
          <escalate to="user">3 consecutive failures on {{task}}</escalate>
        </on-exhaust>
      </retry>
    </loop>
  </phase>

  <phase name="completion" gate="required">
    <step goal="Story completion and review">
      <validate id="definition-of-done" severity="blocking">
        <criterion>All tasks marked [x]</criterion>
        <criterion>All acceptance criteria satisfied</criterion>
        <criterion>Full test suite passes</criterion>
        <criterion>File list complete</criterion>
        <criterion>Dev notes documented</criterion>
        <on-fail>HALT — Complete remaining items</on-fail>
      </validate>
      
      <emit type="story-update" format="yaml">
        status: review
        completed: {{date}}
      </emit>
      
      <output>✅ Story {{story_key}} complete and ready for review</output>
      
      <escalate to="user" severity="info">
        Recommended: run code-review with a DIFFERENT LLM
      </escalate>
    </step>
  </phase>
</workflow>
```

---

## BWML vs BMAD v6 Comparison

| Feature | BMAD v6 | BWML (BMAD+) |
|---------|---------|--------------|
| Steps & Actions | ✅ | ✅ |
| Conditional checks | ✅ | ✅ |
| Goto/Anchors | ✅ | ✅ |
| Critical rules | ✅ | ✅ |
| User prompts | ✅ | ✅ |
| **Phases with gates** | ❌ | ✅ |
| **Multi-agent delegation** | ❌ | ✅ `<agent>` |
| **Parallel execution** | ❌ | ✅ `<parallel>` |
| **Loops with break** | ❌ | ✅ `<loop>` |
| **Validation gates** | ❌ | ✅ `<validate>` |
| **Anti-regression guards** | ❌ | ✅ `<guard>` |
| **Artifact emission** | ❌ | ✅ `<emit>` |
| **Context loading** | ❌ | ✅ `<context>` |
| **Memory persistence** | ❌ | ✅ `<memory>` |
| **Escalation** | ❌ | ✅ `<escalate>` |
| **Auto-retry** | ❌ | ✅ `<retry>` |
| **Graceful fallback** | ❌ | ✅ `<fallback>` |
| **Progress metrics** | ❌ | ✅ `<metric>` |
| Python dependency | ✅ Required | ❌ None |
| TOML config | ✅ Required | ❌ Self-contained |

---

## Attribution

BWML is inspired by the workflow DSL in [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.6.0 by BMad Code, LLC (MIT License). Extended with BMAD+ proprietary orchestration primitives by [Laurent Rochetta](https://github.com/lrochetta/BMAD-PLUS).
