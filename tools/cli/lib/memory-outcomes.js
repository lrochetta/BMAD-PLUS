'use strict';

const crypto = require('node:crypto');
const nexus = require('./nexus');
const store = require('./memory-store');

const OUTCOMES = '.bmad/memory/outcomes.ndjson';
const BOOST = 0.25;
const digest = (value) =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function requiredText(value, label, maximum = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new Error(label + ' must be non-empty bounded text.');
  return value;
}
function scopePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value.includes(':') ||
    value.split('/').some((p) => !p || p === '.' || p === '..')
  ) {
    throw new Error('Outcome scope must be a normalized relative path.');
  }
  return value;
}
function within(child, parent) {
  return child === parent || child.startsWith(parent + '/');
}
function overlaps(a, b) {
  return a.some((left) => b.some((right) => within(left, right) || within(right, left)));
}
function scopes(values) {
  if (!Array.isArray(values) || !values.length || values.length > 30)
    throw new Error('An explicit non-empty project scope is required.');
  return [...new Set(values.map(scopePath))].sort();
}
function sourceSection(baseDir, input) {
  if (
    !input ||
    !/^(?:\.agents|\.bmad)\/memory\/(?:decisions|lessons|patterns)\.md$/.test(input.file)
  )
    throw new Error(
      'Outcome memory source must be a project decisions, lessons or patterns Markdown file.'
    );
  const heading = requiredText(input.heading, 'Memory heading', 300);
  const sections = require('./memory-journal')._internal.splitSections(
    store.readText(baseDir, input.file),
    input.file
  );
  const matches = sections.filter((section) => section.heading === heading);
  if (matches.length !== 1) throw new Error('Memory heading must identify exactly one section.');
  const text = (matches[0].heading + '\n' + matches[0].text).trim();
  return { file: input.file, heading, textSha256: digest(text) };
}

/** Read-only adapter: Nexus owns the actual verification and freshness policy. */
function acceptedSource(baseDir, runId, taskId) {
  const run = nexus.inspectRun(baseDir, runId);
  if (run.lock || run.recoveryLock)
    throw new Error(
      'Nexus state is being written or recovered; retry observation after its owner finishes.'
    );
  const task = run.tasks.find((item) => item.id === taskId);
  const observation = run.observations.find((item) => item.taskId === taskId);
  const attempt = task?.attempts.at(-1);
  if (
    !task ||
    task.integration !== 'accepted' ||
    !observation?.evidenceEligible ||
    observation.stale ||
    attempt?.execution !== 'completed' ||
    attempt.verification.status !== 'passed'
  ) {
    throw new Error(
      'Outcome source is not an accepted task with current independently verified evidence.'
    );
  }
  if (
    task.integrationReceipt?.attemptId !== attempt.id ||
    !equal(task.integrationReceipt.artifactHashes, attempt.verification.artifactHashes)
  ) {
    throw new Error('Nexus acceptance does not bind the current attempt and artifacts.');
  }
  const definition = run.plan.tasks.find((item) => item.id === taskId);
  return {
    kind: 'nexus',
    runId,
    taskId,
    attemptId: attempt.id,
    verificationId: attempt.verification.id,
    verificationSha256: digest(attempt.verification),
    acceptedAt: task.acceptedAt,
    artifactHashes: task.integrationReceipt.artifactHashes,
    resourceHashes: definition.resourceHashes,
    scope: definition.scope,
    objective: definition.objective,
    baseline: attempt.baseline || null,
  };
}

function readOutcomes(baseDir) {
  const text = store.readText(baseDir, OUTCOMES, { missing: true });
  if (text === null) return [];
  if (text && !text.endsWith('\n'))
    throw new Error('Outcome store has an incomplete final record.');
  const records = text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (records.length > 1000) throw new Error('Outcome store exceeds 1000 records.');
  const seen = new Set();
  const attempts = new Set();
  for (const record of records) {
    const { id, ...body } = record;
    if (
      body.schemaVersion !== 1 ||
      body.kind !== 'accepted-outcome' ||
      id !== digest(body) ||
      seen.has(id)
    )
      throw new Error('Outcome receipt integrity or uniqueness check failed.');
    if (
      !Array.isArray(record.supersedes) ||
      !Array.isArray(record.contradicts) ||
      [...record.supersedes, ...record.contradicts].some((ref) => !seen.has(ref))
    )
      throw new Error('Outcome relationships must identify earlier receipts.');
    const attemptKey = [record.source?.runId, record.source?.taskId, record.source?.attemptId].join(
      '\0'
    );
    if (!record.source?.attemptId || attempts.has(attemptKey))
      throw new Error('Duplicate or missing outcome attempt identity.');
    attempts.add(attemptKey);
    seen.add(id);
  }
  return records;
}

function observeOutcome(baseDir, input, { now } = {}) {
  if (!input || typeof input !== 'object') throw new Error('Outcome input is required.');
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now)))
    throw new Error('Outcome timestamp must be injected as an ISO string.');
  return store.withMemoryLock(baseDir, () => {
    const records = readOutcomes(baseDir);
    const source = acceptedSource(
      baseDir,
      requiredText(input.runId, 'Run ID'),
      requiredText(input.taskId, 'Task ID')
    );
    if (
      records.some(
        (record) =>
          record.source.runId === source.runId &&
          record.source.taskId === source.taskId &&
          record.source.attemptId === source.attemptId
      )
    )
      throw new Error('Duplicate outcome: this task attempt already supplied a receipt.');
    const memory = sourceSection(baseDir, input.memory);
    const scope = scopes(input.scope);
    if (scope.some((item) => !source.scope.some((parent) => within(item, parent))))
      throw new Error('Outcome scope exceeds the accepted task scope.');
    const relationships = {};
    for (const key of ['supersedes', 'contradicts']) {
      const values = input[key] || [];
      if (!Array.isArray(values) || values.length > 30 || new Set(values).size !== values.length)
        throw new Error('Outcome relationships must be a unique bounded receipt-ID list.');
      for (const id of values) {
        const prior = records.find((record) => record.id === id);
        if (!prior || !overlaps(scope, prior.scope))
          throw new Error('Related outcome must exist in the same applicable project scope.');
      }
      relationships[key] = [...values].sort();
    }
    if (relationships.supersedes.some((id) => relationships.contradicts.includes(id)))
      throw new Error('A receipt cannot be both superseded and contradicted.');
    const body = {
      schemaVersion: 1,
      kind: 'accepted-outcome',
      ts: now,
      memory,
      scope,
      source,
      interpretation: requiredText(input.interpretation, 'Lesson interpretation', 2000),
      verification: { status: 'passed', acceptance: 'accepted', lessonCausality: 'unmeasured' },
      ...relationships,
    };
    // Re-read after loading relationships/Markdown; do not persist a torn source observation.
    if (
      !equal(source, acceptedSource(baseDir, source.runId, source.taskId)) ||
      !equal(memory, sourceSection(baseDir, input.memory))
    )
      throw new Error('Outcome sources changed while being observed.');
    if (records.length >= 1000) throw new Error('Outcome store is full; archive it explicitly.');
    return store.appendRecord(baseDir, OUTCOMES, { id: digest(body), ...body });
  });
}

function inspectOutcomes(baseDir, { contextScope } = {}) {
  const selectedScope = contextScope === undefined ? null : scopes(contextScope);
  const records = readOutcomes(baseDir);
  const superseded = new Set(records.flatMap((record) => record.supersedes));
  const contradictory = new Set();
  for (const record of records.filter((record) => !superseded.has(record.id))) {
    for (const other of record.contradicts) {
      if (!superseded.has(other)) {
        contradictory.add(record.id);
        contradictory.add(other);
      }
    }
  }
  const conflictingAnchors = new Set(
    records
      .filter((record) => contradictory.has(record.id))
      .map((record) => record.memory.file + '\0' + record.memory.heading)
  );
  return records.map((record) => {
    let reason = null;
    if (superseded.has(record.id)) reason = 'superseded';
    else if (conflictingAnchors.has(record.memory.file + '\0' + record.memory.heading))
      reason = 'contradictory';
    else if (selectedScope && !overlaps(record.scope, selectedScope))
      reason = 'outside-query-scope';
    else {
      try {
        if (!equal(sourceSection(baseDir, record.memory), record.memory))
          reason = 'stale-memory-section';
        else if (
          !equal(acceptedSource(baseDir, record.source.runId, record.source.taskId), record.source)
        )
          reason = 'stale-outcome-source';
      } catch (error) {
        reason = 'unavailable-or-ineligible-source: ' + error.message;
      }
    }
    return { ...record, eligible: reason === null, reason };
  });
}

function rankWithEvidence(baseDir, candidates, { contextScope } = {}) {
  const status = inspectOutcomes(baseDir, { contextScope: scopes(contextScope) });
  const key = (value) => value.file + '\0' + value.heading;
  const results = [];
  for (const entry of candidates) {
    const matching =
      entry.kind === 'note'
        ? status.filter(
            (record) => key(record.memory) === key({ file: entry.sourceFile, heading: entry.ref })
          )
        : [];
    if (!matching.length) {
      results.push({ ...entry, evidence: { status: 'unverified', receiptIds: [], boost: 0 } });
      continue;
    }
    // A stale, contradicted or superseded anchor must not silently fall back to an authoritative note.
    const eligible = matching.filter(
      (record) => record.eligible && record.memory.textSha256 === digest(entry.text)
    );
    if (!eligible.length) continue;
    const reward = require('./memory-journal').computeReward({ acceptance: true });
    results.push({
      ...entry,
      lexicalScore: entry.score,
      score: entry.score * (1 + BOOST * reward),
      evidence: {
        status: 'accepted-current',
        receiptIds: eligible.map((record) => record.id),
        reward,
        boost: BOOST,
        lessonCausality: 'unmeasured',
      },
    });
  }
  return results;
}

module.exports = {
  observeOutcome,
  inspectOutcomes,
  readOutcomes,
  rankWithEvidence,
  acceptedSource,
  OUTCOMES,
  BOOST,
};
