/**
 * BMAD+ Memory Journal — Karpathy Learning Layer core (Pillar 3)
 *
 * Data structures + helpers for the memory → reward → reinforcement loop:
 *
 *   1. appendEvent()          — append a structured event to .bmad/memory/journal.ndjson
 *   2. recall()               — ranked retrieval over the journal + human memory files
 *                               (decisions.md / lessons.md / patterns.md), with a
 *                               documented seam for the ChromaDB vector backend
 *   3. computeReward()        — normalize {eval, acceptance, ci} signals into [0, 1]
 *   4. updatePatternScore()   — Elo + decayed-Bayesian update of a pattern's score
 *   5. proposePromotion() /   — governance guard: pattern promotions are ALWAYS
 *      appendPromotion() /      persisted as PROPOSED and can only be applied after
 *      assertPromotionApplicable()  an explicit human/Shield approval. Never auto-applied.
 *
 * Design rules (enforced, see tests/unit/memory-journal.test.js):
 *   - Portable: Node stdlib only (fs/path/crypto). No network, no native deps.
 *   - Deterministic: `ts` and any randomness are INJECTED by the caller.
 *     This module never calls Date.now() or Math.random() — at import or at runtime.
 *   - Prompt-level learning only: scores steer retrieval/promotion, there is NO
 *     base-model fine-tuning (registry.yaml → memory.reward_signal.applies_to).
 *   - Builds ON pack-memory: reads the existing .agents/memory/*.md files created by
 *     tools/cli/lib/memory-init.js, and the north-star .bmad/memory/ scope from
 *     audit/2026-07-01/north-star/registry.yaml. Never modifies human memory files.
 *
 * Author: Laurent Rochetta
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./memory-store');

// ── Paths ────────────────────────────────────────────────────────────────────
// North-star scope (registry.yaml → memory.scopes.project): .bmad/memory/
// Current-reality scope (memory-init.js):                   .agents/memory/
// The journal is written to the north-star path; recall() reads BOTH so the
// module works today and after the Phase-2 migration without a breaking change.

const JOURNAL_RELPATH = path.join('.bmad', 'memory', 'journal.ndjson');
const PROMOTIONS_RELPATH = path.join('.bmad', 'memory', 'promotions.ndjson');
const HUMAN_MEMORY_DIRS = [path.join('.bmad', 'memory'), path.join('.agents', 'memory')];
const HUMAN_MEMORY_FILES = ['decisions.md', 'lessons.md', 'patterns.md'];

const VALID_OUTCOMES = ['success', 'failure', 'partial', 'abandoned'];

function journalPath(baseDir) {
  return path.join(baseDir, JOURNAL_RELPATH);
}

function promotionsPath(baseDir) {
  return path.join(baseDir, PROMOTIONS_RELPATH);
}

// ── Small pure helpers ───────────────────────────────────────────────────────

function clamp01(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function toMillis(ts) {
  if (typeof ts === 'number') return ts;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? null : ms;
}

function isValidTs(ts) {
  return (
    (typeof ts === 'number' && Number.isFinite(ts)) ||
    (typeof ts === 'string' && !Number.isNaN(Date.parse(ts)))
  );
}

/** Deterministic short id — no Math.random(), reproducible from content. */
function deterministicId(...parts) {
  return crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 12);
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôöùûüç_-]+/i)
    .filter((t) => t.length >= 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. JOURNAL — append / read
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Append a structured event to `<baseDir>/.bmad/memory/journal.ndjson`.
 *
 * @param {string} baseDir - Project root (the directory containing .bmad/).
 * @param {object} event
 * @param {string|number} event.ts   - REQUIRED, injected by the caller (ISO string or epoch ms).
 * @param {string} event.agent       - REQUIRED, e.g. 'forge', 'zecher', 'seo-judge'.
 * @param {string} [event.cli]       - Which CLI produced it (claude-code, gemini-cli, codex-cli, cursor, opencode, aider, antigravity).
 * @param {string} [event.model]     - Model id used (claude/gpt/gemini/local — model-agnostic by contract).
 * @param {string} [event.task]      - Free-text description of what was attempted.
 * @param {string} [event.outcome]   - One of: success | failure | partial | abandoned.
 * @param {object} [event.signals]   - Raw reward inputs, e.g. { evalScore: 0.9, acceptance: true, ci: 'pass' }.
 * @param {string[]} [event.artifactHashes] - Content hashes of produced artifacts (traceability).
 * @returns {object} The normalized event as persisted.
 */
function appendEvent(baseDir, event) {
  if (typeof baseDir !== 'string' || baseDir.length === 0) {
    throw new TypeError('appendEvent: baseDir must be a non-empty string');
  }
  if (!event || typeof event !== 'object') {
    throw new TypeError('appendEvent: event must be an object');
  }
  if (!isValidTs(event.ts)) {
    throw new TypeError(
      'appendEvent: event.ts is required and must be an ISO string or epoch ms (injected by the caller — this module never calls Date.now())'
    );
  }
  if (typeof event.agent !== 'string' || event.agent.length === 0) {
    throw new TypeError('appendEvent: event.agent is required');
  }
  if (event.outcome !== undefined && !VALID_OUTCOMES.includes(event.outcome)) {
    throw new TypeError(`appendEvent: event.outcome must be one of ${VALID_OUTCOMES.join('|')}`);
  }

  const normalized = {
    ts: event.ts,
    agent: event.agent,
    cli: event.cli || null,
    model: event.model || null,
    task: event.task || '',
    outcome: event.outcome || null,
    signals: event.signals && typeof event.signals === 'object' ? event.signals : {},
    artifactHashes: Array.isArray(event.artifactHashes) ? event.artifactHashes : [],
  };
  normalized.id =
    event.id || deterministicId(String(normalized.ts), normalized.agent, normalized.task);

  return store.appendRecord(baseDir, JOURNAL_RELPATH, normalized);
}

/**
 * Read all events from the journal. Corrupt lines are skipped, never fatal
 * (the journal is append-only and may be written by concurrent CLIs).
 *
 * @param {string} baseDir
 * @returns {object[]} events in file order (oldest first)
 */
function readJournal(baseDir, { bounded = false } = {}) {
  const file = journalPath(baseDir);
  if (!fs.existsSync(file)) return [];
  const events = [];
  const contents = bounded
    ? store.readText(baseDir, JOURNAL_RELPATH)
    : fs.readFileSync(file, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // skip corrupt line — append-only journals must tolerate torn writes
    }
  }
  return events;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. RECALL — ranked retrieval (lexical first cut, vector-backend seam)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split a human memory markdown file into `### heading` sections
 * (the format the pack-memory templates prescribe).
 */
function splitSections(markdown, sourceName) {
  const sections = [];
  const lines = markdown.split('\n');
  let current = null;
  for (const line of lines) {
    const m = /^###\s+(.*)/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { source: sourceName, heading: m[1].trim(), text: '' };
    } else if (current) {
      current.text += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** Lexical score: query-token hits weighted by frequency, normalized by doc length. */
function lexicalScore(queryTokens, text) {
  if (queryTokens.length === 0) return 0;
  const docTokens = tokenize(text);
  if (docTokens.length === 0) return 0;
  const freq = new Map();
  for (const t of docTokens) freq.set(t, (freq.get(t) || 0) + 1);
  let hits = 0;
  let matchedTerms = 0;
  for (const q of queryTokens) {
    const f = freq.get(q) || 0;
    if (f > 0) {
      matchedTerms += 1;
      hits += 1 + Math.log(f); // diminishing returns on repeats
    }
  }
  if (matchedTerms === 0) return 0;
  // Coverage bonus (how much of the query matched) × length normalization.
  const coverage = matchedTerms / queryTokens.length;
  return (hits * coverage) / Math.sqrt(docTokens.length);
}

/**
 * Recall ranked memory entries for a query.
 *
 * Sources merged:
 *   - the structured journal (.bmad/memory/journal.ndjson)
 *   - the human memory files decisions.md / lessons.md / patterns.md, looked up
 *     in BOTH .bmad/memory/ and .agents/memory/ (current pack-memory layout)
 *   - when scope === 'portfolio' and opts.portfolioDir is given, the portfolio
 *     brain's memory/*.md files as well (registry.yaml → memory.scopes.portfolio)
 *
 * ── VECTOR BACKEND SEAM ─────────────────────────────────────────────────────
 * Pass `opts.backend = { search(query, opts) => entries[] }` to delegate ranking
 * to a semantic index. The intended production backend is the existing RAG stack
 * (mcp-server/rag.py: ChromaDB + SentenceTransformers, declared in
 * registry.yaml → memory.index). The lexical scorer below is the dependency-free
 * fallback so recall works on every machine with zero Python provisioned.
 * Backends MUST return the same entry shape: { score, kind, source, ref, text, event? }.
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {string} [opts.baseDir='.']      - Project root.
 * @param {'project'|'portfolio'} [opts.scope='project']
 * @param {string} [opts.portfolioDir]     - Portfolio brain root (e.g. D:/travail/DEV/_brain).
 * @param {number} [opts.limit=8]
 * @param {string|number} [opts.now]       - INJECTED clock; enables recency decay on journal
 *                                           events. Without it, no decay is applied.
 * @param {number} [opts.halfLifeDays=30]  - Recency half-life for journal events.
 * @param {object} [opts.backend]          - Optional vector backend (see seam above).
 * @returns {Array<{score:number, kind:'event'|'note', source:string, ref:string, text:string, event?:object}>}
 */
function recall(query, opts = {}) {
  const {
    baseDir = '.',
    scope = 'project',
    portfolioDir = null,
    limit = 8,
    now = null,
    halfLifeDays = 30,
    backend = null,
    ranking = 'lexical',
    contextScope,
  } = opts;

  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new TypeError('recall: query must be a non-empty string');
  }
  if (!['lexical', 'evidence'].includes(ranking))
    throw new TypeError('recall: ranking must be lexical or evidence');
  if (ranking === 'evidence' && (scope !== 'project' || backend))
    throw new Error('Evidence ranking supports project-local lexical recall only.');

  // SEAM: semantic backend (ChromaDB via mcp-server) replaces lexical ranking wholesale.
  if (backend && typeof backend.search === 'function') {
    return backend.search(query, { baseDir, scope, portfolioDir, limit, now });
  }

  const queryTokens = [...new Set(tokenize(query))];
  const candidates = [];

  // 1) Structured journal events
  const nowMs = now !== null ? toMillis(now) : null;
  if (ranking === 'evidence') store.safeFile(baseDir, JOURNAL_RELPATH);
  for (const ev of readJournal(baseDir, { bounded: ranking === 'evidence' })) {
    const text = [ev.agent, ev.cli, ev.model, ev.task, ev.outcome, JSON.stringify(ev.signals || {})]
      .filter(Boolean)
      .join(' ');
    let score = lexicalScore(queryTokens, text);
    if (score > 0 && nowMs !== null) {
      const evMs = toMillis(ev.ts);
      if (evMs !== null && nowMs > evMs) {
        const ageDays = (nowMs - evMs) / 86400000;
        score *= Math.pow(0.5, ageDays / halfLifeDays);
      }
    }
    if (score > 0) {
      candidates.push({
        score,
        kind: 'event',
        source: 'journal.ndjson',
        ref: ev.id || String(ev.ts),
        text,
        event: ev,
      });
    }
  }

  // 2) Human memory files (both layouts), plus portfolio brain when asked
  const dirs = HUMAN_MEMORY_DIRS.map((d) => path.join(baseDir, d));
  if (scope === 'portfolio' && portfolioDir) {
    dirs.push(path.join(portfolioDir, 'memory'));
  }
  const seen = new Set();
  for (const dir of dirs) {
    for (const name of HUMAN_MEMORY_FILES) {
      const file = path.join(dir, name);
      const key = path.resolve(file);
      if (seen.has(key) || !fs.existsSync(file)) continue;
      seen.add(key);
      const md =
        ranking === 'evidence'
          ? store.readText(baseDir, path.relative(baseDir, file))
          : fs.readFileSync(file, 'utf8');
      for (const section of splitSections(md, name)) {
        const text = section.heading + '\n' + section.text;
        const score = lexicalScore(queryTokens, text);
        if (score > 0) {
          candidates.push({
            score,
            kind: 'note',
            source: section.source,
            sourceFile: path.relative(baseDir, file).split(path.sep).join('/'),
            ref: section.heading,
            text: text.trim(),
          });
        }
      }
    }
  }

  const ranked =
    ranking === 'evidence'
      ? require('./memory-outcomes').rankWithEvidence(baseDir, candidates, { contextScope })
      : candidates;
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. REWARD — normalize {eval, acceptance, ci} into [0, 1]
//    (registry.yaml → memory.reward_signal.inputs: [eval_score, user_acceptance, ci_outcome])
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_REWARD_WEIGHTS = { eval: 0.5, acceptance: 0.3, ci: 0.2 };

/**
 * Compute a scalar reward in [0, 1] from the three governed signals.
 * Missing signals are ignored and the remaining weights are renormalized,
 * so a CI-only event still yields a usable reward.
 *
 * @param {object} signals
 * @param {number}         [signals.evalScore]  - Eval suite score in [0, 1] (Pillar 4).
 * @param {boolean|number} [signals.acceptance] - User accepted the artifact (bool or [0,1]).
 * @param {string|number}  [signals.ci]         - 'pass' | 'fail' | numeric [0,1].
 * @param {object} [weights] - Override of DEFAULT_REWARD_WEIGHTS.
 * @returns {number} reward in [0, 1]
 */
function computeReward(signals, weights = DEFAULT_REWARD_WEIGHTS) {
  if (!signals || typeof signals === 'boolean') signals = {};
  const parts = [];
  if (signals.evalScore !== undefined && signals.evalScore !== null) {
    parts.push({ w: weights.eval, v: clamp01(Number(signals.evalScore)) });
  }
  if (signals.acceptance !== undefined && signals.acceptance !== null) {
    const v =
      typeof signals.acceptance === 'boolean'
        ? signals.acceptance
          ? 1
          : 0
        : clamp01(Number(signals.acceptance));
    parts.push({ w: weights.acceptance, v });
  }
  if (signals.ci !== undefined && signals.ci !== null) {
    let v;
    if (signals.ci === 'pass') v = 1;
    else if (signals.ci === 'fail') v = 0;
    else v = clamp01(Number(signals.ci));
    parts.push({ w: weights.ci, v });
  }
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  if (totalW === 0) return 0;
  return clamp01(parts.reduce((s, p) => s + p.w * p.v, 0) / totalW);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PATTERN SCORE — Elo + decayed-Bayesian update
// ═══════════════════════════════════════════════════════════════════════════

/** A fresh, never-reinforced pattern score. */
const INITIAL_PATTERN_SCORE = Object.freeze({
  elo: 1200, // Elo rating vs. the 1200 "average pattern" baseline
  alpha: 1, // Beta-distribution successes (uniform prior)
  beta: 1, // Beta-distribution failures  (uniform prior)
  mean: 0.5, // posterior mean alpha/(alpha+beta)
  updates: 0,
  lastTs: null,
});

/**
 * Apply one reward observation to a pattern score.
 *
 * Two complementary estimators are maintained:
 *   - Elo: score' = score + K * (reward - expected), where expected is the
 *     logistic expectation of beating the 1200 baseline. Fast-moving, ordinal —
 *     used for RANKING patterns in recall.
 *   - Decayed Bayesian (Beta): evidence decays multiplicatively toward the
 *     uniform prior (1,1) before each observation, so stale reinforcement
 *     fades and the posterior mean tracks the RECENT success rate — used for
 *     PROMOTION thresholds (candidate → validated → deprecated).
 *
 * Pure function: never mutates `current`, never reads the clock — `opts.ts`
 * must be injected by the caller if time-based decay is wanted.
 *
 * @param {object|null} current - Previous score (or null/{} for INITIAL_PATTERN_SCORE).
 * @param {number} reward - Scalar in [0, 1] (see computeReward()).
 * @param {object} [opts]
 * @param {number} [opts.k=32]            - Elo K-factor.
 * @param {number} [opts.baseline=1200]   - Elo opponent baseline.
 * @param {number} [opts.decay=0.98]      - Per-update evidence decay (1 = no decay).
 * @param {string|number} [opts.ts]       - INJECTED timestamp of this observation.
 * @param {number} [opts.halfLifeDays=90] - Extra time-based evidence decay between
 *                                          observations (only applied when both
 *                                          opts.ts and current.lastTs are present).
 * @returns {object} new score { elo, alpha, beta, mean, updates, lastTs }
 */
function updatePatternScore(current, reward, opts = {}) {
  const { k = 32, baseline = 1200, decay = 0.98, ts = null, halfLifeDays = 90 } = opts;
  const r = clamp01(reward);
  const cur = { ...INITIAL_PATTERN_SCORE, ...(current || {}) };

  // Time-based decay of accumulated evidence toward the uniform prior (1,1).
  let alpha = cur.alpha;
  let beta = cur.beta;
  if (ts !== null && cur.lastTs !== null) {
    const nowMs = toMillis(ts);
    const lastMs = toMillis(cur.lastTs);
    if (nowMs !== null && lastMs !== null && nowMs > lastMs) {
      const f = Math.pow(0.5, (nowMs - lastMs) / 86400000 / halfLifeDays);
      alpha = 1 + (alpha - 1) * f;
      beta = 1 + (beta - 1) * f;
    }
  }

  // Per-update multiplicative decay, then add the new observation.
  alpha = 1 + (alpha - 1) * decay + r;
  beta = 1 + (beta - 1) * decay + (1 - r);

  // Elo update against the baseline.
  const expected = 1 / (1 + Math.pow(10, (baseline - cur.elo) / 400));
  const elo = cur.elo + k * (r - expected);

  return {
    elo,
    alpha,
    beta,
    mean: alpha / (alpha + beta),
    updates: cur.updates + 1,
    lastTs: ts !== null ? ts : cur.lastTs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. GOVERNANCE GUARD — promotions are PROPOSED, never auto-applied
//    (registry.yaml → memory.reward_signal.governed_by: shield)
// ═══════════════════════════════════════════════════════════════════════════

const PROMOTION_STATUSES = ['PROPOSED', 'APPROVED', 'REJECTED', 'APPLIED'];

/**
 * Build a promotion record for a pattern status change. The record is ALWAYS
 * created with status 'PROPOSED' — no code path in this module can create an
 * approved promotion; approval is a human/Shield action recorded elsewhere.
 *
 * @param {object} input
 * @param {string} input.patternId          - Pattern being promoted (e.g. its heading in patterns.md).
 * @param {string|number} input.ts          - REQUIRED, injected by the caller.
 * @param {string} [input.fromStatus='candidate']
 * @param {string} [input.toStatus='validated']
 * @param {string} [input.reason]
 * @param {string[]} [input.evidence]       - Journal event ids backing the proposal.
 * @param {object} [input.score]            - Snapshot of the pattern score at proposal time.
 * @returns {object} promotion record with status 'PROPOSED'
 */
function proposePromotion(input) {
  if (!input || typeof input !== 'object')
    throw new TypeError('proposePromotion: input object required');
  if (typeof input.patternId !== 'string' || input.patternId.length === 0) {
    throw new TypeError('proposePromotion: patternId is required');
  }
  if (!isValidTs(input.ts)) {
    throw new TypeError('proposePromotion: ts is required and must be injected by the caller');
  }
  return {
    id: deterministicId(input.patternId, String(input.ts), input.toStatus || 'validated'),
    patternId: input.patternId,
    fromStatus: input.fromStatus || 'candidate',
    toStatus: input.toStatus || 'validated',
    reason: input.reason || '',
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    score: input.score || null,
    ts: input.ts,
    status: 'PROPOSED',
    governedBy: 'shield',
    approvedBy: null,
    approvedAt: null,
  };
}

/**
 * Persist a promotion to `<baseDir>/.bmad/memory/promotions.ndjson`.
 * GOVERNANCE GUARD: whatever status the in-memory record claims, it is written
 * as 'PROPOSED' with approval fields cleared. Tampered records cannot smuggle
 * an auto-approval onto disk through this module.
 *
 * @param {string} baseDir
 * @param {object} promotion - As returned by proposePromotion().
 * @returns {object} the record as persisted (status forced to 'PROPOSED')
 */
function appendPromotion(baseDir, promotion) {
  if (typeof baseDir !== 'string' || baseDir.length === 0) {
    throw new TypeError('appendPromotion: baseDir must be a non-empty string');
  }
  if (!promotion || typeof promotion !== 'object' || !promotion.patternId) {
    throw new TypeError('appendPromotion: promotion record required (use proposePromotion())');
  }
  const record = { ...promotion, status: 'PROPOSED', approvedBy: null, approvedAt: null };
  return store.appendRecord(baseDir, PROMOTIONS_RELPATH, record);
}

/** Read all persisted promotions (corrupt lines skipped, same as readJournal). */
function readPromotions(baseDir) {
  const file = promotionsPath(baseDir);
  if (!fs.existsSync(file)) return [];
  const records = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      /* skip corrupt line */
    }
  }
  return records;
}

/**
 * The gate every apply path MUST call before mutating patterns.md or retrieval
 * weights. Throws unless a human/Shield reviewer explicitly approved.
 *
 * @param {object} promotion
 * @returns {true}
 * @throws {Error} if status !== 'APPROVED' or approvedBy is missing
 */
function assertPromotionApplicable(promotion) {
  if (!promotion || typeof promotion !== 'object') {
    throw new Error('Governance guard: no promotion record supplied');
  }
  if (promotion.status !== 'APPROVED') {
    throw new Error(
      `Governance guard: promotion ${promotion.id || '?'} has status '${promotion.status}' — ` +
        `only human/Shield-APPROVED promotions may be applied (never auto-applied)`
    );
  }
  if (typeof promotion.approvedBy !== 'string' || promotion.approvedBy.length === 0) {
    throw new Error(
      `Governance guard: promotion ${promotion.id || '?'} is APPROVED but has no approvedBy identity`
    );
  }
  return true;
}

module.exports = {
  // paths (exported for the CLI/MCP wiring)
  JOURNAL_RELPATH,
  PROMOTIONS_RELPATH,
  HUMAN_MEMORY_FILES,
  VALID_OUTCOMES,
  PROMOTION_STATUSES,
  // journal
  appendEvent,
  readJournal,
  // recall
  recall,
  // reward + score
  DEFAULT_REWARD_WEIGHTS,
  INITIAL_PATTERN_SCORE,
  computeReward,
  updatePatternScore,
  // governance
  proposePromotion,
  appendPromotion,
  readPromotions,
  assertPromotionApplicable,
  // internals exported for tests
  _internal: { tokenize, lexicalScore, splitSections, deterministicId, clamp01 },
};
