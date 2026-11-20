const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const pack = path.join(repo, 'src/bmad-plus/packs/pack-ghostwriter');
const cli = path.join(repo, 'tools/cli/bmad-plus-cli.js');
let project;

function run(...args) {
  const result = spawnSync(
    process.execPath,
    [cli, 'ghostwriter', ...args, '--directory', project, '--json'],
    {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    }
  );
  if (result.error) throw result.error;
  return result;
}

function prepare() {
  return run(
    'prepare',
    '--workflow',
    'agent-output-review',
    '--input',
    'draft.md',
    '--mode',
    'manual',
    '--locale',
    'fr-FR'
  );
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad ghostwriter cli '));
  fs.writeFileSync(path.join(project, 'draft.md'), 'La salle B ouvre à 14 h pour les abonnés.\n');
});

afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

function installResources() {
  const skills = path.join(project, '.agents/skills');
  fs.cpSync(pack, path.join(skills, 'pack-ghostwriter'), { recursive: true });
  const source = path.join(repo, 'src/bmad-plus/skills');
  for (const name of fs.readdirSync(source).filter((id) => id.startsWith('ghostwriter-'))) {
    fs.cpSync(path.join(source, name), path.join(skills, name), { recursive: true });
  }
}

test('a prepared manual review retains its input and cannot pass the delivery gate', () => {
  installResources();
  const before = fs.readFileSync(path.join(project, 'draft.md'));
  const prepared = prepare();
  expect(prepared.status).toBe(0);
  const receipt = JSON.parse(prepared.stdout);
  expect(receipt.executed).toBe(false);
  expect(receipt.run_id).toEqual(expect.any(String));

  const gated = run('gate', receipt.run_id);
  expect(gated.status).toBe(2);
  expect(JSON.parse(gated.stdout).gate.verdict).toBe('incomplete');
  expect(fs.readFileSync(path.join(project, 'draft.md'))).toEqual(before);
});

test('an absent optional pack cannot create a review run', () => {
  expect(prepare().status).not.toBe(0);
  expect(fs.existsSync(path.join(project, '.bmad-plus/ghostwriter/runs'))).toBe(false);
});

test('a project can limit revision to a single existing file and disable the pack', () => {
  installResources();
  const settings = path.join(project, '.bmad-plus/ghostwriter/config.yaml');
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, 'schema_version: 1\nscope:\n  include_paths: [draft.md]\n');
  expect(prepare().status).toBe(0);

  fs.writeFileSync(path.join(project, 'other.md'), 'A different deliverable.');
  const other = run('prepare', '--workflow', 'humanize', '--input', 'other.md');
  expect(other.status).not.toBe(0);

  fs.writeFileSync(settings, 'schema_version: 1\nenabled: false\n');
  expect(prepare().status).not.toBe(0);
});

test('a change to the editorial instructions invalidates the earlier preparation', () => {
  installResources();
  const prepared = prepare();
  expect(prepared.status).toBe(0);
  const receipt = JSON.parse(prepared.stdout);
  const localePath = '.agents/skills/pack-ghostwriter/languages/fr-FR.md';
  expect(receipt.manifest.resource_artifacts.map((item) => item.path)).toContain(localePath);
  fs.appendFileSync(path.join(project, localePath), '\nA revised editorial instruction.\n');

  const checked = run('check', receipt.run_id);
  expect(checked.status).toBe(2);
  const result = JSON.parse(checked.stdout);
  expect(result.gate.verdict).toBe('incomplete');
  expect(result.gate.reasons.join(' ')).toMatch(/changed|stale/i);
});

test('refuses a draft outside the selected project before writing any review run', () => {
  installResources();
  const sibling = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad ghostwriter sibling '));
  try {
    const outside = path.join(sibling, 'draft.md');
    fs.writeFileSync(outside, 'Outside this project.');
    const prepared = run(
      'prepare',
      '--workflow',
      'humanize',
      '--input',
      path.relative(project, outside)
    );
    expect(prepared.status).not.toBe(0);
    expect(fs.existsSync(path.join(project, '.bmad-plus/ghostwriter/runs'))).toBe(false);
    expect(fs.readFileSync(outside, 'utf8')).toBe('Outside this project.');
  } finally {
    fs.rmSync(sibling, { recursive: true, force: true });
  }
});
