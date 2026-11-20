---
name: bmad-plus-challenge
description: Stress-test a plan, a design or a decision with the user before any work starts, or attack an existing plan file. Map the choices the plan depends on, look in the project before asking, ask the whole open frontier in one numbered round with a recommended answer for each question, and log every decision as answered, defaulted or unknown in decisions.md. Use when someone says "stress-test", "challenge my plan", "poke holes", "grill the plan", "challenge mon plan", "critique mon plan", "trouve les failles", or when an agent is about to act on a plan whose dependencies are not settled.
---

# Challenge a plan

## Overview

A plan fails where a choice it depends on was never made, or was made on a guess. This skill
finds those choices before work starts, settles them with the user in few rounds, and writes down
what was decided, on what basis and at what risk. It asks; it never builds, edits or runs
anything.

```
plan ─► decision tree ─► look in the project ─► frontier ─► one numbered round ─► user answers
              ▲                                                                       │
              └───────────── answers unlock the next questions ◄──────────────────────┘
                                   user confirms the end ─► decisions.md ─► hand over
```

## When to activate

- The user asks to stress-test, challenge, critique or poke holes in a plan, a design or a decision.
- The user names a plan file to attack (see "Adversarial mode").
- An agent is about to act on a plan with open dependencies (see "Called by another agent").

Do not challenge trivial work: a change that one person reverts in minutes, a request that already
says exactly what to do, a question with one obvious answer (ask it plainly), a decision a
`decisions.md` of this subject already covers, or a pack that declares its own questions (see
"What this skill is not").

## Protocol

1. **Frame.** Restate the plan in two or three lines and pick a subject slug (lowercase, hyphens).
   If `_bmad-output/<subject>/decisions.md` exists, read it and resume from it.
2. **Build the decision tree.** List the choices the plan rests on. Give each an id (`d1`, `d2`…)
   and the ids that must be settled before it can even be asked: "which database" waits for
   "single tenant or multi-tenant". Show the user a compact indented tree once, in round 1.
3. **Look before you ask.** For every open choice, search the repository, the installed project
   files (`AGENTS.md`, `README`, `package.json`, `docs/`, `project-context.md`) and
   `_bmad-output/`. When the answer is there, do not ask: state what you found and where
   ("`d3` is settled by `package.json`: Node 20"), record it, and move on. The user can overrule it
   in the next message.
4. **Find the frontier.** The frontier is every open choice whose prerequisites are all settled
   (answered, defaulted or unknown). Ask the whole frontier in one numbered round, at most 6
   questions. With more, take the ones whose wrong answer costs most and carry the rest over.
   Never put a question in a round while a prerequisite of it is still open, even when its answer
   looks obvious.
5. **Ask with a recommendation.** Each question carries the answer you recommend, phrased so that a
   bare "yes" accepts it, and one line of why:

   ```
   2. Do users sign in with an email link only?
      Recommended: yes, email link only, no passwords to store or reset.
      Why: the audience is occasional and the plan has no support staff.
   ```

   Ask in the user's language. A question is one decision, never a bundle.
6. **Record what you heard**, one status per decision, the same words as the pack intake:
   - `answered`: the user gave the answer, or said "yes" to a recommendation. A fact found in a
     file counts, with the file as its source.
   - `defaulted`: the user delegated ("your call", "use your defaults") and your recommendation
     stands. It is a proposal the user let stand, not a fact the user gave, and every deliverable
     built on it says so.
   - `unknown`: nobody knows yet. Keep the risk: what breaks if the plan goes ahead on the wrong
     guess, and who or what could settle it.
7. **Loop.** Each answer can unlock questions, remove some or add new ones: update the tree, find
   the new frontier, ask the next round. Stop when no choice is open.
8. **Soft cap of 5 rounds.** After round 5, stop asking. Summarise what is still open, what each
   open item blocks, and let the user say "stop" or "continue". "Continue" buys more rounds, and
   the summary comes back after each further round. The user can say "stop" at any time: every
   open choice is then recorded `unknown` with its risk, and your recommendation is kept in the
   notes, not adopted.
9. **Confirm the end.** Show the table of decisions and ask whether to close the session. Until
   the user confirms, nothing is executed and nothing is written: no commands beyond reading,
   no file created, no plan edited.
10. **Write and hand over.** Write `_bmad-output/<subject>/decisions.md` (layout below); a file
    that already exists is updated row by row, never replaced. Then offer
    to hand it to the agent the plan needs next: Atlas for a brief or a PRD, Forge for an
    architecture or a refactor, Nexus for a sprint, a swarm or a parallel run.

## decisions.md

```markdown
# Decisions — <subject>

<One line: the plan, the date (YYYY-MM-DD) and the mode (interview or adversarial).>

## Decisions

| ID | Decision | Status | Answer | Source | Risk |
|----|----------|--------|--------|--------|------|
| d1 | Who signs in | answered | Staff only | user | |
| d2 | Session length | defaulted | 12 hours | recommendation | Staff are logged out mid-task if shifts run longer |
| d3 | Data retention | unknown | | | Deletion rules unknown: a legal review may force a rewrite |

## Open items

- d3: what is missing, who can settle it, what it blocks.

## Next

Hand over to Forge: why this agent, and what it should read first.
```

One table, one row per decision. `Source` is `user`, a file path, or `recommendation` for a
`defaulted` row. `Risk` stays empty on an `answered` row and is never empty on `defaulted` or
`unknown`. `Open items` lists every `unknown` row and anything the user left unanswered; write
`None.` when there is none.

## Adversarial mode

The user names a plan file ("challenge `docs/plan.md`"). Read it. Do not edit it.

1. List the assumptions the plan rests on, written or implied, as `a1`, `a2`… with one line each.
2. Rank them by how much breaks if the assumption is false and how little evidence supports it.
3. Attack the weakest first: give the failure scenario in one or two sentences, what the project
   already shows for or against (with the path), and the question or the cheapest test that would
   settle it.
4. Assumptions that depend on others wait, as in the decision tree. Rounds, recommendations,
   the soft cap, the "stop" exit and the end-of-session confirmation work as in the protocol.
5. `decisions.md` keeps the same layout. Each row is an assumption, the answer is the verdict
   (holds, fails, or what must change), and `Open items` carries the changes the plan needs.

## Called by another agent

An agent that is about to act on shaky inputs can open this skill. It states, before the first
round:

- **why** it calls (the plan is about to be frozen, an architecture starts, a run launches);
- **which decision is open**;
- **what it already knows**, each fact with its source.

What the caller knows is settled: record it with the source `caller: <agent>`, do not search for
it again and do not ask the user to confirm it. If a lookup you made anyway contradicts it, say so
once and let the user rule. Start with the open decision and its tree. When the caller names no
open decision, hand that back instead of opening a session.

The result is the same `decisions.md`, handed back to the caller. The caller resumes its own work
only after the user has confirmed the end of the session.

## What this skill is not

- Not the pack intake. When a pack declares its questions, `bmad-plus intake` asks them and keeps
  the book; this skill discovers the questions a plan needs when nobody wrote them down.
- Not a code review or a test: it does not read the implementation to judge it.
- Not the plan itself. It settles the choices; Atlas, Forge or Nexus write and run the plan.
- Not a gate. The user decides, and "stop" always works.
