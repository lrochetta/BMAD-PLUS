# memory-journal.js — Karpathy Learning Layer core (Pillar 3)

Portable data structures + helpers for the BMAD+ **memory → reward → reinforcement** loop.
Legacy manually supplied rewards can propose pattern promotion; they do not steer
recall. The optional `memory-outcomes.js` layer derives a bounded recall boost from
current accepted Nexus evidence. There is **no base-model fine-tuning**, and a
retrieved memory is not evidence of improved downstream task quality.

Builds **on top of** the existing `pack-memory` (Zecher, Karpathy guardrails G1–G4,
`decisions/lessons/patterns/context.md` templates). It never modifies those files or
`tools/cli/lib/memory-init.js` — it adds a structured, machine-readable layer beside them.

```
.bmad/memory/journal.ndjson      ← structured event log (this module, north-star scope)
.bmad/memory/promotions.ndjson   ← governance queue (always PROPOSED)
.bmad/memory/outcomes.ndjson     ← immutable, provenance-backed accepted outcome receipts
.bmad/memory/writer.lock         ← shared synchronous writer mutex
.agents/memory/*.md              ← human memory (pack-memory, current layout) — READ ONLY here
.bmad/memory/*.md                ← human memory (north-star layout) — READ ONLY here
```

## Hard rules baked into the module

| Rule | Enforcement |
|---|---|
| Injected event clock | `ts` is a **required, caller-injected** field; event/receipt IDs are content hashes. The storage mutex separately uses a random owner token; it does not affect event IDs. |
| Node stdlib only | No network or additional service is required for project-local memory. Evidence inspection reads Nexus state and current filesystem identities. |
| Serialized writes | Journal, scores, promotions and outcomes share the same project mutex. Legacy readers skip corrupt lines; new appends refuse an incomplete final line. Outcome parsing fails on corruption. |
| Promotions are never auto-applied | `proposePromotion()` only emits `status: 'PROPOSED'`; `appendPromotion()` **forces** `PROPOSED` + clears approval fields on disk even for tampered records; `assertPromotionApplicable()` throws unless `status === 'APPROVED'` **and** `approvedBy` names a human/Shield reviewer. |

## API

### 1. Journal

```js
const mj = require('./memory-journal');

mj.appendEvent(projectDir, {
  ts: new Date().toISOString(),        // REQUIRED — injected by the caller
  agent: 'forge',                      // REQUIRED
  cli: 'claude-code',                  // claude-code | gemini-cli | antigravity | cursor | codex-cli | opencode | aider
  model: 'claude',                     // model-agnostic by contract (claude/gpt/gemini/local)
  task: 'refactor postgres pooling',
  outcome: 'success',                  // success | failure | partial | abandoned
  signals: { evalScore: 0.9, acceptance: true, ci: 'pass' },
  artifactHashes: ['abc123'],          // traceability to produced artifacts
});

mj.readJournal(projectDir);            // → events[], oldest first, corrupt lines skipped
```

### 2. Recall (lexical first cut + vector-backend seam)

```js
mj.recall('postgres pooling', {
  baseDir: projectDir,
  scope: 'project',                    // or 'portfolio' + portfolioDir: 'D:/travail/DEV/_brain'
  limit: 8,
  now: new Date().toISOString(),       // optional injected clock → recency decay on events
  halfLifeDays: 30,
});
// → [{ score, kind: 'event'|'note', source, ref, text, event? }] ranked desc
```

Sources merged: `journal.ndjson` events + `### `-sectioned entries from
`decisions.md` / `lessons.md` / `patterns.md` in **both** `.bmad/memory/` (north-star)
and `.agents/memory/` (current pack-memory layout), plus `<portfolioDir>/memory/*.md`
when `scope: 'portfolio'`.

For opt-in project-local evidence ranking, pass `ranking: 'evidence'` and
`contextScope: ['src/component']`. Relevant notes with current accepted Nexus evidence
receive at most a 25% boost; failed/unverified/duplicate observations cannot supply it.
Stale, explicitly superseded or contradictory evidence is excluded, while unsupported
notes remain labeled `unverified`. Alternative backends and portfolio scope are not
part of evidence ranking. See the [outcome contract](../../../docs/specs/memory-outcomes.md)
for observation input, freshness checks, limitations and recovery.

**ChromaDB seam** — pass `backend: { search(query, opts) }` and ranking is delegated
wholesale to it. The intended production backend is the existing RAG stack
(`mcp-server/rag.py`: ChromaDB + SentenceTransformers — `registry.yaml → memory.index`).
Backends must return the same entry shape as the lexical fallback, so callers never
know which engine served them. The lexical scorer is the zero-dependency fallback for
machines without Python provisioned.

### 3. Reward + pattern score

```js
const reward = mj.computeReward({ evalScore: 0.8, acceptance: true, ci: 'fail' });
// weights eval 0.5 / acceptance 0.3 / ci 0.2 (registry.yaml → memory.reward_signal.inputs)
// missing signals renormalize the remaining weights; result always in [0, 1]

let score = mj.INITIAL_PATTERN_SCORE;              // { elo: 1200, alpha: 1, beta: 1, mean: 0.5, ... }
score = mj.updatePatternScore(score, reward, { ts: eventTs });
```

Two complementary estimators per pattern:

- **Elo** (`k=32`, baseline 1200): `elo' = elo + K·(reward − expected)` — a legacy
  descriptive score; it is not consumed by recall. Fresh pattern + reward 1 → 1216.
- **Decayed Bayesian (Beta)**: evidence decays multiplicatively toward the uniform
  prior (1,1) — per-update (`decay=0.98`) and time-based (`halfLifeDays=90`, only when
  `ts` is injected) — so `mean = α/(α+β)` tracks the **recent** success rate, used for
  **promotion thresholds** (`candidate → validated → deprecated` in `patterns.md`).

Pure function: never mutates input, never reads the clock.

### 4. Governance guard

```js
const p = mj.proposePromotion({ patternId: 'chromadb batch ingestion', ts, reason: 'mean 0.82 / 12 events', evidence: [eventIds] });
mj.appendPromotion(projectDir, p);        // persisted as PROPOSED, always
// ... a human / Shield reviewer flips it to APPROVED with approvedBy elsewhere ...
mj.assertPromotionApplicable(approved);   // the gate every apply path MUST call
```

Governed by **Shield** (`registry.yaml → memory.reward_signal.governed_by`): bounded
self-modification, versioned (append-only ndjson) and reversible (a promotion record
never rewrites history; a rollback is just another proposal).

## Testing

```
npx jest tests/unit/memory-journal.test.js
```

32 tests: append/recall round-trip on a tmp dir, corrupt-line tolerance, recency decay
with injected clock, portfolio scope, backend-seam delegation, exact Elo/Beta math,
purity, and the anti-tamper governance guard.

## Future wiring (done by the orchestrator, not this module)

- **MCP tools** `memory.write` / `memory.recall` in `mcp-server/` — thin wrappers over
  this ndjson contract so every MCP-capable CLI shares one memory (Pillar 5).
- **CLI commands** `bmad-plus memory log|recall|promote` in `tools/cli/commands/memory.js`.
- **Zecher consolidation**: pack-memory's archivist reads `journal.ndjson` during
  session consolidation and proposes pattern promotions via `proposePromotion()`.
