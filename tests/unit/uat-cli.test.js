/** The uat command through a real separate process: exit codes are the contract. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;

const spec = {
  schema: 'bmad-plus/uat-spec/2',
  id: 'demo-1.0.0',
  product: 'Demo',
  versions: ['1.0.0'],
  language: 'en',
  title: 'The funder is confirmed by a gesture, never in silence',
  environment: { name: 'DEMO', url: 'https://demo.example' },
  estimate: '5 min',
  steps: [
    {
      id: '0-setup',
      title: 'Setup',
      where: ['Open <span class="ecran">Folders</span>.'],
      do: ['Sign in.'],
      expect: [{ id: 'a', text: 'I am signed in.' }],
    },
    {
      id: '1-confirm',
      title: 'Confirm',
      writes: true,
      verify: { kind: 'sql', text: 'select updated_at from company where id = 42' },
      where: ['Company <span class="ecran">KREISKER</span>.'],
      do: ['Click <span class="ecran">Confirm</span>.'],
      expect: [{ id: 'a', text: 'The line reads <span class="ecran">OPCO confirmed</span>.' }],
    },
  ],
};

function run(args, { json = true } = {}) {
  const child = spawnSync(
    process.execPath,
    [cli, ...args, '--directory', project, ...(json ? ['--json'] : [])],
    {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    }
  );
  expect(child.error).toBeUndefined();
  return {
    code: child.status,
    value: json && child.stdout.trim() ? JSON.parse(child.stdout) : child.stdout,
    stderr: child.stderr,
  };
}

function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  return target;
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(tempParent, 'uat-cli-'));
  write('_bmad-output/uat/specs/demo-1.0.0.json', spec);
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

describe('lint', () => {
  it('passes a valid spec and refuses one that would be ignored in silence', () => {
    expect(run(['uat', 'lint', 'demo-1.0.0']).code).toBe(0);

    write('_bmad-output/uat/specs/broken-1.0.0.json', { ...spec, id: 'broken-1.0.0', stpes: [] });
    const broken = run(['uat', 'lint', 'broken-1.0.0']);
    expect(broken.code).toBe(1);
    expect(broken.value.errors.join(' ')).toContain('unknown key');
  });

  it('reports a quoted label that exists in no source file', () => {
    write(
      'src/Component.tsx',
      'const a = "Folders"; const b = "Confirm"; const c = "OPCO confirmed";'
    );
    const report = run(['uat', 'lint', 'demo-1.0.0', '--src', path.join(project, 'src')]);
    expect(report.code).toBe(1);
    expect(report.value.missing.map((entry) => entry.label)).toEqual(['KREISKER']);
  });
});

describe('finding a recipe', () => {
  it('finds a recipe by its id even when its file carries another name', () => {
    // The shipped template is example-uat-spec.json and holds the id example-1.0.0:
    // a tester who copies it and builds by id must not be told there is no spec.
    fs.renameSync(
      path.join(project, '_bmad-output/uat/specs/demo-1.0.0.json'),
      path.join(project, '_bmad-output/uat/specs/copied-template.json')
    );
    const built = run(['uat', 'build', 'demo-1.0.0']);
    expect(built.code).toBe(0);
    expect(built.value.specId).toBe('demo-1.0.0');
    expect(run(['uat', 'lint', 'no-such-recipe']).value.message).toContain('no spec with the id');
  });
});

describe('build', () => {
  it('writes a self-contained page bound to the spec revision', () => {
    const built = run(['uat', 'build', 'demo-1.0.0']);
    expect(built.code).toBe(0);
    const html = fs.readFileSync(built.value.file, 'utf8');
    expect(html).toContain(built.value.specSha256);
    expect(html).not.toContain('__SPEC_JSON__');
    expect(html).toContain('OPCO confirmed');
    // The delivery report can say which protections the page carries, by name.
    expect(built.value.guarantees).toEqual(expect.arrayContaining(['verified-local-write']));
  });

  it('writes nothing when the spec has an error', () => {
    write('_bmad-output/uat/specs/unsafe-1.0.0.json', {
      ...spec,
      id: 'unsafe-1.0.0',
      steps: [{ ...spec.steps[0], expect: [{ id: 'a', text: '<script>alert(1)</script>' }] }],
    });
    expect(run(['uat', 'build', 'unsafe-1.0.0']).code).toBe(1);
    expect(fs.existsSync(path.join(project, '_bmad-output/uat/pages/uat-unsafe-1.0.0.html'))).toBe(
      false
    );
  });
});

describe('import, read and gate', () => {
  const legacyRun = {
    schema: 'recette-interactive/resultats/1',
    testeur: 'Sarah',
    demarreLe: '2026-09-16T08:00:00.000Z',
    misAJourLe: '2026-09-16T08:20:00.000Z',
    termineLe: '2026-09-16T08:20:00.000Z',
    etapes: {
      '0-setup': { titre: 'Setup', attendus: { a: true }, verdict: 'OK', note: '' },
      '1-confirm': {
        titre: 'Confirm',
        attendus: { a: false },
        verdict: 'KO',
        note: 'the line still reads OPCO to confirm',
      },
    },
    resume: { vus: 1, pasVus: 1, aFaire: 0 },
  };

  it('imports a legacy export whose run id lives in the file name', () => {
    const file = write('inbox/resultats-demo-1.0.0-20260916-sarah-aaaa.json', legacyRun);
    const imported = run(['uat', 'import', 'demo-1.0.0', '--input', file]);
    expect(imported.code).toBe(0);
    expect(imported.value.runId).toBe('20260916-sarah-aaaa');
    expect(imported.value.summary).toEqual({
      passed: 1,
      failed: 1,
      blocked: 0,
      skipped: 0,
      unanswered: 0,
    });
  });

  it('waits before there is any run, then reports the failure with its text', () => {
    expect(run(['uat', 'read', 'demo-1.0.0']).code).toBe(2);

    write('inbox/resultats-demo-1.0.0-20260916-sarah-aaaa.json', legacyRun);
    run([
      'uat',
      'import',
      'demo-1.0.0',
      '--input',
      path.join(project, 'inbox/resultats-demo-1.0.0-20260916-sarah-aaaa.json'),
    ]);

    const read = run(['uat', 'read', 'demo-1.0.0']);
    expect(read.code).toBe(1);
    const [failure] = read.value.runs[0].failures;
    expect(failure).toMatchObject({ step: '1-confirm', expect: 'a', state: 'failed' });
    expect(failure.text).toContain('OPCO confirmed');
    expect(failure.note).toContain('OPCO to confirm');
  });

  it('keeps the gate red until the failure is classified and the write confirmed', () => {
    const file = write('inbox/resultats-demo-1.0.0-20260916-sarah-aaaa.json', legacyRun);
    run(['uat', 'import', 'demo-1.0.0', '--input', file]);

    const untriaged = run(['uat', 'gate', 'demo-1.0.0']);
    expect(untriaged.code).toBe(1);
    expect(untriaged.value.reasons.join(' ')).toContain('not triaged');

    write('_bmad-output/uat/triage/demo-1.0.0.json', {
      schema: 'bmad-plus/uat-triage/1',
      specId: 'demo-1.0.0',
      runs: [
        {
          runId: '20260916-sarah-aaaa',
          failures: [
            {
              step: '1-confirm',
              expect: 'a',
              class: 'product',
              decision: 'fix',
              fixRef: 'story-3',
            },
          ],
          writeChecks: [],
        },
      ],
    });
    const triaged = run(['uat', 'gate', 'demo-1.0.0']);
    expect(triaged.code).toBe(0);
    expect(triaged.value.status).toBe('passed');
  });

  it('emits a self-contained verifier for Nexus', () => {
    const emitted = run(['uat', 'gate', 'demo-1.0.0', '--emit-check']);
    expect(emitted.code).toBe(2);
    const source = fs.readFileSync(emitted.value.check, 'utf8');
    expect(source).toContain('"demo-1.0.0"');
    expect(source).not.toContain("require('../lib/uat')");
    const child = spawnSync(process.execPath, [emitted.value.check], {
      cwd: project,
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
    expect(child.status).toBe(1);
  });
});

describe('page language', () => {
  const { language, ...withoutLanguage } = spec;
  void language;

  it('opens in the project language, and still carries every other one', () => {
    write('_bmad-output/uat/specs/demo-2.0.0.json', { ...withoutLanguage, id: 'demo-2.0.0' });
    write('_bmad/config.yaml', 'communication_language: "Français"\n');
    const built = run(['uat', 'build', 'demo-2.0.0']);
    expect(built.code).toBe(0);
    expect(built.value.language).toBe('fr');
    expect(built.value.languages).toHaveLength(10);
    const html = fs.readFileSync(built.value.file, 'utf8');
    expect(html).toContain('<html lang="fr" dir="ltr">');
    expect(html).toContain('Pas vu');
  });

  it('lets the recipe and the command decide instead', () => {
    write('_bmad/config.yaml', 'communication_language: "Français"\n');
    expect(run(['uat', 'build', 'demo-1.0.0']).value.language).toBe('en');
    write('_bmad-output/uat/specs/demo-2.0.0.json', { ...withoutLanguage, id: 'demo-2.0.0' });
    const hebrew = run(['uat', 'build', 'demo-2.0.0', '--language', 'he']);
    expect(hebrew.value.language).toBe('he');
    expect(fs.readFileSync(hebrew.value.file, 'utf8')).toContain('<html lang="he" dir="rtl">');
  });
});

describe('serve', () => {
  const { spawn } = require('node:child_process');
  const http = require('node:http');
  const { URL } = require('node:url');
  let child = null;
  let origin = null;

  const request = (method, pathname, { body, host } = {}) =>
    new Promise((resolve, reject) => {
      const url = new URL(pathname, origin);
      const req = http.request(
        {
          host: url.hostname,
          port: url.port,
          method,
          path: url.pathname,
          headers: {
            'content-type': 'application/json',
            ...(host ? { host } : {}),
          },
        },
        (res) => {
          let text = '';
          res.on('data', (chunk) => {
            text += chunk;
          });
          res.on('end', () => resolve({ status: res.statusCode, text }));
        }
      );
      req.on('error', reject);
      if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    });

  const results = (runId) =>
    path.join(project, '_bmad-output/uat/results/demo-1.0.0', `${runId}.json`);
  const pageRun = (over = {}) => ({
    schema: 'bmad-plus/uat-results/2',
    specId: 'demo-1.0.0',
    runId: '20260925-sarah-aaaa',
    tester: 'Sarah',
    startedAt: '2026-09-25T08:00:00.000Z',
    updatedAt: '2026-09-25T08:10:00.000Z',
    finishedAt: null,
    overallNote: '',
    steps: {
      '0-setup': {
        title: 'Setup',
        note: '',
        expect: { a: { text: 'x', state: 'passed', note: '' } },
      },
      '1-confirm': {
        title: 'Confirm',
        note: '',
        expect: { a: { text: 'y', state: null, note: '' } },
      },
    },
    summary: { passed: 1, failed: 0, blocked: 0, skipped: 0, unanswered: 1 },
    ...over,
  });

  beforeEach(async () => {
    expect(run(['uat', 'build', 'demo-1.0.0']).code).toBe(0);
    child = spawn(
      process.execPath,
      [cli, 'uat', 'serve', 'demo-1.0.0', '--directory', project, '--port', '0'],
      { windowsHide: true }
    );
    origin = await new Promise((resolve, reject) => {
      let out = '';
      const deadline = setTimeout(() => reject(new Error(`serve did not start: ${out}`)), 15000);
      deadline.unref();
      child.stdout.on('data', (chunk) => {
        out += chunk;
        const found = /uat serve: (http:\/\/127\.0\.0\.1:\d+)/.exec(out);
        if (found) {
          clearTimeout(deadline);
          resolve(found[1]);
        }
      });
      child.on('exit', (code) => reject(new Error(`serve exited with ${code}: ${out}`)));
    });
  });

  afterEach(() => {
    if (child) child.kill();
    child = null;
  });

  it('answers the probe, stores a valid run, and refuses the wrong run, an older copy and a foreign host', async () => {
    const ping = await request('GET', '/__uat/ping');
    expect(ping.status).toBe(200);
    expect(JSON.parse(ping.text)).toMatchObject({ uat: true, specId: 'demo-1.0.0' });

    const stored = await request('PUT', '/__uat/results/20260925-sarah-aaaa', { body: pageRun() });
    expect(stored.status).toBe(200);
    expect(JSON.parse(stored.text)).toEqual({ stored: '20260925-sarah-aaaa' });
    const onDisk = JSON.parse(fs.readFileSync(results('20260925-sarah-aaaa'), 'utf8'));
    expect(onDisk.steps['0-setup'].expect.a.state).toBe('passed');
    expect(onDisk.summary.unanswered).toBe(1);

    // The URL names the run; a body naming another one is refused and writes nothing.
    const wrong = await request('PUT', '/__uat/results/20260925-sarah-bbbb', { body: pageRun() });
    expect(wrong.status).toBe(400);
    expect(fs.existsSync(results('20260925-sarah-bbbb'))).toBe(false);

    // The page's rule holds on disk: an older copy never replaces a newer file.
    const older = await request('PUT', '/__uat/results/20260925-sarah-aaaa', {
      body: pageRun({ updatedAt: '2026-09-25T08:00:00.000Z', steps: pageRun().steps }),
    });
    expect(older.status).toBe(409);
    expect(JSON.parse(fs.readFileSync(results('20260925-sarah-aaaa'), 'utf8')).updatedAt).toBe(
      '2026-09-25T08:10:00.000Z'
    );
    const newer = await request('PUT', '/__uat/results/20260925-sarah-aaaa', {
      body: pageRun({ updatedAt: '2026-09-25T08:20:00.000Z' }),
    });
    expect(newer.status).toBe(200);

    // A name rebound to the loopback address is not this server's name.
    const foreign = await request('GET', '/__uat/ping', { host: 'evil.example:80' });
    expect(foreign.status).toBe(403);
  });
});

describe('command surface', () => {
  it('answers to the French alias', () => {
    expect(run(['recette', 'read', 'demo-1.0.0']).code).toBe(2);
  });

  it('refuses an unknown action instead of guessing', () => {
    const unknown = run(['uat', 'play', 'demo-1.0.0']);
    expect(unknown.code).toBe(1);
    expect(unknown.value.message).toContain('unknown action');
  });
});
