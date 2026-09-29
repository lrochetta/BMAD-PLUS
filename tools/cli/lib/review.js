/**
 * Code review evidence: a sealed scope, findings anchored on quoted code, and a gate that
 * derives the verdict from coverage — never from how many findings were written.
 *
 * The host agent reviews; this module only establishes what must be reviewed, where each
 * finding really is, which checklists apply, and whether every selected file was accounted
 * for. Written for BMAD+ after studying open-code-review (docs/research/open-code-review-2026-09-25)
 * for ideas only. No model call, no network, no write outside the review folder.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { matchesAny } = require('./glob');
const { redact, redactFields } = require('./redact');
const rules = require('./review-rules');

const SCOPE_SCHEMA = 'bmad-plus/review-scope/1';
const FINDINGS_SCHEMA = 'bmad-plus/review-findings/1';
const COVERAGE_SCHEMA = 'bmad-plus/review-coverage/1';
const DEFAULT_DIR = '_bmad-output/review';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const CATEGORIES = [
  'correctness',
  'security',
  'data-loss',
  'concurrency',
  'performance',
  'error-handling',
  'compatibility',
  'test-gap',
  'maintainability',
  'documentation',
];
const DISPOSITIONS = ['confirmed', 'refuted', 'unresolved'];
const CONFIDENCE = ['high', 'medium', 'low'];
const OUTCOMES = ['completed', 'failed', 'waived'];

/**
 * Why a review session ended. Only `completed` lets the gate reach a verdict; every other
 * reason keeps it incomplete, whatever the coverage says.
 */
const STOP_REASONS = ['completed', 'budget', 'time-limit', 'failure-streak', 'interrupted'];
const ATTEMPT_OUTCOMES = ['completed', 'failed'];
/** Consecutive failed attempts after which a unit is abandoned rather than retried again. */
const STRIKES = 3;
const RUN_KEYS = ['stop', 'detail', 'passes', 'attempts', 'tokens', 'durationMs'];
const ATTEMPT_KEYS = ['unit', 'group', 'outcome', 'reason'];

/** Files whose content must never reach a review packet, whatever an include pattern says. */
const SECRET_PATTERNS = [
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/id_rsa*',
  '**/id_ed25519*',
  '**/.credentials/**',
  '**/credentials/**',
  '**/secrets/**',
  '**/*.keystore',
  '**/.npmrc',
  '**/.netrc',
];
const GENERATED_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/vendor/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/Cargo.lock',
  '**/go.sum',
  '**/poetry.lock',
];
const UNIT_LIMITS = { files: 8, lines: 400 };

/**
 * How much reviewing a change deserves. A pass is a complete read of the scope; later
 * passes look for what the earlier ones missed and stop early when a pass adds nothing.
 */
const EFFORTS = {
  low: { passes: 1, refute: false },
  medium: { passes: 2, refute: true },
  high: { passes: 3, refute: true },
};
const CHURN = { plan: 150, split: 400 };

/** The reviewing plan follows the effort chosen and the measured size of the change. */
function reviewPlan(effort, lines, units) {
  const { passes, refute } = EFFORTS[effort];
  return {
    effort,
    passes,
    refute,
    planFirst: lines >= CHURN.plan,
    parallelUnits: units > 1 && lines >= CHURN.split,
  };
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function git(projectDir, args) {
  const result = spawnSync('git', args, {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  if (result.error) throw new Error(`git is unavailable: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`git ${args[0]} failed: ${(result.stderr || '').trim().split('\n')[0]}`);
  return result.stdout;
}

/** A ref given on the command line is resolved to a commit or refused; it never reaches git as an option. */
function resolveCommit(projectDir, ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-'))
    throw new Error(`invalid ref "${ref}"`);
  return git(projectDir, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
}

/** `git diff --numstat -z` entries: {path, oldPath?, added, removed, binary}. */
function parseNumstat(output) {
  const parts = output.split('\0');
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const head = parts[i];
    if (!head) continue;
    const match = /^(-|\d+)\t(-|\d+)\t(.*)$/.exec(head);
    if (!match) continue;
    const [, added, removed, rest] = match;
    const binary = added === '-' || removed === '-';
    if (rest === '') {
      // Rename or copy: old path and new path follow as separate fields.
      const oldPath = parts[++i];
      const newPath = parts[++i];
      entries.push({ path: newPath, oldPath, added: +added || 0, removed: +removed || 0, binary });
    } else {
      entries.push({ path: rest, added: +added || 0, removed: +removed || 0, binary });
    }
  }
  return entries;
}

function nameStatus(output) {
  const parts = output.split('\0');
  const status = new Map();
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i];
    if (!code) continue;
    const kind = code[0];
    if (kind === 'R' || kind === 'C') {
      i += 2;
      status.set(parts[i], kind === 'R' ? 'renamed' : 'copied');
    } else {
      i += 1;
      status.set(
        parts[i],
        { A: 'added', D: 'deleted', M: 'modified', T: 'modified' }[kind] || 'modified'
      );
    }
  }
  return status;
}

/** Deterministic review units: files grouped by directory, cut at the file and line limits, in path order. */
function planUnits(selected, limits = UNIT_LIMITS) {
  const units = [];
  let current = null;
  const flush = () => {
    if (current && current.paths.length) units.push(current);
    current = null;
  };
  for (const item of selected) {
    const dir = path.posix.dirname(item.path);
    const lines = item.added + item.removed;
    if (
      !current ||
      current.dir !== dir ||
      current.paths.length >= limits.files ||
      (current.lines + lines > limits.lines && current.paths.length > 0)
    ) {
      flush();
      current = { dir, paths: [], lines: 0 };
    }
    current.paths.push(item.path);
    current.lines += lines;
  }
  flush();
  return units.map((unit, index) => ({
    id: `u${index + 1}`,
    paths: unit.paths,
    lines: unit.lines,
  }));
}

function contentDigest(projectDir, file) {
  try {
    return sha256(fs.readFileSync(path.join(projectDir, file)));
  } catch {
    return null;
  }
}

/**
 * The review scope: what changed between base and head (or the working tree), which files
 * are selected, and why every other changed file is not. Secrets are excluded before any
 * include pattern is considered.
 */
function buildScope(projectDir, options = {}) {
  const head = options.workspace ? null : resolveCommit(projectDir, options.head || 'HEAD');
  const base = resolveCommit(projectDir, options.base || 'HEAD~1');
  const mergeBase = git(projectDir, ['merge-base', base, head || 'HEAD']).trim();
  const range = options.workspace ? [mergeBase] : [mergeBase, head];
  const numstat = parseNumstat(
    git(projectDir, ['diff', '--numstat', '-z', '--find-renames', ...range, '--'])
  );
  const statuses = nameStatus(
    git(projectDir, ['diff', '--name-status', '-z', '--find-renames', ...range, '--'])
  );
  const changed = numstat.map((entry) => ({
    ...entry,
    status: statuses.get(entry.path) || 'modified',
  }));
  if (options.workspace) {
    const untracked = git(projectDir, ['ls-files', '--others', '--exclude-standard', '-z'])
      .split('\0')
      .filter(Boolean);
    for (const file of untracked) {
      if (changed.some((entry) => entry.path === file)) continue;
      let lines = 0;
      let binary;
      try {
        const bytes = fs.readFileSync(path.join(projectDir, file));
        binary = bytes.includes(0);
        lines = binary ? 0 : bytes.toString('utf8').split('\n').length;
      } catch {
        binary = true;
      }
      changed.push({ path: file, added: lines, removed: 0, binary, status: 'added' });
    }
  }
  changed.sort((a, b) => a.path.localeCompare(b.path));
  // The review's own evidence is not part of the change under review: writing findings must
  // never alter the scope they answer.
  const evidenceDir = path
    .relative(projectDir, path.resolve(projectDir, options.outputDir || DEFAULT_DIR))
    .split(path.sep)
    .join('/');
  const ownEvidence = (file) =>
    evidenceDir !== '' &&
    !evidenceDir.startsWith('..') &&
    !path.isAbsolute(evidenceDir) &&
    (file === evidenceDir || file.startsWith(`${evidenceDir}/`));
  const candidates = changed.filter((entry) => !ownEvidence(entry.path));

  const include = options.include || [];
  const exclude = options.exclude || [];
  const selected = [];
  const excluded = [];
  for (const entry of candidates) {
    const file = entry.path;
    let reason = null;
    if (matchesAny(file, SECRET_PATTERNS)) reason = 'secret';
    else if (entry.binary) reason = 'binary';
    else if (entry.status === 'deleted') reason = 'deleted';
    else if (matchesAny(file, exclude)) reason = 'excluded-by-pattern';
    else if (matchesAny(file, GENERATED_PATTERNS) && !matchesAny(file, include))
      reason = 'generated-or-vendored';
    else if (include.length && !matchesAny(file, include)) reason = 'not-included';
    if (reason) excluded.push({ path: file, reason, status: entry.status });
    else
      selected.push({
        path: file,
        status: entry.status,
        added: entry.added,
        removed: entry.removed,
        ...(entry.oldPath ? { oldPath: entry.oldPath } : {}),
      });
  }
  const effort = options.effort || 'medium';
  if (!EFFORTS[effort]) throw new Error(`effort must be one of ${Object.keys(EFFORTS).join('|')}`);
  const ruleset = options.ruleset || rules.loadRuleset(projectDir);
  for (const item of selected) {
    item.rules = rules.rulesFor(ruleset, item.path);
    // Kept only when a rule names controls, so a scope without any keeps its digest.
    const controls = rules.controlsOf(ruleset, item.rules).map(({ id }) => id);
    if (controls.length) item.controls = controls;
    // A commit fixes the content under review; a working tree does not, so its bytes are sealed.
    if (options.workspace) item.sha256 = contentDigest(projectDir, item.path);
  }
  const identity = {
    base,
    head: head || 'WORKTREE',
    // The ref as given, so a continuation can tell whether it still names the reviewed commit.
    headRef: options.workspace ? null : options.head || 'HEAD',
    mergeBase,
    workspace: Boolean(options.workspace),
    include,
    exclude,
    effort,
    rulesSha256: ruleset.sha256,
  };
  const units = planUnits(selected, options.unitLimits).map((unit) => {
    const ids = [...new Set(unit.paths.flatMap((p) => selected.find((s) => s.path === p).rules))];
    const controls = rules.controlsOf(ruleset, ids).map(({ id }) => id);
    // Rule groups let parallel reviewers split one unit by rule family.
    return {
      ...unit,
      rules: ids,
      groups: rules.groupsOf(ruleset, ids),
      ...(controls.length ? { controls } : {}),
    };
  });
  const lines = selected.reduce((n, item) => n + item.added + item.removed, 0);
  const plan = reviewPlan(effort, lines, units.length);
  const body = { identity, selected, excluded, units, plan };
  return {
    schema: SCOPE_SCHEMA,
    id: options.id,
    ...body,
    totals: {
      changed: candidates.length,
      selected: selected.length,
      excluded: excluded.length,
      lines,
    },
    sha256: sha256(JSON.stringify(body)),
  };
}

// ── Findings ──────────────────────────────────────────────────────────────────

const FINDING_KEYS = [
  'id',
  'path',
  'existing_code',
  'content',
  'category',
  'severity',
  'confidence',
  'disposition',
  'trigger',
  'consequence',
  'evidence',
  'refutation',
  'fix',
  'rule',
  'controls',
];

/** Unknown values are errors, never coerced: a wrong enum is a wrong finding. */
function validateFindings(doc, scope) {
  const errors = [];
  if (!doc || doc.schema !== FINDINGS_SCHEMA) errors.push(`schema must be "${FINDINGS_SCHEMA}"`);
  if (scope && doc && doc.scopeSha256 !== scope.sha256)
    errors.push(
      'scopeSha256 does not match the current scope — the findings answer another review'
    );
  const ids = new Set();
  for (const [index, finding] of ((doc && doc.findings) || []).entries()) {
    const at = `finding ${finding?.id ?? index}`;
    for (const key of Object.keys(finding || {}))
      if (!FINDING_KEYS.includes(key)) errors.push(`${at}: unknown key "${key}"`);
    if (!finding.id || ids.has(finding.id)) errors.push(`${at}: id missing or duplicated`);
    ids.add(finding.id);
    if (typeof finding.path !== 'string' || !finding.path) errors.push(`${at}: path is required`);
    if (typeof finding.existing_code !== 'string' || !finding.existing_code.trim())
      errors.push(
        `${at}: existing_code is required — quote the code the finding is about, verbatim`
      );
    if (typeof finding.content !== 'string' || !finding.content.trim())
      errors.push(`${at}: content is required`);
    if (!CATEGORIES.includes(finding.category))
      errors.push(`${at}: category "${finding.category}" is not one of ${CATEGORIES.join('|')}`);
    if (!SEVERITIES.includes(finding.severity))
      errors.push(`${at}: severity "${finding.severity}" is not one of ${SEVERITIES.join('|')}`);
    if (!CONFIDENCE.includes(finding.confidence))
      errors.push(
        `${at}: confidence "${finding.confidence}" is not one of ${CONFIDENCE.join('|')}`
      );
    if (!DISPOSITIONS.includes(finding.disposition))
      errors.push(
        `${at}: disposition "${finding.disposition}" is not one of ${DISPOSITIONS.join('|')}`
      );
    if (finding.disposition === 'refuted' && !String(finding.refutation || '').trim())
      errors.push(`${at}: a refuted finding keeps its refutation — the quoted ground`);
    if (finding.disposition === 'confirmed' && !String(finding.evidence || '').trim())
      errors.push(`${at}: a confirmed finding needs evidence`);
    const entry = scope && scope.selected.find((item) => item.path === finding.path);
    if (scope && finding.path && !entry)
      errors.push(`${at}: ${finding.path} is not in the review scope`);
    // A finding may name the checklist rule that led to it; the rule must apply to that file.
    if (finding.rule !== undefined && entry && !(entry.rules || []).includes(finding.rule))
      errors.push(`${at}: rule "${finding.rule}" does not apply to ${finding.path}`);
    // It may name the controls it breaks: only those the rules for that file examine.
    if (finding.controls !== undefined) {
      if (
        !Array.isArray(finding.controls) ||
        !finding.controls.length ||
        !finding.controls.every((control) => typeof control === 'string')
      )
        errors.push(`${at}: controls must be a non-empty list of control ids`);
      else if (entry)
        for (const control of finding.controls)
          if (!(entry.controls || []).includes(control))
            errors.push(
              `${at}: control "${control}" is not examined by the rules for ${finding.path}`
            );
    }
  }
  return errors;
}

const normalizeLine = (line) => line.replace(/\r$/, '').replace(/\s+/g, ' ').trim();

/**
 * Where a quoted snippet is in a file: every place its lines appear consecutively, compared
 * after whitespace normalisation. The model's line numbers are never used.
 */
function locate(fileText, snippet) {
  const fileLines = fileText.split('\n').map(normalizeLine);
  const wanted = snippet
    .split('\n')
    .map(normalizeLine)
    .filter((line, index, all) => line || (index > 0 && index < all.length - 1));
  while (wanted.length && !wanted[0]) wanted.shift();
  while (wanted.length && !wanted[wanted.length - 1]) wanted.pop();
  if (!wanted.length) return [];
  const hits = [];
  for (let i = 0; i + wanted.length <= fileLines.length; i++) {
    let ok = true;
    for (let j = 0; j < wanted.length; j++) {
      if (fileLines[i + j] !== wanted[j]) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push({ lineStart: i + 1, lineEnd: i + wanted.length });
  }
  return hits;
}

function readAtHead(projectDir, scope, file) {
  if (scope.identity.workspace) return fs.readFileSync(path.join(projectDir, file), 'utf8');
  return git(projectDir, ['show', `${scope.identity.head}:${file}`]);
}

/** Every finding gets a location status: located (unique), ambiguous (several), unlocated (none). */
function anchorFindings(projectDir, scope, doc) {
  const cache = new Map();
  const anchored = doc.findings.map((finding) => {
    let text = cache.get(finding.path);
    if (text === undefined) {
      try {
        text = readAtHead(projectDir, scope, finding.path);
      } catch {
        text = null;
      }
      cache.set(finding.path, text);
    }
    if (text === null)
      return { ...finding, location: { status: 'unlocated', reason: 'file unreadable at head' } };
    const hits = locate(text, finding.existing_code);
    if (hits.length === 1) return { ...finding, location: { status: 'located', ...hits[0] } };
    if (hits.length > 1)
      return { ...finding, location: { status: 'ambiguous', candidates: hits.slice(0, 10) } };
    return {
      ...finding,
      location: { status: 'unlocated', reason: 'the quoted code is not in the file' },
    };
  });
  const counts = { located: 0, ambiguous: 0, unlocated: 0, redactions: 0 };
  for (const finding of anchored) {
    counts[finding.location.status] += 1;
    // Located first, redacted second: the anchor needs the quote, the written record must not carry a secret.
    const redacted = redactFields(finding, REDACTED_FIELDS);
    if (redacted) finding.redactions = redacted;
    counts.redactions += redacted;
  }
  return { findings: anchored, counts };
}

const REDACTED_FIELDS = [
  'existing_code',
  'content',
  'trigger',
  'consequence',
  'evidence',
  'refutation',
  'fix',
];

// ── Coverage and gate ─────────────────────────────────────────────────────────

const isCount = (value) => Number.isInteger(value) && value >= 0;
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** What an attempt worked on: a whole unit (`u2`) or one rule group of it (`u2/data`). */
const attemptKey = (attempt) => (attempt.group ? `${attempt.unit}/${attempt.group}` : attempt.unit);
const unitOfKey = (key) => key.split('/')[0];

/**
 * The three-strikes rule over an ordered attempt log: work whose attempts failed three
 * times in a row is exhausted, and any later attempt of it is a violation. A whole unit
 * and each of its groups overlap: exhausting one blocks the other.
 */
function strikeLedger(attempts) {
  const streak = new Map();
  const exhausted = new Set();
  const violations = [];
  const blocked = (attempt) =>
    exhausted.has(attempt.unit) ||
    (attempt.group
      ? exhausted.has(attemptKey(attempt))
      : [...exhausted].some((key) => unitOfKey(key) === attempt.unit));
  for (const [index, attempt] of attempts.entries()) {
    const key = attemptKey(attempt);
    if (blocked(attempt)) {
      violations.push({ index, unit: key });
      continue;
    }
    const failures = attempt.outcome === 'failed' ? (streak.get(key) || 0) + 1 : 0;
    streak.set(key, failures);
    if (failures >= STRIKES) exhausted.add(key);
  }
  return { exhausted, violations, units: new Set([...exhausted].map(unitOfKey)) };
}

const unitIndex = (scope) =>
  new Map(scope.units.flatMap((unit) => unit.paths.map((file) => [file, unit.id])));

/** Units whose review completed: in one attempt, or in one completed attempt per rule group. */
function completedUnits(scope, attempts) {
  const done = new Set(attempts.filter((a) => a.outcome === 'completed').map(attemptKey));
  return new Set(
    scope.units
      .filter(
        (unit) =>
          done.has(unit.id) ||
          (Array.isArray(unit.groups) &&
            unit.groups.length > 0 &&
            unit.groups.every((group) => done.has(`${unit.id}/${group.id}`)))
      )
      .map((unit) => unit.id)
  );
}

/**
 * The run record of a review: why it stopped, what it observed (passes run, units
 * attempted, and tokens or duration only when the host reports them — never estimated),
 * and the ordered log of unit attempts. When the log is not empty it is the whole story:
 * a file is completed only if an attempt of its unit completed.
 */
function validateRun(run, scope, items) {
  if (!isRecord(run)) return ['run must be an object'];
  const errors = [];
  for (const key of Object.keys(run))
    if (!RUN_KEYS.includes(key)) errors.push(`run: unknown key "${key}"`);
  if (!STOP_REASONS.includes(run.stop))
    errors.push(`run: stop "${run.stop}" is not one of ${STOP_REASONS.join('|')}`);
  if (run.detail !== undefined && typeof run.detail !== 'string')
    errors.push('run: detail is text');
  else if (STOP_REASONS.includes(run.stop) && run.stop !== 'completed' && !run.detail?.trim())
    errors.push(`run: a review stopped by ${run.stop} says why in detail`);
  if (!isCount(run.passes)) errors.push('run: passes is the number of passes actually run');
  else if (run.stop === 'completed' && run.passes < 1)
    errors.push('run: a completed review ran at least one pass');
  for (const key of ['tokens', 'durationMs'])
    if (run[key] !== undefined && !isCount(run[key]))
      errors.push(`run: ${key} is a non-negative integer reported by the host, or absent`);
  if (!Array.isArray(run.attempts)) {
    errors.push('run: attempts lists every unit attempt, in order (empty when none was logged)');
    return errors;
  }
  const units = new Map(scope.units.map((unit) => [unit.id, unit]));
  for (const [index, attempt] of run.attempts.entries()) {
    const at = `run: attempt ${index + 1}`;
    if (!isRecord(attempt)) {
      errors.push(`${at}: must be an object`);
      continue;
    }
    for (const key of Object.keys(attempt))
      if (!ATTEMPT_KEYS.includes(key)) errors.push(`${at}: unknown key "${key}"`);
    const unit = units.get(attempt.unit);
    if (!unit) errors.push(`${at}: unit "${attempt.unit}" is not in the scope`);
    else if (
      attempt.group !== undefined &&
      !(unit.groups || []).some((group) => group.id === attempt.group)
    )
      errors.push(`${at}: group "${attempt.group}" is not a rule group of unit ${unit.id}`);
    if (!ATTEMPT_OUTCOMES.includes(attempt.outcome))
      errors.push(
        `${at}: outcome "${attempt.outcome}" is not one of ${ATTEMPT_OUTCOMES.join('|')}`
      );
    if (attempt.reason !== undefined && typeof attempt.reason !== 'string')
      errors.push(`${at}: reason is text`);
    else if (attempt.outcome === 'failed' && !attempt.reason?.trim())
      errors.push(`${at}: a failed attempt needs a reason`);
  }
  if (errors.length) return errors;

  const { exhausted, violations } = strikeLedger(run.attempts);
  for (const { index, unit } of violations)
    errors.push(
      `run: attempt ${index + 1} retries unit ${unit} after ${STRIKES} consecutive failures — it is abandoned in this review`
    );
  if (run.stop === 'failure-streak' && !exhausted.size)
    errors.push(`run: failure-streak needs a unit with ${STRIKES} consecutive failed attempts`);
  if (run.attempts.length) {
    const unitOf = unitIndex(scope);
    const done = completedUnits(scope, run.attempts);
    for (const item of items)
      if (item.outcome === 'completed' && unitOf.has(item.path) && !done.has(unitOf.get(item.path)))
        errors.push(
          `${item.path}: completed in coverage, but unit ${unitOf.get(item.path)} was not completed — as a whole or in every rule group`
        );
  }
  return errors;
}

/** What the review actually consumed, as reported; null when no run was recorded. */
function observedUsage(scope, run) {
  if (!isRecord(run)) return null;
  const attempts = Array.isArray(run.attempts) ? run.attempts.filter(isRecord) : [];
  return {
    passes: isCount(run.passes) ? run.passes : null,
    plannedPasses: scope.plan ? scope.plan.passes : null,
    units: scope.units.length,
    unitsAttempted: new Set(attempts.map((a) => a.unit)).size,
    attempts: attempts.length,
    failedAttempts: attempts.filter((a) => a.outcome === 'failed').length,
    ...(isCount(run.tokens) ? { tokens: run.tokens } : {}),
    ...(isCount(run.durationMs) ? { durationMs: run.durationMs } : {}),
  };
}

function validateCoverage(doc, scope) {
  const errors = [];
  if (!doc || doc.schema !== COVERAGE_SCHEMA) errors.push(`schema must be "${COVERAGE_SCHEMA}"`);
  if (doc && doc.scopeSha256 !== scope.sha256)
    errors.push('scopeSha256 does not match the current scope');
  const seen = new Set();
  for (const item of (doc && doc.items) || []) {
    if (!scope.selected.some((entry) => entry.path === item.path))
      errors.push(`${item.path}: not in the review scope`);
    if (seen.has(item.path)) errors.push(`${item.path}: listed twice`);
    seen.add(item.path);
    if (!OUTCOMES.includes(item.outcome))
      errors.push(`${item.path}: outcome "${item.outcome}" is not one of ${OUTCOMES.join('|')}`);
    if (
      (item.outcome === 'waived' || item.outcome === 'failed') &&
      !String(item.reason || '').trim()
    )
      errors.push(`${item.path}: a ${item.outcome} file needs a reason`);
  }
  if (doc && doc.run !== undefined) errors.push(...validateRun(doc.run, scope, doc.items || []));
  return errors;
}

/**
 * The review verdict. `incomplete` whenever a selected file was not accounted for, failed,
 * the review stopped before the end, or the evidence is invalid; otherwise `findings` or `clean` — the latter only means no
 * confirmed or unresolved finding within a fully covered scope.
 */
function reviewGate({ scope, findings, coverage, anchored }) {
  const reasons = [];
  if (!coverage) reasons.push('no coverage.json: which files were reviewed is not established');
  else reasons.push(...validateCoverage(coverage, scope));
  if (!findings) reasons.push('no findings.json: write it even when there is nothing to report');
  else reasons.push(...validateFindings(findings, scope));
  const covered = new Map(((coverage && coverage.items) || []).map((item) => [item.path, item]));
  const missing = scope.selected.filter((item) => !covered.has(item.path)).map((item) => item.path);
  const failed = [...covered.values()]
    .filter((item) => item.outcome === 'failed')
    .map((item) => item.path);
  const waived = [...covered.values()]
    .filter((item) => item.outcome === 'waived')
    .map((item) => item.path);
  if (missing.length)
    reasons.push(
      `${missing.length} selected file(s) never accounted for: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
    );
  if (failed.length)
    reasons.push(`${failed.length} file(s) whose review failed: ${failed.slice(0, 5).join(', ')}`);
  const run = coverage && isRecord(coverage.run) ? coverage.run : null;
  // A review that stopped early is never clean, even when every file happens to be listed.
  if (run && STOP_REASONS.includes(run.stop) && run.stop !== 'completed')
    reasons.push(
      `the review stopped before the end (${run.stop}): ${typeof run.detail === 'string' ? run.detail.trim() : ''}`
    );
  if (run && Array.isArray(run.attempts)) {
    const { exhausted } = strikeLedger(run.attempts.filter(isRecord));
    for (const unit of exhausted)
      reasons.push(`unit ${unit} abandoned after ${STRIKES} consecutive failed attempts`);
  }
  const open = ((anchored && anchored.findings) || []).filter((f) => f.disposition !== 'refuted');
  const unlocated = open.filter((f) => f.location.status !== 'located');
  if (unlocated.length)
    reasons.push(
      `${unlocated.length} open finding(s) not anchored on the code at head: ${unlocated
        .map((f) => f.id)
        .slice(0, 5)
        .join(', ')}`
    );
  const total = scope.selected.length;
  const done = [...covered.values()].filter((item) => item.outcome === 'completed').length;
  const coverageRate = total ? Math.round((done / total) * 1000) / 10 : 100;
  const status = reasons.length ? 'incomplete' : open.length ? 'findings' : 'clean';
  return {
    status,
    // Reasons echo host-written text (a stop detail, an invalid value), and they reach the
    // terminal, the CI log and the check document alike: redacted once, here.
    reasons: reasons.map((reason) => redact(reason).text),
    stop: run && STOP_REASONS.includes(run.stop) ? run.stop : null,
    usage: observedUsage(scope, run),
    coverage: {
      selected: total,
      completed: done,
      waived: waived.length,
      failed: failed.length,
      missing: missing.length,
      rate: coverageRate,
    },
    findings: {
      open: open.length,
      confirmed: open.filter((f) => f.disposition === 'confirmed').length,
      unresolved: open.filter((f) => f.disposition === 'unresolved').length,
      refuted: ((anchored && anchored.findings) || []).length - open.length,
      bySeverity: Object.fromEntries(
        SEVERITIES.map((s) => [s, open.filter((f) => f.severity === s).length])
      ),
    },
  };
}

// ── Check result for CI ───────────────────────────────────────────────────────

const CHECK_SCHEMA = 'bmad-plus/review-check/1';
const GATE_EXIT = { clean: 0, findings: 1, incomplete: 2 };
const ANNOTATION_LEVEL = { critical: 'failure', high: 'failure', medium: 'warning', low: 'notice' };
/** The GitHub check-runs API accepts at most 50 annotations per request. */
const MAX_ANNOTATIONS = 50;
const MAX_SUMMARY_ROWS = 50;

const cell = (value) =>
  String(value)
    .replace(/[|\\`]/g, '\\$&')
    .replace(/\s+/g, ' ');

/**
 * The gate verdict as a stable document a CI step consumes without parsing prose: the
 * disposition and its exit code, the reasons, the counts, the scope it answers, the open
 * findings with their anchored lines, and a `github` block shaped like the check-runs API
 * (`conclusion` and `output` with a Markdown summary and annotations). Free text is passed
 * through the redaction floor; the document carries no timestamp, so the same evidence
 * always yields the same bytes.
 */
function checkResult({ id, scope, verdict, anchored }) {
  const rank = (severity) => SEVERITIES.indexOf(severity);
  const open = ((anchored && anchored.findings) || [])
    .filter((f) => f.disposition !== 'refuted')
    .map((f) => ({
      id: f.id,
      path: f.path,
      severity: f.severity,
      category: f.category,
      confidence: f.confidence,
      disposition: f.disposition,
      ...(f.rule !== undefined ? { rule: f.rule } : {}),
      ...(f.controls !== undefined ? { controls: f.controls } : {}),
      anchor: f.location.status,
      lineStart: f.location.status === 'located' ? f.location.lineStart : null,
      lineEnd: f.location.status === 'located' ? f.location.lineEnd : null,
      message: f.content,
    }))
    .sort(
      (a, b) =>
        rank(a.severity) - rank(b.severity) ||
        a.path.localeCompare(b.path) ||
        (a.lineStart || 0) - (b.lineStart || 0) ||
        String(a.id).localeCompare(String(b.id))
    );
  const reasons = verdict.reasons.map((reason) => redact(reason).text);
  const located = open.filter((f) => f.anchor === 'located');
  const annotations = located.slice(0, MAX_ANNOTATIONS).map((f) => ({
    path: f.path,
    start_line: f.lineStart,
    end_line: f.lineEnd,
    annotation_level: ANNOTATION_LEVEL[f.severity],
    title: `${f.severity} ${f.category} (${f.id})`,
    message: f.message,
  }));
  const { coverage, findings } = verdict;
  const summary = [
    `**${verdict.status}**: ${coverage.completed}/${coverage.selected} selected file(s) completed, ${coverage.waived} waived, ${coverage.failed} failed, ${coverage.missing} missing; ${findings.open} open finding(s), ${findings.refuted} refuted.`,
    `Scope \`${scope.sha256.slice(0, 12)}\` (${scope.identity.effort || 'medium'} effort)${verdict.stop ? `, stopped: ${verdict.stop}` : ''}.`,
    ...(reasons.length ? ['', ...reasons.map((reason) => `- ${cell(reason)}`)] : []),
    ...(open.length
      ? [
          '',
          '| Severity | Category | Finding | Location |',
          '|---|---|---|---|',
          ...open
            .slice(0, MAX_SUMMARY_ROWS)
            .map(
              (f) =>
                `| ${f.severity} | ${f.category} | ${cell(f.id)} | ${cell(f.path)}${f.lineStart ? `:${f.lineStart}` : ` (${f.anchor})`} |`
            ),
          ...(open.length > MAX_SUMMARY_ROWS
            ? [`\n${open.length - MAX_SUMMARY_ROWS} more in the check document.`]
            : []),
        ]
      : []),
    ...(verdict.status === 'clean'
      ? [
          '',
          'Clean means no open finding within a fully covered scope; it does not prove the code correct.',
        ]
      : []),
  ].join('\n');
  const body = {
    id,
    scopeSha256: scope.sha256,
    identity: {
      base: scope.identity.base,
      head: scope.identity.head,
      mergeBase: scope.identity.mergeBase,
      workspace: scope.identity.workspace,
      effort: scope.identity.effort || null,
      rulesSha256: scope.identity.rulesSha256 || null,
    },
    status: verdict.status,
    exitCode: GATE_EXIT[verdict.status],
    reasons,
    stop: verdict.stop,
    usage: verdict.usage,
    coverage,
    findings,
    open,
    github: {
      name: `bmad-plus review ${id}`,
      conclusion: verdict.status === 'clean' ? 'success' : 'failure',
      output: {
        title: `Review ${verdict.status}: ${findings.open} open finding(s), ${coverage.completed}/${coverage.selected} file(s) completed`,
        summary,
        annotations,
      },
      annotationsOmitted: located.length - annotations.length,
    },
  };
  return { schema: CHECK_SCHEMA, ...body, sha256: sha256(JSON.stringify(body)) };
}

// ── Continuing an interrupted review ──────────────────────────────────────────

const CONTINUE_SCHEMA = 'bmad-plus/review-continue/1';
const short = (sha) => String(sha).slice(0, 12);

/**
 * Why a sealed scope no longer describes the code: its head ref names another commit, the
 * review rules changed, or the change itself did (for a working tree, any selected byte).
 * Empty when the scope rebuilt now is exactly the scope that was sealed.
 */
function scopeDrift(projectDir, scope, options = {}) {
  const { identity } = scope;
  // Since continuation, every scope carries headRef (null for a working tree); an older one,
  // commit or working tree, lacks the key along with the per-file digests it relies on.
  if (!('headRef' in identity) || (!identity.workspace && !identity.headRef))
    return ['the scope was sealed without its head ref, before continuation existed'];
  const drift = [];
  if (!identity.workspace) {
    let now = null;
    try {
      now = resolveCommit(projectDir, identity.headRef);
    } catch {
      // Reported just below: a ref that no longer resolves has moved too.
    }
    if (now !== identity.head)
      drift.push(
        now
          ? `${identity.headRef} moved from ${short(identity.head)} to ${short(now)}`
          : `${identity.headRef} no longer resolves to a commit`
      );
  }
  let rebuilt;
  try {
    rebuilt = buildScope(projectDir, {
      id: scope.id,
      base: identity.base,
      head: identity.workspace ? undefined : identity.headRef,
      workspace: identity.workspace,
      include: identity.include,
      exclude: identity.exclude,
      effort: identity.effort,
      ruleset: options.ruleset,
      outputDir: options.outputDir,
    });
  } catch (error) {
    return [...drift, `the scope cannot be rebuilt: ${error.message}`];
  }
  if (rebuilt.sha256 === scope.sha256 || drift.length) return drift;
  if (rebuilt.identity.rulesSha256 !== identity.rulesSha256) drift.push('the review rules changed');
  // Rules are compared above; here only what each file is and how it changed.
  const describe = (list) =>
    new Map(list.map((item) => [item.path, JSON.stringify({ ...item, rules: undefined })]));
  const sealed = describe(scope.selected);
  const current = describe(rebuilt.selected);
  const moved = [...new Set([...sealed.keys(), ...current.keys()])]
    .filter((file) => sealed.get(file) !== current.get(file))
    .sort();
  if (moved.length)
    drift.push(
      `${moved.length} file(s) changed since the scope was sealed: ${moved.slice(0, 5).join(', ')}${moved.length > 5 ? '…' : ''}`
    );
  if (!drift.length) drift.push('the scope rebuilt now differs from the sealed one');
  return drift;
}

/**
 * What an interrupted review still owes against its unchanged scope: selected files never
 * accounted for or whose review failed, grouped back into their units; files of units
 * abandoned under the three-strikes rule, which this review will not retry; open findings
 * to requote; and the passes the plan still asks for when the run stopped early.
 */
function remainingWork({ scope, coverage, anchored, findingErrors = [] }) {
  const accounted = new Map(((coverage && coverage.items) || []).map((item) => [item.path, item]));
  const run = coverage && isRecord(coverage.run) ? coverage.run : null;
  const attempts = run && Array.isArray(run.attempts) ? run.attempts.filter(isRecord) : [];
  const { units: exhausted } = strikeLedger(attempts);
  const done = new Set(attempts.filter((a) => a.outcome === 'completed').map(attemptKey));
  const unitOf = unitIndex(scope);
  const files = [];
  const abandoned = [];
  for (const item of scope.selected) {
    const entry = accounted.get(item.path);
    if (entry && entry.outcome !== 'failed') continue;
    const record = {
      path: item.path,
      unit: unitOf.get(item.path),
      state: entry ? 'failed' : 'missing',
    };
    (exhausted.has(record.unit) ? abandoned : files).push(record);
  }
  const pending = new Set(files.map((file) => file.path));
  const units = scope.units
    .map((unit) => ({
      id: unit.id,
      paths: unit.paths.filter((file) => pending.has(file)),
      rules: unit.rules,
      ...(unit.controls ? { controls: unit.controls } : {}),
      // Rule groups another reviewer already completed are not handed out again.
      ...(unit.groups
        ? { groups: unit.groups.filter((group) => !done.has(`${unit.id}/${group.id}`)) }
        : {}),
    }))
    .filter((unit) => unit.paths.length);
  const requote = ((anchored && anchored.findings) || [])
    .filter((f) => f.disposition !== 'refuted' && f.location.status !== 'located')
    .map((f) => ({ id: f.id, path: f.path, status: f.location.status }));
  const usage = observedUsage(scope, run);
  const stopped = run && run.stop !== 'completed';
  const passes =
    stopped && usage.passes !== null && usage.plannedPasses !== null
      ? Math.max(0, usage.plannedPasses - usage.passes)
      : 0;
  return {
    schema: CONTINUE_SCHEMA,
    id: scope.id,
    scopeSha256: scope.sha256,
    previous: run ? { stop: STOP_REASONS.includes(run.stop) ? run.stop : null, usage } : null,
    counts: {
      files: files.length,
      units: units.length,
      abandoned: abandoned.length,
      requote: requote.length,
      findingErrors: findingErrors.length,
      passes,
    },
    units,
    files,
    abandoned,
    requote,
    findingErrors,
  };
}

// ── Comparing two reviews ─────────────────────────────────────────────────────

const COMPARE_SCHEMA = 'bmad-plus/review-compare/1';

/** A finding's identity survives moved lines and reindentation: path, category, normalised quote. */
function findingKey(file, finding) {
  const code = String(finding.existing_code || '')
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
    .join('\n');
  return JSON.stringify([file, finding.category, code]);
}

/**
 * What became of the open findings of an earlier review. `resolved` needs the later review
 * to have completed that file; otherwise the finding is `not_reviewed`, never assumed fixed.
 * Renames recorded in the later scope carry findings to the new path.
 */
function compareReviews(before, after) {
  const renamed = new Map(
    after.scope.selected.filter((item) => item.oldPath).map((item) => [item.oldPath, item.path])
  );
  const completed = new Set(
    ((after.coverage && after.coverage.items) || [])
      .filter((item) => item.outcome === 'completed')
      .map((item) => item.path)
  );
  const isOpen = (finding) => finding.disposition !== 'refuted';
  const afterByKey = new Map(after.findings.findings.map((f) => [findingKey(f.path, f), f]));
  const beforeKeys = new Set();
  const buckets = { new: [], persisting: [], resolved: [], refuted: [], not_reviewed: [] };

  for (const finding of before.findings.findings.filter(isOpen)) {
    const file = renamed.get(finding.path) || finding.path;
    const key = findingKey(file, finding);
    beforeKeys.add(key);
    const match = afterByKey.get(key);
    const entry = {
      before: finding.id,
      path: file,
      category: finding.category,
      severity: finding.severity,
    };
    if (match && isOpen(match)) buckets.persisting.push({ ...entry, after: match.id });
    else if (match) buckets.refuted.push({ ...entry, after: match.id });
    else if (completed.has(file)) buckets.resolved.push(entry);
    else buckets.not_reviewed.push(entry);
  }
  for (const finding of after.findings.findings.filter(isOpen)) {
    if (!beforeKeys.has(findingKey(finding.path, finding)))
      buckets.new.push({
        after: finding.id,
        path: finding.path,
        category: finding.category,
        severity: finding.severity,
      });
  }
  return {
    schema: COMPARE_SCHEMA,
    before: { id: before.scope.id, scopeSha256: before.scope.sha256 },
    after: { id: after.scope.id, scopeSha256: after.scope.sha256 },
    counts: Object.fromEntries(Object.entries(buckets).map(([name, list]) => [name, list.length])),
    buckets,
  };
}

function layout(projectDir, dir = DEFAULT_DIR, id) {
  const root = path.resolve(projectDir, dir, id);
  return {
    root,
    scope: path.join(root, 'scope.json'),
    findings: path.join(root, 'findings.json'),
    anchored: path.join(root, 'findings.anchored.json'),
    coverage: path.join(root, 'coverage.json'),
    checklist: path.join(root, 'checklist.md'),
    compare: path.join(root, 'compare.json'),
    continue: path.join(root, 'continue.json'),
  };
}

module.exports = {
  SCOPE_SCHEMA,
  FINDINGS_SCHEMA,
  COVERAGE_SCHEMA,
  COMPARE_SCHEMA,
  DEFAULT_DIR,
  EFFORTS,
  SEVERITIES,
  CATEGORIES,
  DISPOSITIONS,
  CONFIDENCE,
  OUTCOMES,
  STOP_REASONS,
  STRIKES,
  SECRET_PATTERNS,
  GENERATED_PATTERNS,
  parseNumstat,
  planUnits,
  buildScope,
  validateFindings,
  locate,
  anchorFindings,
  validateCoverage,
  validateRun,
  strikeLedger,
  reviewGate,
  CHECK_SCHEMA,
  GATE_EXIT,
  checkResult,
  CONTINUE_SCHEMA,
  scopeDrift,
  remainingWork,
  reviewPlan,
  findingKey,
  compareReviews,
  layout,
};
