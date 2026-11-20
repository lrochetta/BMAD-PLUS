/**
 * Security assurance cases: start one from the Shield template, run the checks that produce
 * evidence, verify a case against them.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assurance = require('../lib/assurance');

const ACTIONS = ['init', 'run', 'verify'];

function print(json, payload, lines) {
  if (json) console.log(JSON.stringify({ schemaVersion: 1, ...payload }, null, 2));
  else for (const line of lines) console.log(line);
}

/** `--emit-check` writes a JSON file atomically, never over the case or its ledger. */
function writeCheck(projectDir, value, kase, ledger, result) {
  const file = path.resolve(projectDir, value);
  if (!/\.json$/i.test(file)) throw new Error('--emit-check writes a .json file');
  const protectedFiles = [path.resolve(projectDir, kase.file), ledger];
  if (protectedFiles.some((taken) => path.relative(taken, file) === ''))
    throw new Error('--emit-check must not overwrite the case or its ledger');
  if (fs.existsSync(file) && !fs.statSync(file).isFile())
    throw new Error(`--emit-check: ${file} is not a file`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  return file;
}

function initAction(projectDir, caseFile, json) {
  const { file, id } = assurance.initCase(projectDir, caseFile);
  print(json, { action: 'init', case: id, file }, [
    `${file}: case ${id} started from the Shield template.`,
    'Replace every example claim and check with those of the project, commit it, then run it.',
  ]);
}

async function runAction(projectDir, kase, options, json) {
  const { file, results, head, authenticated } = await assurance.runChecks(projectDir, kase, {
    dir: options.dir,
    only: options.check,
  });
  const failed = results.filter((result) => result.failures.length);
  print(
    json,
    {
      action: 'run',
      case: kase.id,
      ledger: file,
      head,
      authenticated,
      results: results.map(({ check, failures, record }) => ({
        check,
        status: failures.length ? 'failed' : 'passed',
        failures,
        sequence: record.sequence,
        exitCode: record.exitCode,
        revision: record.revision,
        dirty: record.dirty,
        sha256: record.sha256,
      })),
    },
    [
      `${file}`,
      ...results.map(
        ({ check, failures, record }) =>
          `  ${failures.length ? 'failed' : 'passed'} ${check.padEnd(24)} exit ${record.exitCode ?? '-'} in ${Math.round(record.durationMs / 100) / 10} s${failures.length ? ` — ${failures.join('; ')}` : ''}`
      ),
      ...(results.some(({ record }) => record.dirty !== false)
        ? [
            '  Ran on uncommitted changes, untracked files or outside git: a case bound to a commit will not accept these runs.',
          ]
        : []),
      `Recorded ${results.length} run(s)${authenticated ? ', authenticated by key' : ''}; ledger head ${head}.`,
      `Keep the head outside the ledger and verify with bmad-plus assurance verify ${kase.file} --ledger-head ${head}.`,
    ]
  );
  process.exitCode = failed.length ? 1 : 0;
}

function verifyAction(projectDir, kase, options, json) {
  const verdict = assurance.verifyCase(projectDir, kase, {
    dir: options.dir,
    head: options.ledgerHead ?? null,
  });
  let check = null;
  if (options.emitCheck)
    check = writeCheck(
      projectDir,
      options.emitCheck,
      kase,
      assurance.ledgerFile(projectDir, options.dir, kase.id),
      assurance.checkResult(verdict)
    );
  print(
    json,
    { action: 'verify', ...verdict, check },
    [
      `${kase.id}: ${verdict.status} — ${verdict.claims.filter((c) => c.status === 'supported').length}/${verdict.claims.length} claim(s) supported, ${verdict.ledger.runs} recorded run(s)`,
      ...verdict.reasons.map((reason) => `  - ${reason}`),
      ...Object.entries(verdict.checks)
        .filter(([, judged]) => judged.status !== 'passed')
        .map(([id, judged]) => `  ${judged.status.padEnd(7)} ${id}: ${judged.reasons.join('; ')}`),
      ...verdict.claims
        .filter((claim) => claim.status !== 'supported')
        .map((claim) => `  unsupported claim ${claim.id}: ${claim.reasons.join('; ')}`),
      ...(verdict.controls.supported.length
        ? [`  controls with executed evidence: ${verdict.controls.supported.join(', ')}`]
        : []),
      check ? `  check: ${check}` : '',
    ].filter(Boolean)
  );
  process.exitCode = verdict.exitCode;
}

module.exports = {
  command: 'assurance <action> <case>',
  description: 'Security assurance case bound to executed checks: init, run, verify',
  options: [
    ['-d, --directory <path>', 'Project directory'],
    ['--dir <path>', 'Evidence folder inside the project', assurance.DEFAULT_DIR],
    ['--check <id>', 'run: only this check (repeatable)', (v, all) => [...all, v], []],
    ['--ledger-head <sha256>', 'verify: fail unless the ledger still holds this record'],
    ['--emit-check <file>', 'verify: also write the verdict as a JSON check result for CI'],
    ['--json', 'Machine-readable output'],
  ],
  action: async (action, caseFile, options = {}) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const json = Boolean(options.json);
    const settings = { dir: options.dir || assurance.DEFAULT_DIR, check: options.check || [] };
    try {
      if (!ACTIONS.includes(action))
        throw new Error(`unknown action "${action}" (${ACTIONS.join(', ')})`);
      if (action === 'init') return initAction(projectDir, caseFile, json);
      const kase = assurance.loadCase(projectDir, caseFile);
      if (action === 'run') await runAction(projectDir, kase, settings, json);
      else
        verifyAction(
          projectDir,
          kase,
          { ...settings, emitCheck: options.emitCheck, ledgerHead: options.ledgerHead },
          json
        );
    } catch (error) {
      if (json)
        console.log(
          JSON.stringify({ schemaVersion: 1, status: 'error', message: error.message }, null, 2)
        );
      else console.error(`assurance: ${error.message}`);
      process.exitCode = 3;
    }
  },
};
