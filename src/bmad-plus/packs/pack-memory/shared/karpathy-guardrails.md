# Karpathy Guardrails — BMAD+ Agent Behavioral Guidelines

> Adapted from [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) (132K ⭐, MIT License)
> Enhanced with BMAD+ memory integration

---

## G1 — Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, **ask**.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- **Check `.agents/memory/decisions.md`** for prior decisions on this topic before deciding again.
- **Check `.agents/memory/lessons.md`** for known pitfalls before proceeding.

## G2 — Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- **Check `.agents/memory/patterns.md`** — a pattern that already solved this might exist.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## G3 — Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

**Memory integration**: If you discover something surprising, **log it immediately** in `.agents/memory/lessons.md`.

## G4 — Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**Memory integration**: Log non-obvious architectural decisions in `.agents/memory/decisions.md` with rationale.

---

## When These Guidelines Are Working

- Fewer unnecessary changes in diffs — only requested changes appear
- Fewer rewrites due to overcomplication — code is simple the first time
- Clarifying questions come BEFORE implementation — not after mistakes
- Clean, minimal PRs — no drive-by refactoring or "improvements"
- **Persistent learning** — the same mistake never happens twice because it's in lessons.md

---

## Attribution

Behavioral principles by [Andrej Karpathy](https://x.com/karpathy) via [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) (MIT License).
Memory integration by [Laurent Rochetta](https://github.com/lrochetta/BMAD-PLUS).
