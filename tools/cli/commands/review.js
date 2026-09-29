/** Code review evidence: seal the scope, anchor the findings, derive the verdict from coverage. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const review = require('../lib/review');
const reviewRules = require('../lib/review-rules');

const ID = /^[a-z0-9][a-z0-9.-]{0,80}$/;
const ACTIONS = ['scope', 'anchor', 'gate', 'continue', 'compare', 'rules'];

function fail(message) {
  throw new Error(message);
}

function readJson(file, what) {
  if (!fs.existsSync(file)) return null;
  try {
    // PowerShell 5.1 writes UTF-8 with a byte-order mark; JSON.parse refuses it.
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`${what} is not valid JSON (${error.message})`);
    return null;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** A reader of the file sees the previous version or the new one, never half of it. */
function writeAtomically(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, text, { flag: 'wx' });
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

const inside = (dir, file) => {
  const relative = path.relative(dir, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

/**
 * Where `--emit-check` writes: a JSON file, resolved against the project, never the evidence
 * itself. A working-tree scope selects untracked files, so its check stays in the review
 * folder or out of the project: anywhere else it would enter the change it reports on.
 */
function checkTarget(projectDir, value, paths, scope) {
  const file = path.resolve(projectDir, value);
  if (!/\.json$/i.test(file)) fail('--emit-check writes a .json file');
  const evidence = Object.entries(paths).filter(([key]) => key !== 'root');
  if (evidence.some(([, taken]) => path.relative(taken, file) === ''))
    fail('--emit-check must not overwrite the review evidence');
  if (
    scope.identity.workspace &&
    inside(projectDir, file) &&
    !inside(path.dirname(paths.root), file)
  )
    fail(
      `--emit-check: a working-tree review writes its check in ${path.relative(projectDir, path.dirname(paths.root)) || '.'} or outside the project, where it cannot enter the reviewed change`
    );
  if (fs.existsSync(file) && !fs.statSync(file).isFile())
    fail(`--emit-check: ${file} is not a file`);
  return file;
}

function print(json, payload, lines) {
  if (json) console.log(JSON.stringify({ schemaVersion: 1, ...payload }, null, 2));
  else for (const line of lines) console.log(line);
}

function requireId(value, what = 'a review id') {
  if (!value || !ID.test(value))
    fail(`${what} is required: lowercase letters, digits, dots and dashes`);
  return value;
}

function loadReview(projectDir, dir, id) {
  const paths = review.layout(projectDir, dir, id);
  const scope = readJson(paths.scope, `${id}/scope.json`);
  if (!scope) fail(`no scope at ${paths.scope} — run "bmad-plus review scope ${id}" first`);
  return { paths, scope };
}

/** One line of observed usage: what the host reported, nothing estimated. */
function describeUsage(stop, usage) {
  const parts = [
    `stopped: ${stop || 'unstated'}`,
    `${usage.passes ?? '?'}/${usage.plannedPasses ?? '?'} pass(es)`,
    `${usage.unitsAttempted}/${usage.units} unit(s) attempted in ${usage.attempts} attempt(s), ${usage.failedAttempts} failed`,
  ];
  if (usage.tokens !== undefined) parts.push(`${usage.tokens} tokens`);
  if (usage.durationMs !== undefined) parts.push(`${Math.round(usage.durationMs / 1000)} s`);
  return parts.join(', ');
}

/**
 * `review continue <id>`: what an interrupted review still owes, against the same sealed
 * scope. Refused when the code or the rules moved — a new scope and a compare answer that.
 */
function continueAction(projectDir, dir, id, paths, scope, json) {
  const drift = review.scopeDrift(projectDir, scope, {
    ruleset: reviewRules.loadRuleset(projectDir),
    outputDir: dir,
  });
  if (drift.length) {
    const next = [
      `bmad-plus review scope <new-id> (same options as ${id})`,
      `bmad-plus review compare <new-id> --since ${id}`,
    ];
    print(json, { action: 'continue', id, status: 'moved', drift, next }, [
      `${id} cannot continue: the sealed scope no longer describes the code.`,
      ...drift.map((reason) => `  - ${reason}`),
      `  Seal a new scope and compare: ${next.join(', then ')}.`,
    ]);
    process.exitCode = 3;
    return undefined;
  }
  const coverage = readJson(paths.coverage, 'coverage.json');
  const coverageErrors = coverage ? review.validateCoverage(coverage, scope) : [];
  if (coverageErrors.length) {
    print(json, { action: 'continue', id, status: 'error', errors: coverageErrors }, [
      `${id}: coverage.json must be valid before the review continues`,
      ...coverageErrors.map((e) => `  error   ${e}`),
    ]);
    process.exitCode = 3;
    return undefined;
  }
  const findings = readJson(paths.findings, 'findings.json');
  const findingErrors = findings ? review.validateFindings(findings, scope) : [];
  const anchored =
    findings && !findingErrors.length ? review.anchorFindings(projectDir, scope, findings) : null;
  const packet = review.remainingWork({ scope, coverage, anchored, findingErrors });
  writeJson(paths.continue, packet);
  const c = packet.counts;
  const nothing = !c.files && !c.requote && !c.findingErrors && !c.passes;
  print(json, { action: 'continue', id, status: 'ready', file: paths.continue, counts: c }, [
    `${paths.continue} — same scope ${scope.sha256.slice(0, 12)}`,
    `${c.files} file(s) in ${c.units} unit(s) to review, ${c.requote} finding(s) to requote, ${c.passes} pass(es) left`,
    ...packet.units.map((unit) => `  ${unit.id.padEnd(5)} ${unit.paths.join(', ')}`),
    ...packet.abandoned.map(
      (file) => `  abandoned ${file.path} (${file.unit}): three failed attempts; it stays failed`
    ),
    ...packet.requote.map((f) => `  requote ${f.id} ${f.path} (${f.status})`),
    ...packet.findingErrors.map((e) => `  fix     ${e}`),
    nothing
      ? `Nothing remains: once coverage.json records the run as completed, run bmad-plus review gate ${id}.`
      : 'Add to the same coverage.json and findings.json; set run.stop when this session ends.',
  ]);
  process.exitCode = 0;
  return undefined;
}

/** `review rules [path]`: the effective rule set, or the rules one path would get. */
function rulesAction(projectDir, target, json) {
  const ruleset = reviewRules.loadRuleset(projectDir);
  const file = target ? target.split(path.sep).join('/').replace(/^\.\//, '') : null;
  const ids = file ? reviewRules.rulesFor(ruleset, file) : ruleset.rules.map((rule) => rule.id);
  const listed = ruleset.rules.filter((rule) => ids.includes(rule.id));
  print(
    json,
    {
      action: 'rules',
      path: file,
      sha256: ruleset.sha256,
      packFiles: ruleset.packFiles,
      projectFile: ruleset.projectFile,
      disabled: ruleset.disabled,
      rules: listed.map(({ id, title, group, layer, pack, globs, controls, source }) => ({
        id,
        title,
        group,
        layer,
        ...(pack ? { pack } : {}),
        globs,
        controls,
        source,
      })),
      controls: reviewRules.controlsOf(
        ruleset,
        listed.map((rule) => rule.id)
      ),
    },
    [
      `rule set ${ruleset.sha256.slice(0, 12)} (${['built-in', ...ruleset.packFiles, ...(ruleset.projectFile ? [ruleset.projectFile] : [])].join(' + ')})`,
      ...(file ? [`${file} gets ${listed.length} rule(s):`] : []),
      ...listed.map(
        (rule) =>
          `  ${rule.id.padEnd(24)} ${rule.group.padEnd(12)} ${rule.layer.padEnd(8)} ${rule.globs.join(' ')}${rule.controls.length ? `\n  ${''.padEnd(24)} controls: ${rule.controls.join(' ')}` : ''}`
      ),
      ...ruleset.disabled.map((id) => `  ${id.padEnd(24)} disabled by the project`),
    ]
  );
}

module.exports = {
  command: 'review <action> [id]',
  description: 'Code review evidence: scope, anchor, gate, continue, compare, rules',
  options: [
    ['-d, --directory <path>', 'Project directory'],
    ['--dir <path>', 'Review folder inside the project', review.DEFAULT_DIR],
    ['--base <ref>', 'Base commit or branch (default HEAD~1)'],
    ['--head <ref>', 'Head commit or branch (default HEAD)'],
    ['--workspace', 'Review the working tree, untracked files included, against the base'],
    ['--include <glob>', 'Only review matching paths (repeatable)', (v, all) => [...all, v], []],
    ['--exclude <glob>', 'Never review matching paths (repeatable)', (v, all) => [...all, v], []],
    [
      '--effort <level>',
      `Review depth: ${Object.keys(review.EFFORTS).join(', ')} (default medium)`,
    ],
    ['--since <id>', 'compare: the earlier review to compare against'],
    ['--emit-check <file>', 'gate: also write the verdict as a JSON check result for CI'],
    ['--json', 'Machine-readable output'],
  ],
  action: (action, id, options = {}) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const dir = options.dir || review.DEFAULT_DIR;
    const json = Boolean(options.json);
    try {
      if (!ACTIONS.includes(action)) fail(`unknown action "${action}" (${ACTIONS.join(', ')})`);
      if (action === 'rules') return rulesAction(projectDir, id, json);
      requireId(id);

      if (action === 'scope') {
        const ruleset = reviewRules.loadRuleset(projectDir);
        const scope = review.buildScope(projectDir, {
          id,
          base: options.base,
          head: options.head,
          workspace: Boolean(options.workspace),
          include: options.include,
          exclude: options.exclude,
          effort: options.effort,
          outputDir: dir,
          ruleset,
        });
        const paths = review.layout(projectDir, dir, id);
        fs.mkdirSync(paths.root, { recursive: true });
        writeJson(paths.scope, scope);
        const byPath = Object.fromEntries(scope.selected.map((item) => [item.path, item.rules]));
        fs.writeFileSync(
          paths.checklist,
          reviewRules.checklist(ruleset, byPath, { title: `Review checklist — ${id}` })
        );
        const reasons = {};
        for (const item of scope.excluded) reasons[item.reason] = (reasons[item.reason] || 0) + 1;
        const { plan } = scope;
        print(
          json,
          {
            action,
            id,
            file: paths.scope,
            checklist: paths.checklist,
            totals: scope.totals,
            units: scope.units.length,
            excluded: reasons,
            plan,
            rulesSha256: scope.identity.rulesSha256,
            sha256: scope.sha256,
          },
          [
            `${paths.scope}`,
            `${scope.totals.selected} file(s) to review, ${scope.totals.lines} changed lines, ${scope.units.length} unit(s) — scope ${scope.sha256.slice(0, 12)}`,
            ...Object.entries(reasons).map(([reason, n]) => `  excluded ${n} × ${reason}`),
            `checklist: ${paths.checklist}`,
            `plan: ${plan.effort} effort, ${plan.passes} pass(es)${plan.refute ? ', refutation pass' : ''}${plan.planFirst ? ', plan before reading' : ''}${plan.parallelUnits ? ', units can be reviewed in parallel' : ''}`,
            'Every selected file must end in coverage.json as completed, failed or waived (with a reason).',
          ]
        );
        return undefined;
      }

      const { paths, scope } = loadReview(projectDir, dir, id);

      if (action === 'anchor') {
        const findings = readJson(paths.findings, 'findings.json');
        if (!findings) fail(`no findings at ${paths.findings}`);
        const errors = review.validateFindings(findings, scope);
        if (errors.length) {
          print(
            json,
            { action, id, status: 'error', errors },
            errors.map((e) => `  error   ${e}`)
          );
          process.exitCode = 1;
          return undefined;
        }
        const anchored = review.anchorFindings(projectDir, scope, findings);
        writeJson(paths.anchored, {
          schema: review.FINDINGS_SCHEMA,
          scopeSha256: scope.sha256,
          ...anchored,
        });
        const loose = anchored.findings.filter((f) => f.location.status !== 'located');
        const { counts } = anchored;
        print(json, { action, id, file: paths.anchored, counts }, [
          `${paths.anchored} — ${counts.located} located, ${counts.ambiguous} ambiguous, ${counts.unlocated} unlocated`,
          ...loose.map(
            (f) =>
              `  ${f.location.status.padEnd(9)} ${f.id} ${f.path}: quote a longer, exact excerpt`
          ),
          ...(counts.redactions
            ? [
                `  ${counts.redactions} credential-like value(s) replaced by [REDACTED] in the written record`,
              ]
            : []),
        ]);
        process.exitCode = loose.length ? 1 : 0;
        return undefined;
      }

      if (action === 'gate') {
        const findings = readJson(paths.findings, 'findings.json');
        const coverage = readJson(paths.coverage, 'coverage.json');
        let anchored = null;
        if (findings && !review.validateFindings(findings, scope).length)
          anchored = review.anchorFindings(projectDir, scope, findings);
        const verdict = review.reviewGate({ scope, findings, coverage, anchored });
        let check = null;
        if (options.emitCheck) {
          check = checkTarget(projectDir, options.emitCheck, paths, scope);
          writeAtomically(
            check,
            `${JSON.stringify(review.checkResult({ id, scope, verdict, anchored }), null, 2)}\n`
          );
        }
        print(
          json,
          { action, id, ...verdict, check },
          [
            `${id}: ${verdict.status} — coverage ${verdict.coverage.completed}/${verdict.coverage.selected} completed (${verdict.coverage.waived} waived), ${verdict.findings.open} open finding(s), ${verdict.findings.refuted} refuted`,
            ...verdict.reasons.map((reason) => `  - ${reason}`),
            verdict.usage ? `  run: ${describeUsage(verdict.stop, verdict.usage)}` : '',
            check ? `  check: ${check}` : '',
            verdict.status === 'clean'
              ? '  clean: no open finding within a fully covered scope. It does not prove the code correct.'
              : '',
          ].filter(Boolean)
        );
        process.exitCode = review.GATE_EXIT[verdict.status];
        return undefined;
      }

      if (action === 'continue') return continueAction(projectDir, dir, id, paths, scope, json);

      // compare: this review against an earlier one.
      const sinceId = requireId(options.since, '--since <earlier review id>');
      if (sinceId === id) fail('--since must name a different review');
      const earlier = loadReview(projectDir, dir, sinceId);
      const load = (entry, label) => {
        const findings = readJson(entry.paths.findings, `${label}/findings.json`);
        if (!findings) fail(`no findings at ${entry.paths.findings}`);
        const errors = review.validateFindings(findings, entry.scope);
        if (errors.length) fail(`${label}/findings.json is invalid: ${errors[0]}`);
        return findings;
      };
      const result = review.compareReviews(
        { scope: earlier.scope, findings: load(earlier, sinceId) },
        {
          scope,
          findings: load({ paths, scope }, id),
          coverage: readJson(paths.coverage, `${id}/coverage.json`),
        }
      );
      writeJson(paths.compare, result);
      const c = result.counts;
      print(
        json,
        { action, id, since: sinceId, file: paths.compare, counts: c },
        [
          `${id} since ${sinceId}: ${c.new} new, ${c.persisting} persisting, ${c.resolved} resolved, ${c.refuted} refuted, ${c.not_reviewed} not reviewed`,
          c.not_reviewed
            ? '  not reviewed: earlier findings on files this review did not complete — they are not known to be fixed.'
            : '',
        ].filter(Boolean)
      );
      return undefined;
    } catch (error) {
      if (json)
        console.log(
          JSON.stringify({ schemaVersion: 1, status: 'error', message: error.message }, null, 2)
        );
      else console.error(`review: ${error.message}`);
      process.exitCode = 3;
      return undefined;
    }
  },
};
