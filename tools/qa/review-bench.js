#!/usr/bin/env node
/**
 * Review bench: small repositories with planted defects and decoys, a published matching
 * rule, and a scorer for recorded review answers.
 *
 * A reviewer (a host agent following the code-review workflow, or any tool whose output is
 * converted to `bmad-plus/review-findings/1`) reviews each built case; its findings are
 * collected in a run file and scored here. A finding matches a planted defect by path,
 * accepted category and the overlap of its located quote with the defect's located quote —
 * never by a line number (docs/specs/review-bench.md). The bench makes no model call:
 * scoring recorded answers is deterministic, so CI replays the reference runs.
 *
 *   node tools/qa/review-bench.js check [--corpus dir]
 *   node tools/qa/review-bench.js build --out dir [--case id] [--corpus dir]
 *   node tools/qa/review-bench.js score run.json [--corpus dir] [--json]
 *
 * Exit: 0 ok · 1 check or reference mismatch · 3 invalid input.
 * A maintainer instrument: it stays in the source repository, outside the npm payload.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const review = require('../cli/lib/review');

const CASE_SCHEMA = 'bmad-plus/review-bench-case/1';
const RUN_SCHEMA = 'bmad-plus/review-bench-run/1';
const SCORE_SCHEMA = 'bmad-plus/review-bench-score/1';
const EXPECTED_SCHEMA = 'bmad-plus/review-bench-expected/1';
const MATCH_RULE = 'bmad-plus/review-bench-match/1';
const DEFAULT_CORPUS = path.resolve(__dirname, '../../evals/review-bench');

/**
 * A finding must point at the code it is about: its quote may exceed the plant it overlaps by
 * this many lines of context. Relative, not absolute — in a short file, a cap on the quote alone
 * would let a whole-file quote match every plant in it.
 */
const MAX_CONTEXT_LINES = 3;
const CASE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CASE_KEYS = ['schema', 'id', 'language', 'summary', 'message', 'defects', 'decoys'];
const DEFECT_KEYS = ['id', 'path', 'quote', 'categories', 'severity', 'why'];
const DECOY_KEYS = ['id', 'path', 'quote', 'why'];
const RUN_KEYS = ['schema', 'id', 'reviewer', 'model', 'date', 'corpusSha256', 'cases'];
const ANSWER_KEYS = ['findings', 'usage'];
const USAGE_KEYS = ['inputTokens', 'outputTokens', 'costUsd', 'seconds'];

/** Fixed identity and dates: the same corpus builds the same commits on every machine. */
const IDENTITY = { name: 'BMAD+ Review Bench', email: 'review-bench@bmad-plus.invalid' };
const DATES = { base: '2026-01-01T00:00:00+00:00', head: '2026-01-02T00:00:00+00:00' };

const lf = (text) => text.replace(/\r\n/g, '\n');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
/** JSON with sorted keys: equal values print equally, whichever realm or key order made them. */
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort())
      : v
  );
const unknownKeys = (value, allowed) =>
  Object.keys(value || {}).filter((k) => !allowed.includes(k));

// ── Corpus ────────────────────────────────────────────────────────────────────

/** Every regular file under root, as sorted `/` paths. Links are refused, not followed. */
function listFiles(root, prefix = '') {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error(`${path.join(root, entry.name)}: links are refused`);
    if (entry.isDirectory()) files.push(...listFiles(path.join(root, entry.name), rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files.sort();
}

function readTree(root) {
  return new Map(
    listFiles(root).map((rel) => [rel, lf(fs.readFileSync(path.join(root, rel), 'utf8'))])
  );
}

/** A case: its manifest, the base tree, the changed files, and the tree at head. */
function loadCase(dir) {
  const manifestText = lf(fs.readFileSync(path.join(dir, 'case.json'), 'utf8'));
  const manifest = JSON.parse(manifestText);
  const before = readTree(path.join(dir, 'before'));
  const after = readTree(path.join(dir, 'after'));
  return {
    manifest,
    manifestText,
    dir: path.basename(dir),
    before,
    after,
    head: new Map([...before, ...after]),
  };
}

/** The corpus and its hash; a run declares the hash it answers, so an edited case voids old runs. */
function loadCorpus(root = DEFAULT_CORPUS) {
  const casesDir = path.join(root, 'cases');
  if (!fs.existsSync(casesDir)) throw new Error(`no cases directory in ${root}`);
  const cases = fs
    .readdirSync(casesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => loadCase(path.join(casesDir, name)));
  const hash = crypto.createHash('sha256');
  for (const benchCase of cases) {
    hash.update(`case\0${benchCase.dir}\0${benchCase.manifestText}\0`);
    for (const side of ['before', 'after'])
      for (const [rel, text] of benchCase[side]) hash.update(`${side}/${rel}\0${text}\0`);
  }
  return { root, cases, sha256: hash.digest('hex') };
}

/** Where a quote sits in a text: the unique located span, or why there is none. */
function place(text, quote) {
  if (text === undefined) return { status: 'unlocated', reason: 'no such file at head' };
  const hits = review.locate(text, quote);
  if (hits.length === 1) return { status: 'located', ...hits[0] };
  if (hits.length > 1) return { status: 'ambiguous', candidates: hits.length };
  return { status: 'unlocated', reason: 'the quoted code is not in the file' };
}

const overlaps = (a, b) => a.lineStart <= b.lineEnd && b.lineStart <= a.lineEnd;

/** Defects and decoys with their spans; only meaningful on a corpus that validates. */
function targets(benchCase) {
  const withSpan = (kind) =>
    (benchCase.manifest[kind] || []).map((target) => ({
      ...target,
      span: place(benchCase.head.get(target.path), target.quote),
    }));
  return { defects: withSpan('defects'), decoys: withSpan('decoys') };
}

/**
 * Every case must be buildable and unambiguous to score: a planted target sits in a changed
 * file, its quote is found exactly once, and no two targets share a line.
 */
function validateCorpus(corpus) {
  const errors = corpus.cases.length ? [] : ['the corpus has no case'];
  const ids = new Set();
  for (const benchCase of corpus.cases) {
    const { manifest } = benchCase;
    const at = `case ${benchCase.dir}`;
    if (manifest.schema !== CASE_SCHEMA) errors.push(`${at}: schema must be "${CASE_SCHEMA}"`);
    if (manifest.id !== benchCase.dir || !CASE_ID.test(benchCase.dir))
      errors.push(`${at}: id must equal the directory name (lowercase, digits, dashes)`);
    for (const key of unknownKeys(manifest, CASE_KEYS)) errors.push(`${at}: unknown key "${key}"`);
    for (const key of ['language', 'summary', 'message'])
      if (typeof manifest[key] !== 'string' || !manifest[key].trim())
        errors.push(`${at}: ${key} is required`);
    if (!benchCase.before.size)
      errors.push(`${at}: before/ is empty — the base commit needs a file`);
    if (!benchCase.after.size) errors.push(`${at}: after/ is empty — there is no change to review`);
    for (const kind of ['defects', 'decoys'])
      if (!Array.isArray(manifest[kind])) errors.push(`${at}: ${kind} must be a list`);
    if (!Array.isArray(manifest.defects) || !Array.isArray(manifest.decoys)) continue;
    if (!manifest.defects.length && !manifest.decoys.length)
      errors.push(`${at}: a case plants at least one defect or decoy`);

    const planted = targets(benchCase);
    for (const [kind, keys] of [
      ['defects', DEFECT_KEYS],
      ['decoys', DECOY_KEYS],
    ]) {
      for (const [index, target] of planted[kind].entries()) {
        const where = `${at}: ${target.id || `${kind} entry`}`;
        for (const key of unknownKeys(manifest[kind][index], keys))
          errors.push(`${where}: unknown key "${key}"`);
        if (typeof target.id !== 'string' || !target.id.startsWith(`${benchCase.dir}/`))
          errors.push(`${where}: id must start with "${benchCase.dir}/"`);
        else if (ids.has(target.id)) errors.push(`${where}: duplicated id`);
        ids.add(target.id);
        if (typeof target.why !== 'string' || !target.why.trim())
          errors.push(`${where}: why is required — the documentation of the plant`);
        if (typeof target.quote !== 'string' || !target.quote.trim()) {
          errors.push(`${where}: quote is required`);
          continue;
        }
        if (!benchCase.after.has(target.path))
          errors.push(
            `${where}: ${target.path} is not a changed file, so no review scope holds it`
          );
        else if (target.span.status !== 'located')
          errors.push(
            `${where}: quote is ${target.span.status} in ${target.path} — it must occur exactly once`
          );
        if (kind === 'defects') {
          const categories = Array.isArray(target.categories) ? target.categories : [];
          if (!categories.length || categories.some((c) => !review.CATEGORIES.includes(c)))
            errors.push(
              `${where}: categories must be a non-empty list of ${review.CATEGORIES.join('|')}`
            );
          if (!review.SEVERITIES.includes(target.severity))
            errors.push(`${where}: severity must be one of ${review.SEVERITIES.join('|')}`);
        }
      }
    }
    const located = [...planted.defects, ...planted.decoys].filter(
      (t) => t.span.status === 'located'
    );
    for (let i = 0; i < located.length; i++)
      for (let j = i + 1; j < located.length; j++)
        if (located[i].path === located[j].path && overlaps(located[i].span, located[j].span))
          errors.push(
            `${at}: ${located[i].id} and ${located[j].id} share a line — a finding could not be told apart`
          );
  }
  return errors;
}

// ── Building the case repositories ────────────────────────────────────────────

/** The caller's git configuration and GIT_* variables never reach the build. */
function isolatedEnv(date) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))
  );
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  };
}

function gitIn(cwd, args, date = DATES.base) {
  const result = spawnSync(
    'git',
    [
      '-c',
      `user.name=${IDENTITY.name}`,
      '-c',
      `user.email=${IDENTITY.email}`,
      '-c',
      'core.autocrlf=false',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, env: isolatedEnv(date), encoding: 'utf8', windowsHide: true, shell: false }
  );
  if (result.error) throw new Error(`git is unavailable: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`git ${args[0]} failed: ${(result.stderr || '').trim()}`);
  return result.stdout.trim();
}

function writeTree(root, tree) {
  for (const [rel, text] of tree) {
    const file = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

/**
 * A case as a git repository: a base commit, then the change under review on `main`. The
 * manifest never enters the repository — the reviewer sees code, not the answer.
 */
function buildCase(benchCase, target) {
  if (fs.existsSync(target) && fs.readdirSync(target).length)
    throw new Error(`${target} is not empty — the bench never builds over existing files`);
  fs.mkdirSync(target, { recursive: true });
  gitIn(target, ['init', '-q', '-b', 'main', '--template=']);
  writeTree(target, benchCase.before);
  gitIn(target, ['add', '-A']);
  gitIn(target, ['commit', '-q', '-m', 'Base'], DATES.base);
  writeTree(target, benchCase.after);
  gitIn(target, ['add', '-A']);
  gitIn(target, ['commit', '-q', '-m', benchCase.manifest.message], DATES.head);
  return {
    id: benchCase.dir,
    path: target,
    base: gitIn(target, ['rev-parse', 'HEAD~1']),
    head: gitIn(target, ['rev-parse', 'HEAD']),
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/** A run is refused whole when any part is invalid: a partial score would mislead. */
function validateRun(run, corpus) {
  const errors = [];
  if (!run || run.schema !== RUN_SCHEMA) return [`schema must be "${RUN_SCHEMA}"`];
  for (const key of unknownKeys(run, RUN_KEYS)) errors.push(`unknown key "${key}"`);
  if (typeof run.id !== 'string' || !run.id.trim()) errors.push('id is required');
  if (typeof run.reviewer !== 'string' || !run.reviewer.trim())
    errors.push('reviewer is required — who or what produced the findings');
  if (run.corpusSha256 !== corpus.sha256)
    errors.push(
      `corpusSha256 does not match the corpus (${corpus.sha256}) — the run answers another version`
    );
  if (!run.cases || typeof run.cases !== 'object' || Array.isArray(run.cases))
    return [...errors, 'cases must be an object keyed by case id'];
  const known = new Set(corpus.cases.map((c) => c.dir));
  for (const [id, answer] of Object.entries(run.cases)) {
    if (!known.has(id)) {
      errors.push(`${id}: no such case in the corpus`);
      continue;
    }
    for (const key of unknownKeys(answer, ANSWER_KEYS)) errors.push(`${id}: unknown key "${key}"`);
    if (!Array.isArray(answer && answer.findings)) {
      errors.push(`${id}: findings must be a list — an empty list when nothing was found`);
      continue;
    }
    const doc = { schema: review.FINDINGS_SCHEMA, findings: answer.findings };
    for (const error of review.validateFindings(doc, null)) errors.push(`${id}: ${error}`);
    const usage = answer.usage;
    if (usage === undefined) continue;
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      errors.push(`${id}: usage must be an object`);
      continue;
    }
    for (const [key, value] of Object.entries(usage)) {
      if (!USAGE_KEYS.includes(key)) errors.push(`${id}: unknown usage key "${key}"`);
      else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        errors.push(`${id}: usage.${key} must be a non-negative number`);
    }
  }
  return errors;
}

const lineCount = (span) => span.lineEnd - span.lineStart + 1;

/**
 * The plant a located finding points at: the only one on its path its lines overlap, quoted
 * with at most MAX_CONTEXT_LINES more lines than the plant. `none` when it overlaps nothing,
 * `broad` when it overlaps several plants or buries the one it overlaps in surrounding code.
 */
function aim(finding, location, planted) {
  const overlapped = [...planted.defects, ...planted.decoys].filter(
    (target) => target.path === finding.path && overlaps(target.span, location)
  );
  if (!overlapped.length) return { none: true };
  const [target] = overlapped;
  if (overlapped.length > 1 || lineCount(location) > lineCount(target.span) + MAX_CONTEXT_LINES)
    return { broad: true };
  return { target };
}

/**
 * One finding against the planted targets: a defect of an accepted category not matched yet
 * (match) or already matched (duplicate), a defect of another category, a decoy, nothing.
 */
function classify(finding, location, planted, matched) {
  if (location.status !== 'located') return { verdict: 'unlocated' };
  const { target, broad } = aim(finding, location, planted);
  if (broad) return { verdict: 'too-broad' };
  if (!target) return { verdict: 'false-positive' };
  if (planted.decoys.includes(target)) return { verdict: 'decoy', target: target.id };
  if (!target.categories.includes(finding.category))
    return { verdict: 'category-mismatch', target: target.id };
  return { verdict: matched.has(target.id) ? 'duplicate' : 'match', target: target.id };
}

const FALSE_POSITIVE_VERDICTS = ['false-positive', 'decoy', 'category-mismatch', 'too-broad'];

function scoreCase(benchCase, answer) {
  const planted = targets(benchCase);
  const matched = new Set();
  const refutedTargets = new Set();
  const findings = [];
  for (const finding of (answer && answer.findings) || []) {
    const location = place(benchCase.head.get(finding.path), finding.existing_code);
    const entry = { id: finding.id, path: finding.path, location: location.status };
    if (location.status === 'located')
      Object.assign(entry, { lineStart: location.lineStart, lineEnd: location.lineEnd });
    if (finding.disposition === 'refuted') {
      // A withdrawn finding is not scored, but a planted defect the reviewer argued away is worth knowing.
      const { target } =
        location.status === 'located' ? aim(finding, location, planted) : { target: undefined };
      if (target) refutedTargets.add(target.id);
      findings.push({ ...entry, verdict: 'refuted', ...(target ? { target: target.id } : {}) });
      continue;
    }
    const result = classify(finding, location, planted, matched);
    if (result.verdict === 'match') matched.add(result.target);
    findings.push({ ...entry, ...result });
  }
  const count = (...verdicts) => findings.filter((f) => verdicts.includes(f.verdict)).length;
  const missed = planted.defects.filter((d) => !matched.has(d.id)).map((d) => d.id);
  const dismissed = missed.filter((id) => refutedTargets.has(id));
  const flagged = [...new Set(findings.filter((f) => f.verdict === 'decoy').map((f) => f.target))];
  const refutedDecoys = planted.decoys.filter((d) => refutedTargets.has(d.id)).map((d) => d.id);
  return {
    id: benchCase.dir,
    answered: Boolean(answer),
    matchedDefects: planted.defects.filter((d) => matched.has(d.id)).map((d) => d.id),
    missedDefects: missed,
    dismissedDefects: dismissed,
    flaggedDecoys: flagged.sort(),
    refutedDecoys,
    counts: {
      defects: planted.defects.length,
      decoys: planted.decoys.length,
      matched: matched.size,
      missed: missed.length,
      dismissed: dismissed.length,
      findings: findings.length - count('refuted'),
      duplicates: count('duplicate'),
      falsePositives: count(...FALSE_POSITIVE_VERDICTS),
      decoyHits: count('decoy'),
      decoysFlagged: flagged.length,
      categoryMismatches: count('category-mismatch'),
      tooBroad: count('too-broad'),
      unlocated: count('unlocated'),
      refuted: count('refuted'),
      decoysRefuted: refutedDecoys.length,
    },
    findings,
    usage: (answer && answer.usage) || null,
  };
}

const rate = (numerator, denominator) =>
  denominator ? Math.round((numerator / denominator) * 1000) / 1000 : null;

/** Usage is reported, never estimated: a column is null unless every answered case reports it. */
function usageTotals(answered) {
  const totals = { casesReporting: answered.filter((c) => c.usage).length };
  for (const key of USAGE_KEYS) {
    const values = answered.map((c) => c.usage && c.usage[key]);
    totals[key] =
      answered.length && values.every((v) => typeof v === 'number')
        ? Math.round(values.reduce((sum, v) => sum + v, 0) * 1e6) / 1e6
        : null;
  }
  return totals;
}

function scoreRun(run, corpus) {
  const errors = validateRun(run, corpus);
  if (errors.length) {
    const error = new Error(
      `invalid run: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`
    );
    error.errors = errors;
    throw error;
  }
  const cases = corpus.cases.map((benchCase) => scoreCase(benchCase, run.cases[benchCase.dir]));
  const totals = {};
  for (const key of Object.keys(cases[0] ? cases[0].counts : {}))
    totals[key] = cases.reduce((sum, c) => sum + c.counts[key], 0);
  // Every match is one open finding on one defect, so matched is also the true-positive count.
  totals.recall = rate(totals.matched, totals.defects);
  totals.precision = rate(totals.matched, totals.findings);
  totals.f1 = rate(2 * totals.matched, totals.defects + totals.findings);
  const answered = cases.filter((c) => c.answered);
  totals.answeredCases = answered.length;
  totals.missingCases = cases.filter((c) => !c.answered).map((c) => c.id);
  totals.usage = usageTotals(answered);
  totals.costPerMatchedDefect =
    totals.usage.costUsd !== null && totals.matched
      ? Math.round((totals.usage.costUsd / totals.matched) * 1e6) / 1e6
      : null;
  return {
    schema: SCORE_SCHEMA,
    rule: MATCH_RULE,
    maxContextLines: MAX_CONTEXT_LINES,
    corpus: { sha256: corpus.sha256, cases: corpus.cases.length },
    run: { id: run.id, reviewer: run.reviewer, ...(run.model ? { model: run.model } : {}) },
    totals,
    cases,
  };
}

/** Reference runs with the totals they must score; a difference is a scorer or corpus change. */
function checkReferences(corpus) {
  const file = path.join(corpus.root, 'runs', 'expected.json');
  const expected = readJson(file);
  if (expected.schema !== EXPECTED_SCHEMA)
    throw new Error(`${file}: schema must be "${EXPECTED_SCHEMA}"`);
  const results = [];
  for (const [name, want] of Object.entries(expected.runs || {})) {
    const score = scoreRun(readJson(path.join(corpus.root, 'runs', name)), corpus);
    const differences = Object.keys(want)
      .filter((key) => canonical(score.totals[key]) !== canonical(want[key]))
      .map(
        (key) =>
          `${key}: expected ${JSON.stringify(want[key])}, got ${JSON.stringify(score.totals[key])}`
      );
    results.push({ run: name, differences });
  }
  if (!results.length) throw new Error(`${file} lists no reference run`);
  return results;
}

// ── Command line ──────────────────────────────────────────────────────────────

const shown = (value) => (value === null ? '—' : String(value));

function printScore(score) {
  const t = score.totals;
  console.log(
    `run ${score.run.id} (${score.run.reviewer}) on corpus ${score.corpus.sha256.slice(0, 12)}`
  );
  console.log('case                     defects  matched  findings  FP  decoy  unlocated');
  for (const c of score.cases)
    console.log(
      `${c.id.padEnd(24)} ${String(c.counts.defects).padStart(7)} ${String(c.counts.matched).padStart(8)} ${String(c.counts.findings).padStart(9)} ${String(c.counts.falsePositives).padStart(3)} ${String(c.counts.decoyHits).padStart(6)} ${String(c.counts.unlocated).padStart(10)}${c.answered ? '' : '  (not answered)'}`
    );
  console.log(
    `recall ${shown(t.recall)} · precision ${shown(t.precision)} · F1 ${shown(t.f1)} · ${t.duplicates} duplicate(s), ${t.decoysFlagged}/${t.decoys} decoy(s) flagged, ${t.dismissed} defect(s) refuted away`
  );
  console.log(
    `usage: ${shown(t.usage.inputTokens)} in / ${shown(t.usage.outputTokens)} out tokens, cost ${shown(t.usage.costUsd)} USD, ${shown(t.usage.seconds)} s, per matched defect ${shown(t.costPerMatchedDefect)} USD (${t.usage.casesReporting}/${t.answeredCases} case(s) reported usage)`
  );
}

function main(argv) {
  const [action, target] = argv;
  const option = (name) => {
    const index = argv.indexOf(name);
    return index < 0 ? undefined : argv[index + 1];
  };
  const corpus = loadCorpus(path.resolve(option('--corpus') || DEFAULT_CORPUS));

  if (action === 'check') {
    const errors = validateCorpus(corpus);
    for (const error of errors) console.error(`  - ${error}`);
    if (errors.length) return 1;
    const references = checkReferences(corpus);
    for (const { run, differences } of references) {
      console.log(`${differences.length ? 'FAIL' : 'ok  '} ${run}`);
      for (const difference of differences) console.log(`       ${difference}`);
    }
    console.log(`corpus ${corpus.sha256} — ${corpus.cases.length} case(s)`);
    return references.some((r) => r.differences.length) ? 1 : 0;
  }

  if (action === 'build') {
    const out = option('--out');
    if (!out) throw new Error('build needs --out <dir>');
    const only = option('--case');
    const chosen = corpus.cases.filter((c) => !only || c.dir === only);
    if (!chosen.length) throw new Error(`no case "${only}"`);
    const errors = validateCorpus(corpus);
    if (errors.length) throw new Error(`the corpus is invalid: ${errors[0]}`);
    const built = chosen.map((c) => buildCase(c, path.resolve(out, c.dir)));
    console.log(JSON.stringify({ corpusSha256: corpus.sha256, cases: built }, null, 2));
    return 0;
  }

  if (action === 'score') {
    if (!target || target.startsWith('--')) throw new Error('score needs a run file');
    const score = scoreRun(readJson(path.resolve(target)), corpus);
    if (argv.includes('--json')) console.log(JSON.stringify(score, null, 2));
    else printScore(score);
    return 0;
  }

  throw new Error(`unknown action "${action}" (check, build, score)`);
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`review-bench: ${error.message}`);
    for (const detail of (error.errors || []).slice(1)) console.error(`  - ${detail}`);
    process.exitCode = 3;
  }
}

module.exports = {
  CASE_SCHEMA,
  RUN_SCHEMA,
  SCORE_SCHEMA,
  MATCH_RULE,
  MAX_CONTEXT_LINES,
  IDENTITY,
  DATES,
  DEFAULT_CORPUS,
  loadCorpus,
  validateCorpus,
  buildCase,
  validateRun,
  scoreRun,
  checkReferences,
  main,
};
