/**
 * BMAD+ `mem` Command — portable Karpathy memory loop (Pillar 3)
 *
 * Exposes tools/cli/lib/memory-journal.js through the CLI so recall / write /
 * reinforce behave IDENTICALLY no matter which agent CLI is driving
 * (claude-code, gemini-cli, codex-cli, cursor, opencode, aider, antigravity):
 *
 *   bmad-plus mem recall <query...>   — ranked retrieval over journal + memory files
 *   bmad-plus mem write               — append a structured event (--agent --cli --model --task --outcome)
 *   bmad-plus mem reinforce           — apply a reward to a pattern score; any resulting
 *                                       promotion is persisted as PROPOSED, never applied
 *
 * NOTE: registered as `mem` (not `memory`) — `memory` is already taken by the
 * brain scanner in tools/cli/commands/memory.js and must not be disturbed.
 *
 * Design rules (mirroring memory-journal.js):
 *   - The clock is read ONCE inside the action (new Date().toISOString()) and
 *     injected into every library call. Nothing reads the clock at import time.
 *   - The run* handlers take an injected `now` + `log`, so tests drive them
 *     deterministically against a tmp dir (tests/unit/memory-journal-cmd.test.js).
 *   - Output goes through plain log lines (+ --json for machine consumption) so
 *     ANY driving CLI can parse results — no interactive prompts, no TTY needs.
 *   - Governance guard: reinforce may PROPOSE a pattern promotion when the
 *     posterior mean crosses the threshold, but the record is always written
 *     with status PROPOSED (memory-journal.appendPromotion forces it anyway).
 *
 * Author: Laurent Rochetta
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const mj = require('../lib/memory-journal');
const store = require('../lib/memory-store');
const outcomes = require('../lib/memory-outcomes');

// ── Pattern score store ──────────────────────────────────────────────────────
// Lives next to the journal in the north-star scope (.bmad/memory/). Keyed by
// patternId (the `### heading` in patterns.md). This file is CLI-owned state;
// memory-journal.js stays a pure library and never touches it.

const SCORES_RELPATH = path.join('.bmad', 'memory', 'pattern-scores.json');

// Promotion proposal thresholds (candidate → validated). Tuned conservatively:
// the posterior mean is decayed-Bayesian (memory-journal.updatePatternScore),
// so 0.7 over >= 3 updates means a genuinely recent, repeated success signal.
const PROMOTION_MEAN_THRESHOLD = 0.7;
const PROMOTION_MIN_UPDATES = 3;

function scoresPath(baseDir) {
  return path.join(baseDir, SCORES_RELPATH);
}

function readScores(baseDir) {
  const file = scoresPath(baseDir);
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Corrupt store never blocks the loop — reinforcement restarts from priors.
    return {};
  }
}

function writeScores(baseDir, scores) {
  store.writeJson(baseDir, SCORES_RELPATH, scores);
}

// ── Flag parsing helpers ─────────────────────────────────────────────────────

/** Map CLI flags to the memory-journal signals shape { evalScore, acceptance, ci }. */
function parseSignals(opts) {
  const signals = {};
  if (opts.eval !== undefined && opts.eval !== null) {
    signals.evalScore = Number(opts.eval);
  }
  if (opts.accept !== undefined && opts.accept !== null) {
    const raw = String(opts.accept).toLowerCase();
    if (raw === 'true' || raw === 'yes') signals.acceptance = true;
    else if (raw === 'false' || raw === 'no') signals.acceptance = false;
    else signals.acceptance = Number(opts.accept);
  }
  if (opts.ci !== undefined && opts.ci !== null) {
    signals.ci = opts.ci === 'pass' || opts.ci === 'fail' ? opts.ci : Number(opts.ci);
  }
  return signals;
}

function truncate(text, max = 120) {
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine;
}

// ── Action handlers (dependency-injected, unit-testable) ─────────────────────

/**
 * `mem recall <query...>` — ranked retrieval over journal events + memory notes.
 *
 * @param {string} query
 * @param {object} opts - { baseDir, scope, portfolioDir, limit, now, json, log }
 *                        `now` is the INJECTED clock (enables recency decay).
 * @returns {object[]} ranked entries (same shape as memory-journal.recall)
 */
function runRecall(query, opts = {}) {
  const {
    baseDir = process.cwd(),
    scope = 'project',
    portfolioDir = null,
    limit = 8,
    now = null,
    json = false,
    log = console.log,
    ranking = 'lexical',
    contextScope,
  } = opts;

  const results = mj.recall(query, {
    baseDir,
    scope,
    portfolioDir,
    limit,
    now,
    ranking,
    contextScope,
  });

  if (json) {
    log(JSON.stringify({ query, scope, ranking, count: results.length, results }, null, 2));
    return results;
  }

  if (results.length === 0) {
    log(`mem recall: no matches for "${query}" (scope: ${scope})`);
    return results;
  }
  log(`mem recall: ${results.length} match(es) for "${query}" (scope: ${scope})`);
  results.forEach((r, i) => {
    const origin =
      r.kind === 'event' ? `event ${r.source}#${r.ref}` : `note ${r.source} § ${r.ref}`;
    log(`  ${i + 1}. [${r.score.toFixed(3)}] ${origin}`);
    log(`     ${truncate(r.text)}`);
  });
  return results;
}

/**
 * `mem write` — append a structured event to the journal.
 *
 * @param {object} opts - { baseDir, agent, cli, model, task, outcome, signals, now, json, log }
 *                        `now` is the INJECTED clock used as the event ts.
 * @returns {object} the persisted event
 */
function runWrite(opts = {}) {
  const {
    baseDir = process.cwd(),
    agent,
    cli = null,
    model = null,
    task = '',
    outcome = undefined,
    signals = {},
    now,
    json = false,
    log = console.log,
  } = opts;

  const event = mj.appendEvent(baseDir, {
    ts: now,
    agent,
    cli,
    model,
    task,
    outcome,
    signals,
  });

  if (json) {
    log(JSON.stringify({ written: event }, null, 2));
  } else {
    log(`mem write: event ${event.id} appended (${event.ts})`);
    log(
      `  agent=${event.agent} cli=${event.cli || '-'} model=${event.model || '-'} outcome=${event.outcome || '-'}`
    );
    if (event.task) log(`  task: ${truncate(event.task)}`);
  }
  return event;
}

/**
 * `mem reinforce` — fold reward signals into a pattern's score.
 *
 * Updates the CLI-owned pattern-scores.json (Elo for ranking, decayed-Bayesian
 * mean for promotion). When the mean crosses PROMOTION_MEAN_THRESHOLD with
 * enough updates, a promotion is PROPOSED via memory-journal's governance
 * guard — persisted as PROPOSED, applied only after human/Shield approval.
 *
 * @param {object} opts - { baseDir, patternId, signals, evidence, now, json, log }
 * @returns {{patternId:string, reward:number, previous:object, next:object, promotion:object|null}}
 */
function runReinforce(opts = {}) {
  return store.withMemoryLock(opts.baseDir || process.cwd(), () => reinforceUnderLock(opts));
}

function reinforceUnderLock(opts = {}) {
  const {
    baseDir = process.cwd(),
    patternId,
    signals = {},
    evidence = [],
    now,
    json = false,
    log = console.log,
  } = opts;

  if (typeof patternId !== 'string' || patternId.trim().length === 0) {
    throw new TypeError(
      'mem reinforce: --pattern <id> is required (the pattern heading in patterns.md)'
    );
  }

  const reward = mj.computeReward(signals);
  const scores = readScores(baseDir);
  const previous = scores[patternId] || null;
  const next = mj.updatePatternScore(previous, reward, { ts: now });
  scores[patternId] = next;
  writeScores(baseDir, scores);

  // Governance: promotion is only ever PROPOSED here. appendPromotion() forces
  // status PROPOSED on disk regardless, and applying requires
  // assertPromotionApplicable() to pass with a human/Shield approval.
  let promotion = null;
  if (next.mean >= PROMOTION_MEAN_THRESHOLD && next.updates >= PROMOTION_MIN_UPDATES) {
    promotion = mj.appendPromotion(
      baseDir,
      mj.proposePromotion({
        patternId,
        ts: now,
        reason: `posterior mean ${next.mean.toFixed(3)} >= ${PROMOTION_MEAN_THRESHOLD} over ${next.updates} update(s)`,
        evidence,
        score: next,
      })
    );
  }

  const result = {
    patternId,
    reward,
    previous,
    next,
    promotion,
    evidenceStatus: 'self-reported',
    rankingEligible: false,
  };

  if (json) {
    log(JSON.stringify(result, null, 2));
    return result;
  }

  const prevElo = previous ? previous.elo : mj.INITIAL_PATTERN_SCORE.elo;
  log(`mem reinforce: pattern "${patternId}"`);
  log(`  reward   ${reward.toFixed(3)} (from ${JSON.stringify(signals)})`);
  log(`  elo      ${prevElo.toFixed(1)} -> ${next.elo.toFixed(1)}`);
  log(
    `  mean     ${next.mean.toFixed(3)} (alpha=${next.alpha.toFixed(2)}, beta=${next.beta.toFixed(2)}, updates=${next.updates})`
  );
  if (promotion) {
    log(`  promotion PROPOSED (${promotion.id}): ${promotion.fromStatus} -> ${promotion.toStatus}`);
    log(`  awaiting human/Shield approval — never auto-applied (governance guard)`);
  } else {
    log(
      `  promotion: none proposed (needs mean >= ${PROMOTION_MEAN_THRESHOLD} and >= ${PROMOTION_MIN_UPDATES} updates)`
    );
  }
  return result;
}

// ── Commander wiring ─────────────────────────────────────────────────────────

module.exports = {
  command: 'mem <action> [query...]',
  description: 'Project memory — recall | write | reinforce | observe | outcomes',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['--scope <scope>', 'Recall scope: project | portfolio', 'project'],
    ['--portfolio <path>', 'Portfolio brain directory (used with --scope portfolio)'],
    ['--limit <n>', 'Max recall results', '8'],
    ['--ranking <mode>', 'Recall ranking: lexical | evidence (project only)', 'lexical'],
    ['--context-scope <paths>', 'Comma-separated project paths for evidence recall'],
    ['--input <file>', 'Project-relative JSON outcome observation input (observe)'],
    ['--agent <name>', 'Agent that produced the event (write)'],
    [
      '--cli <name>',
      'Driving CLI: claude-code, gemini-cli, codex-cli, cursor, opencode, aider, antigravity',
    ],
    ['--model <id>', 'Model id used (model-agnostic: claude/gpt/gemini/local)'],
    ['--task <text>', 'What was attempted (write)'],
    ['--outcome <outcome>', 'success | failure | partial | abandoned (write)'],
    ['--pattern <id>', 'Pattern id to reinforce (its heading in patterns.md)'],
    ['--eval <score>', 'Eval suite score in [0,1] (write/reinforce signal)'],
    ['--accept <bool>', 'User acceptance: true | false | [0,1] (write/reinforce signal)'],
    ['--ci <result>', 'CI outcome: pass | fail | [0,1] (write/reinforce signal)'],
    ['--evidence <ids>', 'Comma-separated journal event ids backing a reinforcement'],
    ['--json', 'Machine-readable JSON output'],
  ],
  subcommands: {
    recall: 'Ranked retrieval over the journal + memory files',
    write: 'Append a structured event to .bmad/memory/journal.ndjson',
    reinforce: 'Apply a reward to a pattern score (promotions PROPOSED only)',
    observe: 'Record accepted current Nexus evidence for an exact memory section',
    outcomes: 'Inspect stored outcomes and their current eligibility',
  },

  action: async (action, query, options = {}) => {
    // Clock is read HERE, at call time, then injected everywhere below —
    // memory-journal.js never reads it (see its determinism contract).
    const now = new Date().toISOString();
    const baseDir = path.resolve(options.directory || process.cwd());
    const json = Boolean(options.json);
    const queryText = Array.isArray(query) ? query.join(' ') : query || '';

    try {
      if (action === 'recall') {
        runRecall(queryText, {
          baseDir,
          scope: options.scope || 'project',
          portfolioDir: options.portfolio || null,
          limit: Number(options.limit || 8),
          now,
          json,
          ranking: options.ranking || 'lexical',
          contextScope: options.contextScope
            ? String(options.contextScope)
                .split(',')
                .map((s) => s.trim())
            : undefined,
        });
      } else if (action === 'write') {
        runWrite({
          baseDir,
          agent: options.agent,
          cli: options.cli || null,
          model: options.model || null,
          task: options.task || '',
          outcome: options.outcome,
          signals: parseSignals(options),
          now,
          json,
        });
      } else if (action === 'reinforce') {
        runReinforce({
          baseDir,
          patternId: options.pattern,
          signals: parseSignals(options),
          evidence: options.evidence
            ? String(options.evidence)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          now,
          json,
        });
      } else if (action === 'observe') {
        const input = JSON.parse(store.readText(baseDir, options.input));
        const written = outcomes.observeOutcome(baseDir, input, { now });
        console.log(
          json
            ? JSON.stringify({ written }, null, 2)
            : `mem observe: ${written.id} recorded; lesson causality remains unmeasured.`
        );
      } else if (action === 'outcomes') {
        const results = outcomes.inspectOutcomes(baseDir);
        console.log(
          json
            ? JSON.stringify({ count: results.length, results }, null, 2)
            : results
                .map(
                  (record) =>
                    `${record.id}: ${record.eligible ? 'accepted-current' : record.reason}`
                )
                .join('\n') || 'mem outcomes: no observations.'
        );
      } else {
        console.error(
          `mem: unknown action '${action}' — expected recall | write | reinforce | observe | outcomes`
        );
        process.exitCode = 1;
      }
    } catch (err) {
      if (json) console.log(JSON.stringify({ error: err.message }));
      else console.error(`mem ${action}: ${err.message}`);
      process.exitCode = 1;
    }
  },

  // Exported for tests + future MCP wrapper (memory.recall / memory.write tools)
  _internal: {
    runRecall,
    runWrite,
    runReinforce,
    parseSignals,
    readScores,
    writeScores,
    SCORES_RELPATH,
    PROMOTION_MEAN_THRESHOLD,
    PROMOTION_MIN_UPDATES,
  },
};
