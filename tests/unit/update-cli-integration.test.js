/** Real CLI process boundary: offline discovery, policy, and file protection. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { spawnTimeout } = require('../helpers/process-budget');

// Each test runs up to four CLI processes; scale the limit to slow spawns.
jest.setTimeout(spawnTimeout(4, { floor: 20000 }));

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const version = require('../../package.json').version;
let project;
const manifestPath = () => path.join(project, '_bmad/.bmad-plus-install.json');
const manifest = () => JSON.parse(fs.readFileSync(manifestPath(), 'utf8'));
function run(...args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--directory', project], {
    cwd: project,
    encoding: 'utf8',
    timeout: spawnTimeout(1, { floor: 15000 }),
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  return result;
}
function olderManifest() {
  const value = manifest();
  value.version = '0.0.1';
  fs.writeFileSync(manifestPath(), JSON.stringify(value));
}
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-update-cli '));
  const result = run('install', '--yes', '--packs', 'core', '--tools', 'claude-code');
  expect(result.status).toBe(0);
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

test('fresh installation inventories the actual shipped bytes', () => {
  const inventory = manifest().fileInventory;
  expect(inventory.schemaVersion).toBe(1);
  expect(Object.keys(inventory.files)).toContain('_bmad/module.yaml');
  expect(
    Object.keys(inventory.files).some((file) => file.endsWith('agent-strategist/SKILL.md'))
  ).toBe(true);
  for (const [file, hash] of Object.entries(inventory.files)) {
    expect(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(project, file)))
        .digest('hex')
    ).toBe(hash);
  }
});

test('offline JSON distinguishes unknown published version from matching local versions', () => {
  const result = run('update-check', '--offline', '--json');
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    installedVersion: version,
    runningVersion: version,
    status: 'unknown',
    latestVersion: null,
    updateAvailable: null,
    canAutoApply: false,
  });
  expect(fs.existsSync(path.join(project, '.bmad/update-check.json'))).toBe(false);
});

test('policy requires an explicit auto range and can disable discovery', () => {
  expect(JSON.parse(run('update-policy', '--json').stdout).policy.mode).toBe('notify');
  const invalid = run('update-policy', '--mode', 'auto', '--json');
  expect(invalid.status).toBe(1);
  expect(JSON.parse(invalid.stdout).error).toContain('--range');
  expect(fs.existsSync(path.join(project, '_bmad/update-policy.json'))).toBe(false);
  expect(run('update-policy', '--mode', 'off', '--json').status).toBe(0);
  const disabled = run('update-check', '--refresh', '--json');
  expect(disabled.status).toBe(0);
  expect(JSON.parse(disabled.stdout)).toMatchObject({
    status: 'off',
    canAutoApply: false,
    source: 'none',
  });
});

test('automatic application refuses a customized skill before changing the manifest', () => {
  olderManifest();
  expect(run('update-policy', '--mode', 'auto', '--range', version, '--json').status).toBe(0);
  const skill = path.join(project, '.agents/skills/agent-strategist/SKILL.md');
  fs.appendFileSync(skill, '\nMy project-specific agent instruction.\n');
  const beforeSkill = fs.readFileSync(skill);
  const beforeManifest = fs.readFileSync(manifestPath());
  const result = run('update', '--auto', '--expected-version', version);
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toMatch(/conflict|modified/i);
  expect(fs.readFileSync(skill)).toEqual(beforeSkill);
  expect(fs.readFileSync(manifestPath())).toEqual(beforeManifest);
});

test('manual update keeps customized skills and records a recoverable receipt', () => {
  olderManifest();
  const skill = path.join(project, '.agents/skills/agent-strategist/SKILL.md');
  fs.appendFileSync(skill, '\nKeep this customized behavior.\n');
  const before = fs.readFileSync(skill);
  const result = run('update', '--yes', '--expected-version', version);
  expect(result.status).toBe(0);
  expect(fs.readFileSync(skill)).toEqual(before);
  expect(manifest().version).toBe(version);
  const directory = path.join(project, '.bmad/updates');
  const receipts = fs
    .readdirSync(directory)
    .map((id) => JSON.parse(fs.readFileSync(path.join(directory, id, 'receipt.json'), 'utf8')));
  expect(receipts).toHaveLength(1);
  expect(
    receipts[0].conflicts.some((conflict) => conflict.file.endsWith('agent-strategist/SKILL.md'))
  ).toBe(true);
  expect(run('update', '--restore', receipts[0].id, '--yes').status).toBe(0);
  expect(manifest().version).toBe('0.0.1');
  expect(fs.readFileSync(skill)).toEqual(before);
});

test('wrong executing version and downgrade both fail before changing files', () => {
  const initial = fs.readFileSync(manifestPath());
  expect(run('update', '--yes', '--expected-version', '999.0.0').status).toBe(1);
  expect(fs.readFileSync(manifestPath())).toEqual(initial);
  const value = manifest();
  value.version = '999.0.0';
  fs.writeFileSync(manifestPath(), JSON.stringify(value));
  const newer = fs.readFileSync(manifestPath());
  expect(run('update', '--yes').status).toBe(1);
  expect(fs.readFileSync(manifestPath())).toEqual(newer);
});

test('outside an installed project, update commands say where to run them', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-not-installed '));
  try {
    const runIn = (...args) =>
      spawnSync(process.execPath, [cli, ...args], {
        cwd: empty,
        encoding: 'utf8',
        timeout: spawnTimeout(1, { floor: 15000 }),
        windowsHide: true,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    const check = runIn('update-check', '--offline', '--json');
    expect(check.status).toBe(1);
    expect(JSON.parse(check.stdout).reason).toBe('missing-or-invalid-installation-manifest');
    expect(check.stderr).toContain('No BMAD+ installation found in');
    expect(check.stderr).toContain('--directory');

    const update = runIn('update', '--latest');
    expect(update.status).not.toBe(0);
    expect(update.stdout + update.stderr).toContain('No BMAD+ installation found in');
    expect(update.stdout + update.stderr).not.toContain('ENOENT');
    expect(fs.readdirSync(empty)).toEqual([]);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
