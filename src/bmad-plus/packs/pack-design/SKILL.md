---
name: design-engine
description: >
  BMAD+ design pack. Atelier plans, builds, audits and reworks interfaces by opening the
  installed design, design-review and redesign skills after the pack's intake. Use when the
  user says /design or Atelier, asks for a maquette, a wireframe, a landing page, design
  tokens, an accessibility review, or the redesign of a live site.
---

# Design pack — dispatcher

> By Laurent Rochetta | BMAD+ design pack

## Where the rules are

This pack owns no design rule. The rules are the three skills of the `design-skill` package
(Atelier), copied by the installer next to this pack:

| Skill | Installed at | Owns |
|---|---|---|
| `design` | `.agents/skills/design/SKILL.md` | what a new screen must satisfy, the reference modules per surface, the delivery checklist |
| `design-review` | `.agents/skills/design-review/SKILL.md` | the audit protocol and its severity scale |
| `redesign` | `.agents/skills/redesign/SKILL.md` | how a live product is changed without losing what works |

This pack adds three things only: the **intake** (`intake.yaml`, the questions Atelier needs
answered before it acts), the **routing** between the three skills, and the **handoffs** to the
other BMAD+ agents. The persona that drives them is `design-engine.md`, next to this file.

## Missing installation

Before any command, check that `.agents/skills/design/SKILL.md` exists. When it does not, the
pack was installed without its skills (the `design-skill` dependency did not resolve, or the
copy was interrupted). Report it, point at `bmad-plus doctor`, which names the missing files,
and stop. Do not improvise design rules, do not paraphrase them from memory, and do not treat
this dispatcher as a design manual: without its skills it is a router with nothing to route to.

## Command router

Every command starts by loading `design-engine.md`. The intake runs, or resumes, whenever
`bmad-plus intake plan` on `_bmad-output/design/intake.json` is not ready, or when
`intake.yaml` changed since the answers were recorded; `_bmad-output/design/brief.md` is
rendered again from the answers each time.

| Command | Role | Action |
|---|---|---|
| `/design read` | Builder | Run or resume the intake with the `bmad-plus-intake` skill, settle the dials and the stack, render `_bmad-output/design/brief.md`, print the one-line design read (surface · audience · aesthetic family) and the three dials with their origin (set or inferred) |
| `/design build <surface>` | Builder | Brief ready → open `design`, follow its routing for `<surface>`, build, deliver with the skill's checklist verdict quoted |
| `/design review <path or url>` | Reviewer | Open `design-review`, audit the given files or page, write `_bmad-output/design/review.md` as the skill prescribes, every finding labelled `tool` or `inspection` |
| `/design redesign` | Redesigner | Open `redesign` and follow it end to end: audit, decision with its reason, migration plan with the search and accessibility risks it flags, build through `design`, verification against the old version |
| `/design tokens` | Builder | Open `design` and its token modules; produce the token sheet for the stack the brief records |

`/design` alone, or `/design help`, prints this table and the state of the intake.

## What this pack does not do

- It runs no script and starts no process. Checks that need a browser or a scanner run only
  through the project's own tooling, on the user's say-so, and the report labels a tool run
  apart from an inspection.
- It sends nothing anywhere. BMAD+ copies the `skills/` directory of the `design-skill`
  package and nothing else; the package also ships a linker CLI (`bin/atelier.mjs`) that
  BMAD+ never invokes, and nothing in the copied files runs.
- It does not decide for Sentinel, the SEO pack or Shield. The handoff table in
  `design-engine.md` says what each receives and when.

## Files of this pack

| File | Role |
|---|---|
| `SKILL.md` | this dispatcher |
| `design-engine.md` | the Atelier persona: identity, the BMAD+ rules, activation, roles, capabilities, handoffs |
| `intake.yaml` | the design read as an intake (`bmad-plus intake check` validates it) |
| `bmad-skill-manifest.yaml` | the pack manifest read by the skill catalog |
