---
name: bmad-plus-intake
description: Ask a user the questions a pack needs before it acts, a few at a time and in the user's language, record every answer, proposed default or unknown with its risk, and render the brief the pack works from. Use when a pack declares an intake, when a pipeline or a swarm is about to start, when a request lacks what the pack must know, or when someone says "what do you need from me".
---

# Pack intake

## Overview

A pack acts on what it knows. An intake is the list of what it must know before it starts:
each question marked must-have or not, with a default where one is honest and the risk the
pack runs when the answer stays unknown. The host asks, the user answers, the CLI keeps the
book, and the rendered brief becomes the contract for everything the pack does next.

Three files: the pack's **intake** (`intake.yaml`, shipped with the pack), the **answers**
(`.json`, written only through the CLI) and the **brief** (`.md`, rendered from both).
Formats and one example each: `ref/intake-format.md`.

```
intake.yaml ─► plan ─► ask (≤ max_per_message) ─► record ─► plan says ready ─► render ─► brief.md
                 ▲                                      │
                 └──────────── not ready yet ◄──────────┘
```

## When to activate

- A pack with an `intake` field in the registry is about to run its pipeline or start a swarm.
- The spine's Project Context names a pack that drives skills, and the request is thin.
- The user asks what is needed, or an agent is about to guess at something the user knows.

Never start a swarm or a pipeline for a pack while one of its must-haves is neither answered
nor marked unknown with its risk. Never invent an answer.

## Protocol

1. **Locate the files.** The intake is `.agents/skills/<pack_dir>/<intake>` as the registry
   declares it. Keep the answers next to the pack's output, for example
   `_bmad-output/<pack>/intake.json`; the brief goes where the pack's first step reads it.
2. **Plan.** `bmad-plus intake plan --intake FILE --answers FILE --json`. Exit 0 means ready;
   exit 2 means a must-have is open. `next` lists what to ask now, must-haves first, in the
   file's order, never more than `max_per_message`.
3. **Ask in the user's language** (`language: user`) or in the tag the intake names. One
   message, the questions of `next`, each with its choices or bounds when it has them, and
   the default where one exists ("5 unless you say otherwise"). Do not pad, do not rephrase
   the question's intent, do not ask what is already recorded.
4. **Record what you heard.** `bmad-plus intake record --intake FILE --answers FILE --set
   id=VALUE ... --json`. A value is checked against the question's kind and bounds and
   refused when it does not fit; ask again rather than coerce. When the user does not know,
   `--set id=UNKNOWN` records the question's risk with it. When the user accepts the proposed
   default without choosing, `--default id` records it as `defaulted`; a value the user
   actually chose, even equal to the default, is recorded with `--set` as `answered`.
5. **Loop** to step 2 until `plan` says ready. Stop asking then, even if optional questions
   remain: say which ones stay open and move on unless the user wants to continue.
6. **Render.** `bmad-plus intake render --intake FILE --answers FILE --out brief.md --json`.
   The brief lists every section, every answer with its status and must-have mark, and an
   "Open questions" list with the risks. Hand the brief to the pack's pipeline or swarm as
   their input; quote the open risks in the first deliverable.

## Rules

- A `defaulted` value is a proposal the user let stand, not a fact the user gave. The brief
  says so, and a deliverable built on it says so too.
- An `unknown` answer carries its risk everywhere the answer would have been used.
- Answers are written only through `record`; never edit the JSON by hand, never write the
  brief by hand. A changed intake file invalidates an answers file that no longer fits it;
  `plan` reports the problem, `record --reset` starts the file again, empty, for the same
  intake id (a file that belongs to another intake is never reset over), and the questions
  are asked again.
- `render` only overwrites a brief it wrote before for the same intake (the second line of
  the file is the ownership marker); `record` only overwrites an answers file of the same
  intake. Neither writes under `.git/`, `_bmad/`, `.bmad-plus/` or `node_modules/`, nor
  through a symlink. A user's value is printed as an indented block under `Answer:`, so what
  the user typed never becomes a heading or a list of the brief.
- `bmad-plus intake check FILE --json` validates an intake file; the BMAD+ build runs the
  same validator on every intake a pack declares.

## Commands

```bash
bmad-plus intake check FILE --json
bmad-plus intake plan --intake FILE --answers FILE --json
bmad-plus intake record --intake FILE --answers FILE --set id=VALUE [--set id=UNKNOWN] [--default id] --json
bmad-plus intake render --intake FILE --answers FILE --out brief.md --json
```

Paths are relative to the project (`--directory`, default the current directory) and must
stay inside it. Exit codes: 0 done, 1 invalid file or value, 2 not ready (`plan`).
