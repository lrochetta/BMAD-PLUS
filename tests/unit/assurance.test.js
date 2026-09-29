/** Assurance cases: evidence is a recorded, current, passing check run — nothing else. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const assurance = require('../../tools/cli/lib/assurance');

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const template = path.resolve(
  __dirname,
  '../../src/bmad-plus/packs/pack-shield/shared/assurance-case-template.yaml'
);
const node = process.execPath;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
let repo;

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
};
const commit = (message) => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
};

/** A small case: C1 rests on C1.1 (a test run) and C1.2 (a scan that writes a report). */
function caseDoc(overrides = {}) {
  return {
    schema: 'bmad-plus/assurance-case/1',
    id: 'demo',
    title: 'Demo case',
    scope: 'The demo repository at HEAD.',
    checks: [
      { id: 'tests', run: [node, '-e', "process.stdout.write('ok')"] },
      {
        id: 'scan',
        run: [node, '-e', "require('fs').writeFileSync('report.txt', 'clean')"],
        artifacts: ['report.txt'],
      },
    ],
    claims: [
      { id: 'C1', claim: 'The demo is safe to ship.', argument: 'Both sub-claims hold.' },
      {
        id: 'C1.1',
        parent: 'C1',
        claim: 'Its tests pass.',
        argument: 'The suite exits zero only when every test passes.',
        controls: ['ISO27001:A.8.29'],
        evidence: [{ check: 'tests', shows: 'The suite passes.' }],
      },
      {
        id: 'C1.2',
        parent: 'C1',
        claim: 'No secret is committed.',
        argument: 'The scan exits non-zero on a secret.',
        controls: ['ISO27001:A.5.17'],
        evidence: [{ check: 'scan', shows: 'The scan is clean.' }],
      },
    ],
    ...overrides,
  };
}
const saveCase = (doc = caseDoc()) => write('_bmad/assurance/demo.yaml', yaml.dump(doc));
const load = () => assurance.loadCase(repo, '_bmad/assurance/demo.yaml');
const run = (options) => assurance.runChecks(repo, load(), options);
const verify = (options) => assurance.verifyCase(repo, load(), options);
const ledger = () => path.join(repo, '_bmad-output/assurance/demo/runs.jsonl');

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'assurance-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  write('.gitignore', '_bmad-output/\nreport.txt\n');
  write('src/app.js', 'module.exports = 1;\n');
  saveCase();
  commit('base');
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('an assurance case', () => {
  const refuse = (doc, reason) => expect(() => assurance.parseCase(doc)).toThrow(reason);

  it('refuses evidence that is only asserted', () => {
    const doc = caseDoc();
    doc.claims[1].evidence = [{ statement: 'We ran the tests last week.' }];
    refuse(doc, /evidence must name a check that runs.*only asserted/);
    doc.claims[1].evidence = ['https://ci.example/run/42'];
    refuse(doc, /evidence must name a check/);
  });

  it('refuses a claim with neither evidence nor sub-claims', () => {
    const doc = caseDoc();
    doc.claims.push({ id: 'C2', claim: 'Backups work.', argument: 'They always have.' });
    refuse(doc, /claim C2 is only asserted/);
  });

  it('refuses undeclared checks, shell strings, escaping folders and invented controls', () => {
    const doc = caseDoc();
    doc.claims[1].evidence = [{ check: 'lint', shows: 'Lint passes.' }];
    refuse(doc, /check lint is not declared/);
    refuse(caseDoc({ checks: [{ id: 'tests', run: 'npm test' }] }), /list of arguments/);
    refuse(
      caseDoc({ checks: [{ id: 'tests', run: [node], cwd: '../elsewhere' }] }),
      /inside the project/
    );
    const invented = caseDoc();
    invented.claims[1].controls = ['ISO27001:A.8.99'];
    refuse(invented, /names no ISO27001 control/);
    const orphan = caseDoc();
    orphan.claims[1].parent = 'C9';
    refuse(orphan, /parent C9 must be a claim declared before it/);
    refuse(caseDoc({ owner: 'me' }), /unknown key/);
    refuse(
      caseDoc({ checks: [{ id: 'tests', run: [node], env: ['BMAD_PLUS_ASSURANCE_KEY'] }] }),
      /BMAD_PLUS_ASSURANCE_KEY is never passed to a check/
    );
  });

  it('starts from the template under the id its file names, and never overwrites', () => {
    const made = assurance.initCase(repo, '_bmad/assurance/api-release.yaml');
    expect(made).toEqual({ file: '_bmad/assurance/api-release.yaml', id: 'api-release' });
    expect(assurance.loadCase(repo, made.file).id).toBe('api-release');
    expect(() => assurance.initCase(repo, made.file)).toThrow(/already exists/);
    expect(() => assurance.initCase(repo, '_bmad/assurance/Release.yaml')).toThrow(
      /name it <id>\.yaml/
    );
    expect(() => assurance.initCase(repo, '_bmad/assurance/notes.txt')).toThrow(/name it/);
    expect(() => assurance.initCase(repo, '../elsewhere.yaml')).toThrow(/inside the project/);
  });

  it('ships a Shield template that is itself a valid case', () => {
    const kase = assurance.parseCase(yaml.load(fs.readFileSync(template, 'utf8')));
    expect(kase.claims.size).toBeGreaterThanOrEqual(3);
    for (const claim of kase.claims.values())
      if (claim.parent) expect(claim.evidence.length).toBeGreaterThan(0);
  });
});

describe('running and verifying', () => {
  it('records each run in a hash chain and supports the case at the same commit', async () => {
    const { results } = await run();
    expect(results.map((r) => [r.check, r.failures])).toEqual([
      ['tests', []],
      ['scan', []],
    ]);
    const records = fs
      .readFileSync(ledger(), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      schema: 'bmad-plus/assurance-run/1',
      check: 'tests',
      sequence: 1,
      exitCode: 0,
      revision: git('rev-parse', 'HEAD'),
      dirty: false,
      previous: null,
    });
    expect(records[0].output.sha256).toBe(sha256('ok'));
    expect(records[1].previous).toBe(records[0].sha256);
    expect(records[1].artifacts['report.txt']).toBe(sha256('clean'));

    const verdict = verify();
    expect(verdict.status).toBe('supported');
    expect(verdict.exitCode).toBe(0);
    expect(verdict.claims.map((c) => c.status)).toEqual(['supported', 'supported', 'supported']);
    expect(verdict.controls.supported).toEqual(['ISO27001:A.8.29', 'ISO27001:A.5.17']);
  });

  it('marks evidence missing until the check has run', () => {
    const verdict = verify();
    expect(verdict.status).toBe('unsupported');
    expect(verdict.checks.tests).toMatchObject({ status: 'missing' });
    expect(verdict.claims[0].reasons).toEqual([
      'sub-claim C1.1 is unsupported',
      'sub-claim C1.2 is unsupported',
    ]);
    expect(verdict.claims[1].reasons).toEqual(['evidence tests is missing']);
  });

  it('marks a check failed on an unexpected exit code, a timeout or a missing artifact', async () => {
    const doc = caseDoc();
    doc.checks[0].run = [node, '-e', 'process.exit(2)'];
    doc.checks[1].run = [node, '-e', 'setTimeout(() => {}, 20000)'];
    doc.checks[1].timeoutSeconds = 1;
    saveCase(doc);
    commit('failing checks');
    const { results } = await run();
    expect(results[0].failures).toEqual(['exit code 2, expected 0']);
    expect(results[1].failures).toEqual([
      'it timed out after 1 s',
      'artifact report.txt was not produced by the run',
    ]);
    const verdict = verify();
    expect(verdict.checks.tests.status).toBe('failed');
    expect(verdict.checks.scan.status).toBe('failed');
    expect(verdict.status).toBe('unsupported');
  }, 20000);

  it('marks evidence stale after a new commit, a changed command, a changed artifact or with age', async () => {
    await run();
    expect(verify().status).toBe('supported');

    write('src/app.js', 'module.exports = 2;\n');
    commit('new code');
    expect(verify().checks.tests.reasons[0]).toMatch(/^it ran at [0-9a-f]{12}, not at /);
    await run();
    expect(verify().status).toBe('supported');

    fs.writeFileSync(path.join(repo, 'report.txt'), 'edited by hand');
    expect(verify().checks.scan).toMatchObject({
      status: 'stale',
      reasons: ['artifact report.txt changed since the run'],
    });
    await run({ only: ['scan'] });

    const later = new Date(Date.now() + 31 * 24 * 3600 * 1000);
    expect(verify({ now: () => later }).checks.tests.reasons).toEqual([
      'it ran 31 days ago; the case accepts 30',
    ]);

    const doc = caseDoc();
    doc.checks[0].run = [node, '-e', "process.stdout.write('changed')"];
    saveCase(doc);
    commit('changed command');
    expect(verify().checks.tests.reasons).toContain('its command changed since it ran');
  });

  it('refuses evidence from, or a verdict on, uncommitted changes', async () => {
    write('src/app.js', 'module.exports = 3;\n');
    await run();
    const verdict = verify();
    expect(verdict.reasons).toEqual([
      'the working tree has uncommitted changes or untracked files: the evidence describes the commit, not this working tree',
    ]);
    expect(verdict.checks.tests.reasons).toContain(
      'it ran on uncommitted changes, untracked files or outside git'
    );
  });

  it('refuses a ledger edited after the fact, and records nothing more into it', async () => {
    await run();
    const lines = fs.readFileSync(ledger(), 'utf8').trim().split('\n');
    const forged = JSON.parse(lines[0]);
    forged.exitCode = 0;
    forged.output.bytes = 999;
    fs.writeFileSync(ledger(), [JSON.stringify(forged), lines[1]].join('\n') + '\n');
    let verdict = verify();
    expect(verdict.status).toBe('unsupported');
    expect(verdict.reasons[0]).toMatch(/record 1 .* was altered after it was written/);
    await expect(run()).rejects.toThrow(/is not intact/);

    fs.writeFileSync(ledger(), `${lines[1]}\n`);
    verdict = verify();
    expect(verdict.reasons[0]).toMatch(/out of sequence/);
  });

  it('notices runs removed from the end of the ledger when verified against the head of a run', async () => {
    const doc = caseDoc();
    doc.checks[0].run = [node, '-e', "process.exit(require('fs').existsSync('override') ? 1 : 0)"];
    saveCase(doc);
    write('.gitignore', '_bmad-output/\nreport.txt\noverride\n');
    commit('a check an ignored file can fail');
    const first = await run();
    expect(first.head).toMatch(/^[0-9a-f]{64}$/);
    write('override', '');
    const second = await run({ only: ['tests'] });
    expect(second.results[0].failures).toEqual(['exit code 1, expected 0']);
    expect(verify({ head: second.head }).status).toBe('unsupported');

    // The failed run is erased: the chain that is left is valid, so only the head shows it.
    const lines = fs.readFileSync(ledger(), 'utf8').trim().split('\n');
    fs.writeFileSync(ledger(), `${lines.slice(0, 2).join('\n')}\n`);
    expect(verify().status).toBe('supported');
    const anchored = verify({ head: second.head });
    expect(anchored.status).toBe('unsupported');
    expect(anchored.reasons).toEqual([
      `the ledger no longer holds the head ${second.head.slice(0, 12)} it was anchored to: runs were removed or the ledger replaced`,
    ]);
    expect(anchored.ledger.anchor).toBe(second.head);
    expect(verify({ head: first.head }).status).toBe('supported');
    expect(() => verify({ head: 'ABC' })).toThrow(/64 lowercase hexadecimal/);
  });

  it('with a key, accepts only records the key authenticates', async () => {
    const key = 'assurance-test-key-'.padEnd(40, 'x');
    await run({ key: null });
    expect(verify({ key: null }).status).toBe('supported');
    let verdict = verify({ key });
    expect(verdict.status).toBe('unsupported');
    expect(verdict.reasons[0]).toMatch(
      /record 1 .* is not authenticated by BMAD_PLUS_ASSURANCE_KEY/
    );
    await expect(run({ key })).rejects.toThrow(/is not intact/);

    fs.rmSync(ledger());
    const { head } = await run({ key });
    verdict = verify({ key, head });
    expect(verdict).toMatchObject({ status: 'supported', ledger: { authenticated: true } });
    expect(verify({ key: key.replace(/x$/, 'y') }).status).toBe('unsupported');

    // Whoever can write the ledger but lacks the key can recompute the digest, not the HMAC.
    const lines = fs.readFileSync(ledger(), 'utf8').trim().split('\n');
    const body = JSON.parse(lines[0]);
    const mac = body.hmac;
    delete body.hmac;
    delete body.sha256;
    body.output = { ...body.output, excerpt: 'forged' };
    const forged = { ...body, hmac: mac, sha256: sha256(JSON.stringify(body)) };
    fs.writeFileSync(ledger(), `${JSON.stringify(forged)}\n`);
    expect(verify({ key: null }).checks.tests.status).toBe('passed');
    expect(verify({ key }).reasons[0]).toMatch(/record 1 .* is not authenticated/);
    expect(() => verify({ key: 'short' })).toThrow(/at least 32 characters/);
  });

  it('counts an untracked file as a change to the commit, but not what the case writes', async () => {
    write('override', 'on');
    const { results } = await run();
    expect(results[0].record.dirty).toBe(true);
    fs.rmSync(path.join(repo, 'override'));
    expect(verify().checks.tests.reasons).toEqual([
      'it ran on uncommitted changes, untracked files or outside git',
    ]);

    // Neither the ledger nor the declared artifact is ignored now: they still do not count.
    fs.rmSync(path.join(repo, '_bmad-output'), { recursive: true });
    fs.rmSync(path.join(repo, 'report.txt'));
    write('.gitignore', 'node_modules/\n');
    commit('nothing of the case ignored');
    await run();
    expect(verify().status).toBe('supported');
    write('notes.txt', 'untracked');
    expect(verify().reasons[0]).toMatch(
      /^the working tree has uncommitted changes or untracked files/
    );
  });

  it('does not take an artifact left from before the run as produced by it', async () => {
    const doc = caseDoc();
    doc.checks[1].run = [node, '-e', '0'];
    saveCase(doc);
    commit('a scan that writes nothing');
    write('report.txt', 'clean');
    const { results } = await run();
    expect(results[1].failures).toEqual(['artifact report.txt was not produced by the run']);
    expect(results[1].record.artifacts['report.txt']).toBeNull();
    expect(verify().checks.scan.status).toBe('failed');
  });

  it('passes only named variables to a check and redacts the output excerpt', async () => {
    process.env.ASSURANCE_TEST_TOKEN = 'present';
    try {
      const probe =
        "process.stdout.write('password=' + 'hunter2hunter2'); process.exit(process.env.ASSURANCE_TEST_TOKEN ? 7 : 0)";
      const doc = caseDoc();
      doc.checks[0].run = [node, '-e', probe];
      saveCase(doc);
      commit('probe');
      let { results } = await run({ only: ['tests'] });
      expect(results[0].record.exitCode).toBe(0);
      expect(results[0].record.output.excerpt).toBe('password=[REDACTED]');
      doc.checks[0].env = ['ASSURANCE_TEST_TOKEN'];
      saveCase(doc);
      commit('declare the variable');
      ({ results } = await run({ only: ['tests'] }));
      expect(results[0].record.exitCode).toBe(7);
      expect(results[0].record.env).toEqual(['ASSURANCE_TEST_TOKEN']);
    } finally {
      delete process.env.ASSURANCE_TEST_TOKEN;
    }
  });
});

describe('bmad-plus assurance', () => {
  const cliRun = (...args) => {
    const r = spawnSync(node, [cli, 'assurance', ...args, '--directory', repo, '--json'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
    return { code: r.status, value: r.stdout.trim() ? JSON.parse(r.stdout) : null };
  };

  it('runs, verifies with exit codes, and emits a CI check', () => {
    expect(cliRun('verify', '_bmad/assurance/demo.yaml').code).toBe(1);
    const ran = cliRun('run', '_bmad/assurance/demo.yaml');
    expect(ran.code).toBe(0);
    expect(ran.value.results.map((r) => r.status)).toEqual(['passed', 'passed']);
    expect(ran.value).toMatchObject({ head: ran.value.results[1].sha256, authenticated: false });
    const verified = cliRun(
      'verify',
      '_bmad/assurance/demo.yaml',
      '--ledger-head',
      ran.value.head,
      '--emit-check',
      '_bmad-output/demo.check.json'
    );
    expect(verified.code).toBe(0);
    expect(verified.value.status).toBe('supported');
    const check = JSON.parse(
      fs.readFileSync(path.join(repo, '_bmad-output/demo.check.json'), 'utf8')
    );
    expect(check).toMatchObject({
      schema: 'bmad-plus/assurance-check/1',
      status: 'supported',
      ledger: { runs: 2, head: ran.value.head, anchor: ran.value.head, authenticated: false },
      github: { conclusion: 'success' },
    });
    expect(
      cliRun('verify', '_bmad/assurance/demo.yaml', '--ledger-head', 'f'.repeat(64)).code
    ).toBe(1);
    expect(cliRun('verify', '_bmad/assurance/demo.yaml', '--ledger-head', 'nope').code).toBe(3);
    expect(cliRun('init', '_bmad/assurance/second.yaml').value).toMatchObject({
      action: 'init',
      case: 'second',
    });
    expect(cliRun('init', '_bmad/assurance/second.yaml').code).toBe(3);
    expect(
      cliRun('verify', '_bmad/assurance/demo.yaml', '--emit-check', '_bmad/assurance/demo.yaml')
        .code
    ).toBe(3);
    expect(cliRun('verify', '../outside.yaml').code).toBe(3);
  });
});
