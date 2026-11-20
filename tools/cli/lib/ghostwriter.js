'use strict';

const path = require('node:path');
const {
  BASE,
  MAX_CONTEXT,
  digest,
  identifier,
  textFile,
  present,
  writeOnce,
} = require('./ghostwriter-project');
const { prepare, load, manifestPath } = require('./ghostwriter-manifest');
const { checkFidelity } = require('./ghostwriter-fidelity');
const nexus = require('./ghostwriter-nexus');

const runDirectory = (id) => BASE + '/runs/' + identifier(id);

function describeAttempt(manifest, number) {
  const id = 'attempt-' + number;
  const directory = manifest.expected_outputs.directory + '/' + id;
  const suffix = path.extname(manifest.input_artifacts[0].path).toLowerCase();
  return {
    id,
    number,
    output_path: directory + '/edit/revised' + suffix,
    review_path: directory + '/review/semantic.json',
  };
}

function attemptFile(runId, attempt) {
  return runDirectory(runId) + '/' + attempt.id + '.json';
}

function currentAttempt(root, manifest) {
  let latest = null;
  for (let n = 1; n <= manifest.limits.max_revision_attempts; n++) {
    const attempt = describeAttempt(manifest, n);
    const file = attemptFile(manifest.run_id, attempt);
    if (!present(root, file)) break;
    if (digest(JSON.parse(textFile(root, file).content)) !== digest(attempt))
      throw new Error('Attempt reservation mismatch.');
    latest = attempt;
  }
  return latest;
}

function incomplete(id, reason, attempt = null) {
  return {
    schema_version: 1,
    run_id: id,
    attempt_id: attempt?.id ?? null,
    execution: { status: 'not_verified', producer_session_id: null, reviewer_session_id: null },
    coverage: { total_units: 0, completed_units: 0, missing_units: [] },
    mechanical_checks: { status: 'not_run', findings: [] },
    semantic_review: { fidelity: 'not_run', facts: 'not_run', quality: 'not_run', findings: [] },
    usage: { tokens: null, cost: null, duration_ms: null },
    gate: { verdict: 'incomplete', reasons: [reason] },
  };
}

async function run(root, id, options = {}) {
  const manifest = load(root, id);
  if (manifest.execution_requirements.mode !== 'orchestrated')
    throw new Error('Use a run prepared for orchestrated execution.');
  const previous = currentAttempt(root, manifest);
  if (Boolean(previous) !== Boolean(options.retry))
    throw new Error(
      previous ? 'Use --retry for the next attempt.' : 'No previous attempt to retry.'
    );
  const next = describeAttempt(manifest, (previous?.number ?? 0) + 1);
  if (next.number > manifest.limits.max_revision_attempts)
    throw new Error('Ghostwriter revision attempt limit reached.');
  if (previous) {
    const prior = await nexus.inspectReview(root, manifest, previous);
    if (!prior.retryable) throw new Error('Previous execution is unresolved or cannot be retried.');
  }
  const codex = nexus.resolveCodex(options.codex);
  nexus.preflightReview(root, manifest);
  // A concurrent caller racing for the same ordinal gets EEXIST before spawning any worker.
  writeOnce(root, attemptFile(id, next), next);
  await nexus.executeReview(root, manifest, next, { ...options, codex });
  return evaluate(root, id, 'check');
}

async function evaluate(root, id, action, expectedAttempt) {
  let attempt;
  try {
    const manifest = load(root, id);
    attempt = currentAttempt(root, manifest);
    if (!attempt) {
      const report = incomplete(id, 'No execution attempt was observed.');
      const input = manifest.input_artifacts[0];
      report.coverage = {
        total_units: input.units.length,
        completed_units: 0,
        missing_units: input.units,
      };
      report.input_sha256 = input.sha256;
      return report;
    }
    if (expectedAttempt !== undefined && expectedAttempt !== attempt.id)
      return incomplete(id, 'The requested attempt is not current.', attempt);
    const input = manifest.input_artifacts[0];
    const report = incomplete(id, 'The revision is not yet complete.', attempt);
    Object.assign(report, {
      workflow: manifest.workflow,
      content_type: manifest.content_type,
      locale: manifest.locale,
      manifest_sha256: textFile(root, manifestPath(id)).sha256,
      input_sha256: input.sha256,
      output_sha256: null,
      source_set_sha256: manifest.source_set_sha256,
      profile_sha256: manifest.voice_profile.sha256,
      policy_sha256: manifest.policy.sha256,
      output_path: attempt.output_path,
      review_path: attempt.review_path,
    });
    report.coverage = {
      total_units: input.units.length,
      completed_units: 0,
      missing_units: input.units,
    };
    const evidence = await nexus.inspectReview(root, manifest, attempt);
    if (evidence.usage) {
      report.usage = { ...report.usage, ...evidence.usage };
    }
    report.execution = {
      status: evidence.executed ? 'observed' : 'not_verified',
      producer_session_id: evidence.producer_session_id ?? null,
      reviewer_session_id: evidence.reviewer_session_id ?? null,
      producer_attempt_id: evidence.producer_attempt_id ?? null,
      reviewer_attempt_id: evidence.reviewer_attempt_id ?? null,
      producer_adapter: evidence.producer_session_id ? 'codex-exec' : null,
      reviewer_adapter: evidence.reviewer_session_id ? 'codex-exec' : null,
    };
    const reasons = [];
    const findings = [];
    if (!evidence.complete || !evidence.executed)
      reasons.push(evidence.reason || 'Missing current Nexus evidence.');
    if (
      !report.execution.producer_session_id ||
      !report.execution.reviewer_session_id ||
      report.execution.producer_session_id === report.execution.reviewer_session_id
    ) {
      reasons.push('Distinct observed producer and reviewer sessions are required.');
    }
    if (!present(root, attempt.output_path)) {
      reasons.push('The revised text is missing.');
    } else {
      const draft = textFile(root, input.path);
      const output = textFile(root, attempt.output_path, manifest.limits.max_output_bytes);
      report.output_sha256 = output.sha256;
      if (
        evidence.complete &&
        (draft.sha256 !== evidence.input_sha256 || output.sha256 !== evidence.output_sha256)
      ) {
        reasons.push('The observed input or output differs from the current artifact.');
      }
      report.mechanical_checks = checkFidelity(draft.content, output.content, {
        format: input.format,
        allowedFields: manifest.policy.editable_fields,
        protectedSpans: manifest.policy.protected_spans,
        protectedTerms: manifest.policy.protected_terms,
        sourceLocale: manifest.policy.source_locale,
        targetLocale: manifest.locale,
      });
      if (report.mechanical_checks.status === 'findings')
        findings.push('Mechanical fidelity checks found differences.');
      else if (
        report.mechanical_checks.status !== 'pass' ||
        report.mechanical_checks.coverage !== 'complete'
      ) {
        reasons.push('Mechanical fidelity coverage is incomplete.');
      }
    }
    const semantic = evidence.semantic_review;
    if (evidence.complete && semantic) {
      report.semantic_review = semantic;
      report.review_sha256 = textFile(
        root,
        attempt.review_path,
        manifest.limits.max_output_bytes
      ).sha256;
      if (report.review_sha256 !== evidence.review_sha256)
        reasons.push('The current review differs from its execution receipt.');
      const coverage = semantic.coverage;
      if (
        !coverage ||
        !Number.isSafeInteger(coverage.total_units) ||
        coverage.total_units < input.units.length ||
        coverage.completed_units !== coverage.total_units ||
        !Array.isArray(coverage.missing_units) ||
        coverage.missing_units.length
      ) {
        reasons.push('Semantic review coverage is partial.');
      } else report.coverage = coverage;
      if (!Array.isArray(semantic.findings)) reasons.push('Missing findings list.');
      else if (semantic.findings.some((f) => f.severity === 'blocking'))
        findings.push('The reviewer identified blocking findings.');
      for (const key of ['fidelity', 'quality']) {
        if (semantic[key] === 'findings')
          findings.push('The reviewer identified ' + key + ' findings.');
        else if (semantic[key] !== 'pass')
          reasons.push('Missing semantic assessment of ' + key + '.');
      }
      if (
        manifest.policy.facts === 'provided-sources' &&
        (!manifest.source_artifacts.length || semantic.facts !== 'supported_by_provided_sources')
      ) {
        reasons.push('The required factual support is incomplete.');
      }
    } else {
      reasons.push('A complete current semantic review is required.');
    }
    if (!reasons.length && !findings.length && evidence.passes !== true)
      reasons.push('Nexus did not accept this review.');
    load(root, id);
    if (currentAttempt(root, manifest)?.id !== attempt.id)
      reasons.push('A newer attempt has started.');
    const verdict = reasons.length ? 'incomplete' : findings.length ? 'findings' : 'accepted';
    report.gate = { verdict, reasons: [...reasons, ...findings] };
    // Collection binds current bytes and current observed executions. check cannot mint a delivery decision.
    if (verdict !== 'incomplete') {
      const fingerprint = digest(report);
      const receipt = runDirectory(id) + '/receipts/' + attempt.id + '-' + fingerprint + '.json';
      const record = {
        schema_version: 1,
        run_id: id,
        attempt_id: attempt.id,
        sha256: fingerprint,
        report,
      };
      if (Buffer.byteLength(JSON.stringify(record, null, 2) + '\n') > MAX_CONTEXT) {
        throw new Error('The evidence report exceeds the supported size.');
      }
      if (action === 'collect' && !present(root, receipt)) {
        try {
          writeOnce(root, receipt, record);
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
      if (
        !present(root, receipt) ||
        digest(JSON.parse(textFile(root, receipt, MAX_CONTEXT).content)) !== digest(record)
      ) {
        report.collection_required = true;
        report.gate = {
          verdict: 'incomplete',
          reasons: ['The current execution evidence has not been collected.'],
        };
      } else {
        report.receipt_path = receipt;
      }
    }
    return report;
  } catch (error) {
    return incomplete(id, error.message, attempt);
  }
}

module.exports = { prepare, run, evaluate };
