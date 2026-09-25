/** The shipped project gates, run as a consumer project would run them. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TEMPLATES = path.resolve(__dirname, '../../src/bmad-plus/skills/bmad-plus-uat/templates');
const CLI = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;

const specHash = (spec) => crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex');

const spec = (version) => ({
  schema: 'bmad-plus/uat-spec/2',
  id: `demo-${version}`,
  product: 'Demo',
  versions: [version],
  language: 'en',
  title: 'The funder is confirmed by a gesture',
  environment: { name: 'DEMO' },
  steps: [
    {
      id: '0-setup',
      title: 'Setup',
      writes: true,
      verify: { kind: 'sql', text: 'select updated_at from company where id = 42' },
      where: ['Open the app.'],
      do: ['Click <span class="ecran">Confirm</span>.'],
      expect: [{ id: 'a', text: 'The line reads <span class="ecran">OPCO confirmed</span>.' }],
    },
  ],
});

function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  return target;
}

function gate(template, args = [], env = {}) {
  const child = spawnSync(
    process.execPath,
    [path.join(TEMPLATES, template), '--project', project, ...args],
    {
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      env: { ...process.env, ...env },
      cwd: project,
    }
  );
  expect(child.error).toBeUndefined();
  return { code: child.status, out: `${child.stdout}${child.stderr}` };
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(tempParent, 'uat-gate-'));
  write('package.json', { name: 'demo', version: '1.4.0' });
});

afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

describe('what the repository ships and stands behind', () => {
  const lint = (specId, dir) => {
    const child = spawnSync(
      process.execPath,
      [CLI, 'uat', 'lint', specId, '--dir', dir, '--src', 'tools', '--src', 'src', '--json'],
      {
        encoding: 'utf8',
        timeout: 120000,
        windowsHide: true,
        cwd: path.resolve(__dirname, '../..'),
      }
    );
    expect(child.error).toBeUndefined();
    return JSON.parse(child.stdout);
  };

  it('the shipped example passes the lint it teaches', () => {
    const report = lint(
      path.resolve(
        __dirname,
        '../../src/bmad-plus/skills/bmad-plus-uat/templates/example-uat-spec.json'
      ),
      'uat'
    );
    expect(report.errors).toEqual([]);
    expect(report.specId).toBe('example-1.0.0');
  });

  // BMAD+'s own recipes stay on the maintainer's machine (recettes/ is ignored by git),
  // so this check runs there and is skipped on a fresh checkout such as CI.
  const ownRecipe = path.resolve(__dirname, '../../recettes/specs/bmad-plus-0.17.0.json');
  (fs.existsSync(ownRecipe) ? it : it.skip)(
    "BMAD+'s own acceptance recipe quotes labels that exist in its source",
    () => {
      const report = lint('bmad-plus-0.17.0', 'recettes');
      expect(report.errors).toEqual([]);
      expect(report.missing).toEqual([]);
      expect(report.labels).toBeGreaterThan(5);
      expect(report.scannedFiles).toBeGreaterThan(100);
    }
  );
});

describe('G1 — a version does not leave without its recipe', () => {
  it('passes when a recipe names the version', () => {
    write('_bmad-output/uat/specs/demo-1.4.0.json', spec('1.4.0'));
    const result = gate('uat-spec-present.mjs');
    expect(result.code).toBe(0);
    expect(result.out).toContain('demo-1.4.0');
  });

  it('fails, and says what to write, when nothing covers it', () => {
    const result = gate('uat-spec-present.mjs');
    expect(result.code).toBe(1);
    expect(result.out).toContain('no acceptance recipe covers 1.4.0');
    expect(result.out).toContain('demo-1.4.0.json'.replace('demo-', '<product>-'));
  });

  it('refuses to infer coverage from a file name', () => {
    // The file is named for a range; it names another version inside.
    write('_bmad-output/uat/specs/demo-1.3.0-1.5.0.json', {
      ...spec('1.3.0'),
      id: 'demo-1.3.0-1.5.0',
    });
    expect(gate('uat-spec-present.mjs').code).toBe(1);

    write('_bmad-output/uat/specs/demo-1.3.0-1.5.0.json', {
      ...spec('1.3.0'),
      id: 'demo-1.3.0-1.5.0',
      versions: ['1.3.0', '1.4.0', '1.5.0'],
    });
    expect(gate('uat-spec-present.mjs').code).toBe(0);
  });

  it('answers in JSON for a pipeline that reads it', () => {
    write('_bmad-output/uat/specs/demo-1.4.0.json', spec('1.4.0'));
    const result = gate('uat-spec-present.mjs', ['--json']);
    expect(JSON.parse(result.out)).toMatchObject({ version: '1.4.0', ok: true });
  });
});

describe('G3 — production waits for a run that was read', () => {
  const env = { BMAD_PLUS_CLI: CLI };

  it('takes the CLI from --cli, from the environment, or from node_modules', () => {
    write('_bmad-output/uat/specs/demo-1.4.0.json', spec('1.4.0'));
    expect(gate('uat-release-gate.mjs', ['--cli', CLI]).code).toBe(2);
    const installed = path.join(project, 'node_modules', 'bmad-plus', 'tools', 'cli');
    fs.mkdirSync(installed, { recursive: true });
    fs.copyFileSync(CLI, path.join(installed, 'bmad-plus-cli.js'));
    // The copied entry point still resolves its own libraries from the repository.
    const found = gate('uat-release-gate.mjs');
    expect([2, 4]).toContain(found.code);
    expect(found.out).not.toContain('EINVAL');
  });

  it('waits while no run is finished', () => {
    write('_bmad-output/uat/specs/demo-1.4.0.json', spec('1.4.0'));
    const result = gate('uat-release-gate.mjs', [], env);
    expect(result.code).toBe(2);
    expect(result.out).toContain('no finished run yet');
  });

  it('passes a finished, current and classified run whose write was confirmed', () => {
    const current = spec('1.4.0');
    write('_bmad-output/uat/specs/demo-1.4.0.json', current);
    write('_bmad-output/uat/results/demo-1.4.0/20260916-sarah-aaaa.json', {
      schema: 'bmad-plus/uat-results/2',
      specId: 'demo-1.4.0',
      specSha256: specHash(current),
      runId: '20260916-sarah-aaaa',
      tester: 'Sarah',
      startedAt: '2026-09-16T08:00:00.000Z',
      updatedAt: '2026-09-16T08:20:00.000Z',
      finishedAt: '2026-09-16T08:20:00.000Z',
      overallNote: '',
      steps: {
        '0-setup': {
          title: 'Setup',
          note: '',
          expect: { a: { text: 'OPCO confirmed', state: 'passed' } },
        },
      },
      summary: { passed: 1, failed: 0, blocked: 0, skipped: 0, unanswered: 0 },
    });
    expect(gate('uat-release-gate.mjs', [], env).code).toBe(1); // the write is not confirmed yet

    write('_bmad-output/uat/triage/demo-1.4.0.json', {
      schema: 'bmad-plus/uat-triage/1',
      specId: 'demo-1.4.0',
      runs: [
        {
          runId: '20260916-sarah-aaaa',
          failures: [],
          writeChecks: [
            { step: '0-setup', verified: true, evidence: 'updated_at = 2026-09-16T08:19Z' },
          ],
        },
      ],
    });
    const passed = gate('uat-release-gate.mjs', [], env);
    expect(passed.code).toBe(0);
    expect(passed.out).toContain('human-observed');
  });

  it('refuses when nothing names the version, and when the gate cannot run at all', () => {
    expect(gate('uat-release-gate.mjs', [], env).code).toBe(4);

    write('_bmad-output/uat/specs/demo-1.4.0.json', spec('1.4.0'));
    const unreachable = gate('uat-release-gate.mjs', [], {
      BMAD_PLUS_CLI: path.join(project, 'no-such-cli.js'),
    });
    expect(unreachable.code).toBe(4);
    expect(unreachable.out).toContain('A missing gate is not a passing gate');
  });
});
