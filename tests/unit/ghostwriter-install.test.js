/** Ghostwriter through the public installer, doctor, update and removal commands. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawnTimeout, removeTree } = require('../helpers/process-budget');

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const version = require('../../package.json').version;
const pack = '.agents/skills/pack-ghostwriter';
const skills = ['voice', 'write', 'edit', 'humanize', 'localize', 'verify'];
const manifest = '_bmad/.bmad-plus-install.json';
let project;

jest.setTimeout(spawnTimeout(4, { floor: 25000 }));

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-ghostwriter-install-'));
});
afterEach(() => removeTree(project, { force: true }));

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args, '--directory', project], {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    timeout: spawnTimeout(1, { floor: 15000 }),
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== expectedStatus) {
    throw new Error(`${args[0]} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function install(packId) {
  run(['install', '--yes', '--packs', packId, '--tools', 'claude-code']);
}

function read(file) {
  return fs.readFileSync(path.join(project, file), 'utf8');
}

function write(file, content) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

test('an optional install inventories the routes, and doctor identifies a missing workflow', () => {
  install('core');
  expect(fs.existsSync(path.join(project, pack))).toBe(false);
  expect(JSON.parse(read(manifest)).packs).not.toContain('ghostwriter');

  install('ghostwriter');
  const installed = JSON.parse(read(manifest));
  expect(installed.packs).toEqual(['core', 'ghostwriter']);
  const routes = [
    'voice-profile',
    'draft',
    'humanize',
    'improve',
    'localize',
    'agent-output-review',
  ];
  const required = [
    ...skills.map((name) => `.agents/skills/ghostwriter-${name}/SKILL.md`),
    ...routes.map((name) => `${pack}/workflows/${name}.md`),
    `${pack}/SKILL.md`,
    `${pack}/ghostwriter.md`,
    `${pack}/intake.yaml`,
    `${pack}/shared/catalog.json`,
  ];
  const healthy = JSON.parse(run(['doctor', '--json']));
  const owned = Object.keys(installed.fileInventory.files);
  for (const file of required) {
    expect(owned).toContain(file);
    expect(healthy.checks).toContainEqual(
      expect.objectContaining({ path: file, code: 'file.unchanged' })
    );
  }

  const missing = `${pack}/workflows/agent-output-review.md`;
  fs.unlinkSync(path.join(project, missing));
  const broken = JSON.parse(run(['doctor', '--json'], 1));
  expect(broken.checks).toContainEqual(
    expect.objectContaining({ path: missing, code: 'file.missing' })
  );
});

test('updating and removing Ghostwriter preserve user profiles, policy, drafts and edits', () => {
  const profile = '.bmad-plus/ghostwriter/profiles/support.yaml';
  const policy = '.bmad-plus/ghostwriter/config.yaml';
  const draft = '_bmad-output/ghostwriter/support/reply.md';
  const settings = {
    [profile]: 'name: Support\n',
    [policy]: 'schema_version: 1\nenabled: false\n',
    [draft]: 'Refunds may take up to five days.\n',
  };
  for (const [file, content] of Object.entries(settings)) write(file, content);
  install('ghostwriter');

  const current = JSON.parse(read(manifest));
  for (const file of Object.keys(settings)) {
    expect(Object.hasOwn(current.fileInventory.files, file)).toBe(false);
  }
  const edited = `${pack}/ghostwriter.md`;
  const unknown = `${pack}/our-house-style.md`;
  const retained = {
    ...settings,
    [edited]: read(edited) + '\nUse the project glossary for product names.\n',
    [unknown]: 'Use dates as supplied.\n',
  };
  write(edited, retained[edited]);
  write(unknown, retained[unknown]);
  current.version = '0.0.1';
  write(manifest, JSON.stringify(current));

  run(['update', '--yes', '--expected-version', version]);
  expect(JSON.parse(read(manifest)).version).toBe(version);
  for (const [file, content] of Object.entries(retained)) expect(read(file)).toBe(content);

  run(['uninstall', '--yes']);
  for (const [file, content] of Object.entries(retained)) expect(read(file)).toBe(content);
  expect(fs.existsSync(path.join(project, manifest))).toBe(false);
  expect(fs.existsSync(path.join(project, pack, 'SKILL.md'))).toBe(false);
  for (const name of skills) {
    expect(fs.existsSync(path.join(project, '.agents/skills', 'ghostwriter-' + name))).toBe(false);
  }
});
