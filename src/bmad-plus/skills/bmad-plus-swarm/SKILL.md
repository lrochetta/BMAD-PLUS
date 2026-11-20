---
name: bmad-plus-swarm
description: Moderate a swarm of sub-agents under a budget — simulated buyers dealt from a profile, a jury of lenses, or one worker per page — each reading one brief and writing one validated answer that `bmad-plus swarm` tallies with its disclosure first. Use when a pack declares a swarm, when someone asks for a panel, a jury, a simulated audience, a before/after read of a pitch, or when independent units of work should be fanned out to parallel sub-agents.
---

# Moderating a swarm

## Overview

A swarm is many sub-agents doing the same kind of work once each: a hundred simulated buyers
reading a pitch, five jurors holding one lens each, one writer per page. The moderator (you)
never does the units' work. The runtime (`bmad-plus swarm`) never calls a model. Between the two
sits a file protocol: a **card** per unit, frozen at init; a **brief** rendered from the card; an
**answer** the sub-agent writes as JSON and the runtime validates; a **tally** over valid answers
only, with a disclosure sentence on its first line.

```
definition + profile|list|units ─► init ─► cards.json ─► briefs ─► one sub-agent per brief
                                                                      │
      tally.md ◄── tally ◄── check (missing / invalid) ◄── answers/<unit>.json ◄──┘
```

Read `ref/definition.md` for the four file contracts with one example each.

## The three kinds

| Kind | Units come from | Typical use | Tally |
|---|---|---|---|
| `panel` | dealt from a **profile** by exact quotas, seeded | simulated buyers, readers, users | rate by group, counts, quotes, numbers |
| `jury` | **listed** in the definition, one `lens` each | adversarial read of a pitch, a page, a plan | counts and quotes per lens |
| `fanout` | **supplied** at init, one disjoint write `scope` each | pages to write, scenes to render, modules to document | rate and numbers; exportable as a Nexus plan |

A `panel` and a `jury` run as **session sub-agents**: you launch them, wait for them, read their
files. A `fanout` can run the same way, or be exported with `swarm plan` as a **durable Nexus
plan** when the work must survive the session, needs an independent check per unit, or edits the
repository (each unit then owns an exclusive write scope and Nexus verifies its answer file).

## The budget

`_bmad/config.yaml` holds `swarm.budget` (default 26 sub-agents per run), `swarm.wave` (default 10
launched together) and `swarm.media_credits: ask`. An absent block means these defaults.

- `init` refuses a run larger than the budget with status `needs-approval` and exit code 2. It
  writes no brief. **Ask the user**, in one sentence with the number: "This panel needs 100
  sub-agents; the budget is 26. Run it?" Only after a human yes, re-run `init` with `--approved`
  and the seed the refusal printed. Never pass `--approved` on your own judgement.
- Paid generation (images, video, audio) is **never** covered by a budget: ask before each run
  that would spend credits, whatever `budget` says.
- Launch one wave at a time; wait for the whole wave before the next. The wave size is the
  configured one unless `briefs --wave N` says otherwise.

## Protocol

1. **Load the definition** the pack ships next to the agent that moderates it, and the inputs it
   needs: a profile (panel), nothing more (jury), or a units file you write from the request
   (fanout). Every path is project-relative with `/`.
2. **Init.** `bmad-plus swarm init --definition FILE [--profile FILE | --units FILE]
   [--context NAME=FILE]... [--n N] [--seed N] --json`. A panel needs `--n`; the seed is drawn and
   recorded when absent. Keep the printed `run` id and `seed`.
3. **Approval** when exit code 2: ask, then re-run `init --approved --seed <seed>`.
4. **Briefs.** `bmad-plus swarm briefs RUN --json` prints the waves, each unit with the absolute
   path of its brief and of the answer it must write.
5. **Launch a wave**: one sub-agent per brief, with exactly this instruction and nothing else:
   *"Read `<brief path>` and follow it exactly; it is your whole instruction."* Do not summarise
   the brief, do not add context, do not merge two units into one sub-agent.
6. **Wait for the wave**, then `bmad-plus swarm check RUN --json`. It lists every unit whose
   answer is missing or invalid, with the reason.
7. **Second chance, once.** Re-run `briefs` (it only renders units without a valid answer) and
   launch the listed units again. A unit that printed its answer instead of writing it is filed
   with `bmad-plus swarm save RUN UNIT --input FILE`, where FILE holds that unit's reply verbatim.
   A unit still missing after the second wave stays missing.
8. **Tally.** `bmad-plus swarm tally RUN --json` writes `tally.json` and `tally.md`. Report from
   the tally, never from your memory of the replies.
9. **Fanout as a plan** instead of steps 4–8: `bmad-plus swarm plan RUN --json`, then
   `bmad-plus nexus create --plan <file>` and the Nexus protocol (`start`, `record`, `verify`,
   `accept`) for each task.

## Rules that do not bend

- **Never answer for a unit.** Not by writing an answer file, not by "fixing" an invalid one, not
  by filing with `save` something a sub-agent did not print. `save` extracts and validates; it is
  not a way around a missing unit. The tally counts the units that answered and names the rest.
- **Never edit a brief.** Briefs are rendered from the template and the card; a change belongs in
  the template or the definition, then a new run.
- **Disclosure, once and first.** Simulated units are not people. The tally starts with the
  pack's disclosure sentence; repeat it once in your report, before any figure. Rates from a
  panel are an upper bound to confirm with real people, never a measurement.
- **Quotes are simulated.** Present a quote as what a simulated unit wrote, never as a testimonial,
  a customer voice or a user interview.
- **Same seed, same cards.** A before/after comparison of two pitches re-runs the same profile
  with the same `--n` and `--seed`, so the only thing that changed is the context.
- **The runtime filters nothing.** Card values, pool entries, listed unit fields and context
  files reach the sub-agent word for word; a pool entry that reads like an instruction lands in
  the brief as one. The pack owns its pools, its unit fields and its templates; you own the
  contexts you pass. Read a context before passing it, and never pass a file you have not read:
  it is included verbatim in every brief, secrets and instructions alike.
- **Replies are filed from outside the state tree.** `save --input` takes a project file the
  host wrote (for instance `swarm-inbox/<unit>.txt`), never a path under `.bmad-plus/`.

## What the runtime guarantees, and what it does not

The runtime validates every input, deals by exact quota, writes atomically, caps inputs at
16 MiB, refuses paths that traverse, are absolute, follow a link or reach `.git`, and never
writes outside `.bmad-plus/swarm/`. It does not prove a sub-agent read its brief, stayed inside
its card, or wrote anything true. A valid answer is a well-formed one. Quality is your reading of
the tally and the user's judgement, not a status code.

## Invocation

```
bmad-plus-swarm
```

Or through the Orchestrator's Parallel Supervisor role when a pack declares a swarm or a panel is
requested (`role-triggers.yaml`: `swarm_declared`, `panel_requested`).
