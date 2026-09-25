---
name: bmad-plus-uat
description: Turn a delivery into a human acceptance recipe (recette) — a self-contained page a non-technical tester plays step by step, whose ticks become a JSON run the agent reads, triages and gates on. Use when a version goes to a test environment, when someone asks "what should I check", or when a run's results appear.
---

# Human acceptance recipe (recette)

## Overview

Automated tests prove that the pieces behave. A recipe proves that **a person saw the chain
work on screen**: writer → reader → screen → gesture. This skill turns a delivery into a
protocol anyone can run, and turns the tester's ticks into evidence the agent reads without
an intermediary.

Three gestures: **write the spec**, **build and deliver the page**, **read the run and triage it**.
Everything else is the `bmad-plus uat` command (alias `bmad-plus recette`), which is deterministic
and identical for every host and model.

```
delivery ─► spec JSON ─► build page ─► deploy to test env ─► a person plays it ─► run JSON
   ▲                                                                                  │
   └─── fix, or amended spec ◄─── triage: product / recipe / data / undecided ◄────────┘
```

## When to activate

- A version is ready for DEMO / PREPROD, before production — **always**.
- A visible feature was implemented and someone must confirm it on screen.
- Someone asks for "the recette", "the UAT", "what should I check".
- A results file appears, or the user says "read the run".

Read `uat.mode` from `_bmad/config.yaml`: `advisory` (build and offer the page, never block),
`gate` (the delivery waits for a passing gate), `off` (no recipe; say so in the delivery report).
**An absent `uat` block means `advisory`** — a project updated from an earlier version keeps its
configuration untouched, so the block is simply missing there. A delivery with no
human-observable change states that fact rather than skipping in silence.

## 1. Write the spec — `_bmad-output/uat/specs/<product>-<version>.json`

Schema: `bmad-plus/uat-spec/2` (`ref/uat-spec.schema.json`). Sources: the story's acceptance
criteria, the changelog, and **the screen itself** — read the component, do not recall it.

1. **A real sequence.** Steps follow one human pass: preparation → nominal case → control →
   gesture → end. Numbered because it is an order, not decoration.
2. **Where / Do / Expect** for every step. One click per `do` line. **One verifiable fact per
   expectation** — two facts are two lines, because the tester may see one and not the other.
3. **On-screen labels word for word**, inside `<span class="ecran">…</span>`, copied from the
   code. `uat lint --src <dir>` fails on a label that exists in no source file; run it before
   anyone opens the page.
4. **Name the witness and prove its state.** Every `witnesses[]` entry carries the read-only
   query that establishes it. A recipe placed on a witness that is not in the assumed state is
   unplayable, and the measurement must be re-run before publishing, not remembered.
5. **A positive control per changed behaviour**: the case that must stay as it was.
6. **`writes: true` on every step that persists something**, with `verify` — the read-only check
   (query, endpoint, command) you will run afterwards. When the step *attempts* something the
   product must refuse, keep `writes: true` and use `warning` to say what happens if the refusal
   does not come, and that the tester should stop and answer *not seen*.
7. **Numbers in `intro`**: what the measurement showed before the delivery, production included.
   "0" is a number and gets said.
8. Never an expectation no writer produces: if the data does not exist, the expectation is false
   before the tester starts. Never an expectation that quotes the defect it replaces — write what
   the screen shows now.
9. `closing.text`: what did not change, what still waits for a decision, the gesture you left out.
10. Keep a page under the configured budget (15 steps / 30 minutes by default). Beyond it, split
    into ordered pages and declare the order with `after` — a step meant "for later" inside
    another page gets played at once.

## 2. Build and deliver

```bash
bmad-plus uat lint <id> --src src          # labels, markup, budget, witnesses
bmad-plus uat build <id>                   # → _bmad-output/uat/pages/uat-<id>.html
```

The page is self-contained and carries the spec's SHA-256, so a run always says which revision
it answered. It opens in the recipe's language, otherwise the project's `communication_language`,
otherwise English, and the tester can switch to any of the installed languages on the page itself.

Deliver in the way the host allows, and say so plainly:

| Host | Delivery | Where the answers go |
|---|---|---|
| Claude Code / claude.ai | publish the page as an artifact with `capabilities: {db: {}, downloads: true}` | saved on every tick in the artifact database; read it with `ArtifactData list` on collection `recettes`, then `bmad-plus uat import` so the evidence lands in the repository |
| Any host, tester on this machine | `bmad-plus uat serve <id>` (loopback only) | written straight into `_bmad-output/uat/results/<id>/` at every tick |
| Any host, tester elsewhere | send `pages/uat-<id>.html` | the tester saves or copies the JSON; `bmad-plus uat import <id> --input <file>` |

Then tell the tester four things: the link or file, how long it takes, **which steps write for
real**, and the play order when several recipes share an environment (`bmad-plus uat order`).

### What the page guarantees — and what you check before a person opens it

A run takes tens of minutes. The tester answers in passing, opens the product in another
tab, comes back, reloads. On 2026-09-25 a page built outside this command showed its steps
before any run existed: every tick was displayed and none was kept, a reload emptied the
form, and the status read "saved" on nobody's word. What follows exists so that this
cannot happen again, on any project.

**The page is built, never written.** Persistence lives in one place, the template that
`bmad-plus uat build` fills. Do not hand-write an acceptance page, do not re-implement
saving in a project, do not edit the produced HTML. A page that needs something the
template lacks is a change to the template, made in BMAD+ with its tests.

**What every built page guarantees, by construction** (`uat build --json` lists them under
`guarantees`, and the build refuses a template that lost one):

| Guarantee | What the tester gets |
|---|---|
| `hidden-before-start` · `no-answer-before-run` | no answer field before a run exists, whatever a stylesheet says; a tick before that is refused and explained, never dropped |
| `verified-local-write` · `honest-save-status` | a write counts only once it reads back; the status names a refused save ("Could not save in this browser — save or copy the JSON") and never says "saved" otherwise |
| `save-on-every-change` | every tick and every keystroke in a note is kept at once, no blur needed, and the cursor never moves |
| `restore-before-capabilities` · `newer-copy-wins` | the browser's copy comes back synchronously on reload, before any optional capability answers; an older remote copy never overwrites a newer local one |
| `revision-guard` | a run that answered another revision of the recipe is offered, not poured in: identical lines keep their answers, changed lines are asked again, the earlier run stays untouched and exportable (`carriedFrom` in the results) |
| `other-tab-notice` | two tabs on one run converge on the latest change, and the page says so |
| `unreadable-draft-kept` | a saved run that cannot be read is reported and exportable, never deleted |
| `progress-accessible` | the share of lines *answered* — not passed — as a `progressbar` with its value, next to the seen / not seen / blocked counts |
| `storage-explained` | where the answers live and what makes them disappear (site data cleared, private window closed), and that nobody receives them until the JSON is handed over |
| `finished-is-not-accepted` · `unload-guard` | unanswered lines are said on the page before finishing (a second click finishes anyway); finishing keeps the date and says it is not an acceptance; leaving with an unsaved run is questioned |
| `utf8-and-escaped-diacritics` · `export-is-the-run` | UTF-8 declared, diacritics handled as escapes, and the exported JSON is the run as answered |

**Before a person opens the page**, in this order, and say in the delivery which ones ran:

1. `bmad-plus uat lint <id> --src <dir>` passes.
2. `bmad-plus uat build <id>` writes the page and lists its guarantees.
3. Open the built page in a real browser and play the essential pass yourself: no answer
   field before starting → enter a name and start → tick one *Seen* → tick one *Not seen* →
   type a remark without leaving the field → type an overall remark → **reload at once,
   without clicking anywhere** → everything is back and the progress says two lines are
   answered. `tools/qa/uat-page-browser-check.js` in the BMAD+ repository is this pass,
   automated; the framework's own suite (`tests/unit/uat-page.test.js`) replays every
   scenario of the incident, storage refusal and revision change included.
4. Run these where the project's execution policy allows: if tests do not run on this
   machine, run them on the project's remote environment. Never skip them to save time.

If any of these fail, the page is **not ready** — say so, and do not hand it over. A page
handed over without step 3 is handed over with that fact written next to it.

**Tell the tester where the answers live**, in one sentence, before the link: in the artifact
database (saved on every tick, nothing to send), in the project through `uat serve`, or in
their browser — on that device only, until they save the JSON. The page says it too.

**When the recipe is amended** after a run started, tell the tester their earlier run will be
offered on the new page and that only unchanged lines keep their answers.

## 3. Read, triage, gate

```bash
bmad-plus uat read <id>                    # every failure with its text and the tester's note
bmad-plus uat gate <id> [--emit-check]     # 0 pass · 1 fail · 2 awaiting · 3 stale
```

Classify **every** failed or blocked expectation in `_bmad-output/uat/triage/<id>.json` before
anything becomes a fix. A "not seen" is not automatically a bug — on the eight runs that shaped
this skill, eleven of seventeen were defects of the recipe itself.

| Class | Sign | What follows |
|---|---|---|
| `product` | the screen differs from what the code was meant to render | fix task on the story, and a replay step in the next version's recipe |
| `recipe` | the screen shows the intended result, the expectation described it wrongly | amend the spec, rebuild (new fingerprint), replay the affected steps, and say no product change was needed |
| `data` | the witness is no longer in the assumed state | re-run the witness query, reset or rename it, replay |
| `undecided` | no note, or not attributable | ask the tester what they saw — never guess. The gate stays red |

**A tick on a writing step is not a write.** Run each `verify` read-only and record the result in
`writeChecks`. This is not ceremony: a step ticked nine times out of nine once turned out to have
written nothing, and three correct steps were nearly rewritten on that false premise.

Then write the verdict where the project records deliveries — changelog or delivery report —
with the figures, the tester's name, and what stays open. The evidence is labelled
**human-observed**: the gate establishes that the run is complete, current and triaged, never
that the tester looked at the right place.

## Gating the project itself

`templates/` ships two scripts to copy into the project — they need nothing but Node,
and they are the only layer an agent cannot skip:

| Script | Where it belongs | What it refuses |
|---|---|---|
| `uat-spec-present.mjs` | next to the project's other checks, before the push | a version in `package.json` that no recipe names. A grouped recipe covers a version because it lists it in `versions`, never because its file name suggests a range |
| `uat-release-gate.mjs` | the production deploy step | a deployment whose recipe has no finished run, an outdated one, an unclassified failure, or a passed writing step nobody confirmed. Exit 4 means the gate could not run at all — which is not a pass |

`templates/README.md` carries the wiring. Tell the user plainly when a project has
neither: the recipe is then produced and offered, and nothing enforces it.

## Gating a delivery with Nexus

```bash
bmad-plus uat gate <id> --emit-check        # writes checks/gate-<id>.cjs, self-contained
```

Create a task whose scope is the results and triage folders, whose resources include the spec and
that verifier, and whose check runs it. `start` it with a host backend for the tester, record
`blocked` while the person plays, then `completed`, then `verify` and `accept`. A failing gate
keeps acceptance out of reach; the fix task carries the run and the triage entry as resources.

## What this skill does not do

- It does not replace automated tests or adversarial review. It is the human proof no test gives.
- It does not invent expectations: what the spec announces comes from the code and the
  measurement, never from the plan alone.
- It does not play the recipe. An agent that "plays" it in a headless browser has written a test,
  not a recipe. Checking that the *page* keeps answers (the pass above) is not playing the recipe:
  it proves the form, not the product.
- It does not write pages by hand. Persistence is the template's, tested in BMAD+; a project that
  needs more changes the template, not its copy of the page.

## Pitfalls already paid for

- A witness chosen without checking its state ("4 reds" were 2).
- A label with accents in the spec when the screen has none — the tester searches for the exact word.
- "the tiles" when two components render different tiles: name the card that carries the fact **and**
  the neighbouring card that looks like it.
- "go back to the folder" without saying how (browser back ≠ another tab plus refresh).
- One step reading two screens: totals were hunted on a page that only shows subtotals. One step, one screen.
- Two recipes on one environment destroying each other's witnesses through indirect writes — a save
  that triggers a recomputation. Declare witnesses, run `uat order`, and re-measure after each pass.
- A page written outside `uat build`, with its own persistence: the steps showed before the run
  existed, ticks were dropped, a reload lost everything, and "saved" was printed unverified
  (FormaPro, 2026-09-25). Build the page; check it in a browser; say which checks ran.
