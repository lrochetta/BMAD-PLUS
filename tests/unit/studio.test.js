const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { prepare, validatePack, resolveConfig, loadCatalog } = require('../../tools/cli/lib/studio');
const { loadRegistry } = require('../../tools/build/generate');
const {
  collectManagedFiles,
  planUpdate,
  applyPlan,
  restoreUpdate,
  MANIFEST,
} = require('../../tools/cli/lib/update-transaction');
const { fileHash } = require('../../tools/cli/lib/pack-copy');

const REPO = path.resolve(__dirname, '../..');
const SOURCE = path.join(REPO, 'src/bmad-plus/packs/pack-dev-studio');
const PACK = '.agents/skills/pack-dev-studio';
const CATALOG = require('../../src/bmad-plus/packs/pack-dev-studio/shared/catalog.json');
let temporary, projectDir, packRoot;

function write(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function run(workflow, options = {}) {
  return prepare({ projectDir, workflow, ...options });
}
function changeCatalog(mutate) {
  const value = JSON.parse(fs.readFileSync(path.join(packRoot, 'shared/catalog.json')));
  mutate(value);
  write(packRoot, 'shared/catalog.json', JSON.stringify(value));
}
function cli(args, json = true) {
  return spawnSync(
    process.execPath,
    [
      path.join(REPO, 'tools/cli/bmad-plus-cli.js'),
      'studio',
      ...args,
      '--directory',
      projectDir,
      ...(json ? ['--json'] : []),
    ],
    { encoding: 'utf8', timeout: 30000, windowsHide: true }
  );
}

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bmad-studio-'));
  projectDir = path.join(temporary, 'relocated project');
  packRoot = path.join(projectDir, PACK);
  fs.cpSync(SOURCE, packRoot, { recursive: true });
  write(projectDir, 'inputs/brief.md', '# Task\nA local-only task list for a team.\n');
});
afterEach(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('registry routes, transitive resources and compatibility entries resolve after relocation', () => {
  const result = validatePack(packRoot, loadRegistry().packs['dev-studio']);
  expect(result.catalog.workflows).toHaveLength(38);
  expect(result.catalog.agents).toHaveLength(6);
  expect(result.resources).toContain('categories/planning/steps/step-01-init.md');
});

test.each(CATALOG.workflows.map((w) => [w.id, w.path, w.agent]))(
  'prepares the real %s instructions, persona and input bytes without writing',
  (id, entry, agentId) => {
    const result = run(id, {
      request: 'Use the supplied project scope.',
      inputs: ['inputs/brief.md'],
    });
    expect(result.status).toBe('ready');
    expect(result.executed).toBe(false);
    const resource = result.instructions.find((item) => item.path === entry);
    expect(resource.content).toBe(fs.readFileSync(path.join(packRoot, entry), 'utf8'));
    expect(resource.sha256).toBe(
      crypto.createHash('sha256').update(resource.content).digest('hex')
    );
    expect(result.instructions.map((item) => item.path)).toContain(
      CATALOG.agents.find((a) => a.id === agentId).path
    );
    expect(result.inputs[0].content).toContain('local-only task list');
    expect(fs.existsSync(path.join(projectDir, result.outputPath))).toBe(false);
  }
);

test('all aliases resolve once to their canonical workflow', () => {
  for (const workflow of CATALOG.workflows) {
    for (const alias of workflow.aliases) {
      expect(run(alias, { request: 'Scope', inputs: ['inputs/brief.md'] }).workflow).toBe(
        workflow.id
      );
    }
  }
});

test('help and roundtable context contain the real catalog needed to resolve routes and personas', () => {
  for (const workflow of ['bmad-help', 'party-mode']) {
    const bundle = run(workflow, { request: 'Compare the available roles.' });
    const catalog = JSON.parse(
      bundle.instructions.find((item) => item.path === 'shared/catalog.json').content
    );
    expect(catalog.workflows.map((item) => item.id)).toEqual(
      CATALOG.workflows.map((item) => item.id)
    );
    expect(catalog.agents.map((item) => item.persona)).toEqual([
      'Miriam',
      'Huldah',
      'Yosef',
      'Rachel',
      'Bezalel',
      'Oholiab',
    ]);
  }
});

test('missing task and artifact inputs remain explicit; a request cannot replace a required document', () => {
  expect(run('product-brief')).toMatchObject({ status: 'needs-input', executed: false });
  expect(run('edit-prd', { request: 'Edit my PRD' }).status).toBe('needs-input');
  expect(run('edit-prd', { inputs: ['inputs/brief.md'] }).status).toBe('ready');
  expect(run('bmad-help').status).toBe('ready');
  expect(() => run('not-a-workflow')).toThrow(/Unknown/);
});

test('configuration has declared defaults and consumes the real installed YAML', () => {
  expect(resolveConfig(projectDir)).toMatchObject({
    values: { user_name: 'user', communication_language: 'English', output_folder: '_bmad-output' },
    source: null,
  });
  write(
    projectDir,
    '_bmad/config.yaml',
    'user_name: Laurent\ncommunication_language: French\ndocument_output_language: English\noutput_folder: deliverables\nproject_name: Example\nparallel_execution: true\n'
  );
  const result = run('product-brief', { request: 'Scope' });
  expect(result.config.values.user_name).toBe('Laurent');
  expect(result.config.defaultsUsed).toEqual([]);
  expect(result.outputPath).toBe('deliverables/dev-studio/product-brief.md');
  expect(result.config.source.sha256).toMatch(/^[a-f0-9]{64}$/);
});

test.each([
  '',
  'null',
  '[]',
  'user_name: [wrong]',
  'output_folder: 1',
  'user_name: a\nuser_name: b',
  'output_folder: ../escape',
  'output_folder: /absolute',
  'output_folder: "C:/outside"',
  'user_name: [',
])('rejects malformed or invalid present config %p', (content) => {
  write(projectDir, '_bmad/config.yaml', content);
  expect(() => run('bmad-help')).toThrow();
});

test.each(['../outside.md', '/outside.md', 'inputs\\brief.md', 'C:/outside.md', 'inputs/Brief.md'])(
  'rejects escaped or case-mismatched project input %p',
  (input) => {
    expect(() => run('edit-prd', { inputs: [input] })).toThrow();
  }
);

test('transitive resource deletion fails preparation even when the entry exists', () => {
  write(packRoot, 'shared/reference.md', '# Reference\n[Required detail](detail.md)\n');
  write(packRoot, 'shared/detail.md', 'Necessary detail.');
  changeCatalog((c) =>
    c.workflows.find((w) => w.id === 'product-brief').resources.push('shared/reference.md')
  );
  const result = run('product-brief', { request: 'Scope' });
  expect(result.status).toBe('ready');
  expect(result.instructions.map((item) => item.path)).toContain('shared/detail.md');
  fs.unlinkSync(path.join(packRoot, 'shared/detail.md'));
  expect(() => run('product-brief', { request: 'Scope' })).toThrow(/detail.md/);
});

test('broken route declarations, duplicate aliases and graph escapes are rejected', () => {
  changeCatalog((c) => c.workflows[1].aliases.push(c.workflows[0].id));
  expect(() => loadCatalog(packRoot)).toThrow(/duplicate workflow route/);
  fs.copyFileSync(
    path.join(SOURCE, 'shared/catalog.json'),
    path.join(packRoot, 'shared/catalog.json')
  );
  changeCatalog((c) => (c.workflows[0].path = '../outside.md'));
  expect(() => validatePack(packRoot)).toThrow(/relative file/);
  fs.copyFileSync(
    path.join(SOURCE, 'shared/catalog.json'),
    path.join(packRoot, 'shared/catalog.json')
  );
  write(packRoot, 'shared/execution.md', '[Escape](../../../outside.md)');
  expect(() => validatePack(packRoot)).toThrow(/relative file/);
});

test('missing catalog entries and unresolved runtime variables fail source validation', () => {
  changeCatalog((c) => c.workflows.pop());
  expect(() => validatePack(packRoot, loadRegistry().packs['dev-studio'])).toThrow(
    /registry routes/
  );
  write(packRoot, 'shared/execution.md', 'Load {workflow.missing_resource}');
  expect(() => validatePack(packRoot)).toThrow(/Unresolved runtime declaration/);
});

test('linked directories cannot supply input, config or output resources', () => {
  const outside = path.join(temporary, 'outside');
  fs.mkdirSync(outside);
  write(outside, 'brief.md', 'outside');
  fs.symlinkSync(
    outside,
    path.join(projectDir, 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  expect(() => run('edit-prd', { inputs: ['linked/brief.md'] })).toThrow(/symlink|junction/);
  write(projectDir, '_bmad/config.yaml', 'output_folder: linked');
  expect(() => run('bmad-help')).toThrow(/symlink|junction/);
});

test('bounded UTF-8 loading rejects binary, invalid text and oversized input', () => {
  for (const bytes of [
    Buffer.from([0, 1]),
    Buffer.from([0xff]),
    Buffer.alloc(256 * 1024 + 1, 65),
  ]) {
    write(projectDir, 'inputs/invalid.txt', bytes);
    expect(() => run('edit-prd', { inputs: ['inputs/invalid.txt'] })).toThrow(/bounded text|UTF-8/);
  }
});

test('continuation preserves the report and exposes changed input hashes without a completion claim', () => {
  const first = run('create-prd', { inputs: ['inputs/brief.md'] });
  write(projectDir, first.outputPath, '# Existing report\nUser addition: keep offline support.\n');
  write(projectDir, 'inputs/brief.md', '# Revised brief\nInclude exports.\n');
  const resumed = run('create-prd', { inputs: ['inputs/brief.md'] });
  expect(resumed.previousReport.content).toContain('User addition');
  expect(resumed.inputs[0].sha256).not.toBe(first.inputs[0].sha256);
  expect(resumed.executed).toBe(false);
  expect(fs.readFileSync(path.join(projectDir, first.outputPath), 'utf8')).toBe(
    resumed.previousReport.content
  );
});

test('real CLI lists routes and prepares an alias with repeatable files and truthful exit codes', () => {
  const listed = cli(['list']);
  expect(listed.status).toBe(0);
  expect(JSON.parse(listed.stdout).workflows).toHaveLength(38);
  expect(cli(['prepare', 'edit-prd']).status).toBe(2);
  write(projectDir, 'inputs/change.md', 'Add exports.');
  const result = cli([
    'prepare',
    'bmad-edit-prd',
    '--input',
    'inputs/brief.md',
    '--input',
    'inputs/change.md',
  ]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).inputs).toHaveLength(2);
  const invalid = cli(['prepare', 'unknown']);
  expect(invalid.status).toBe(1);
  expect(JSON.parse(invalid.stdout).status).toBe('error');
});

test('human-readable preparation retains the requested task and resolved project preferences', () => {
  write(
    projectDir,
    '_bmad/config.yaml',
    'user_name: ReviewFixture\ncommunication_language: French\ndocument_output_language: English\noutput_folder: custom-output\n'
  );
  const result = cli(
    ['prepare', 'product-brief', '--request', 'Build the offline review queue'],
    false
  );
  expect(result.status).toBe(0);
  for (const value of [
    'Build the offline review queue',
    'ReviewFixture',
    'French',
    'English',
    'custom-output',
  ]) {
    expect(result.stdout).toContain(value);
  }
  expect(result.stdout.indexOf('Build the offline review queue')).toBeLessThan(
    result.stdout.indexOf('shared/execution.md')
  );
});

test('real update and restore preserve a customized Dev Studio entry and project config', () => {
  const manifest = {
    version: '0.13.0',
    installed: '2026-09-08T12:00:00Z',
    packs: ['core', 'dev-studio'],
    ides: [],
    user: 'Fixture',
    language: 'en',
    fileInventory: { schemaVersion: 1, complete: true, files: {} },
  };
  for (const { file, content } of collectManagedFiles({ projectDir, packs: manifest.packs })) {
    write(projectDir, file, content);
    manifest.fileInventory.files[file] = fileHash(content);
  }
  const customized = PACK + '/categories/implementation/dev-story.md';
  write(projectDir, customized, '# My delivery process\nKeep manual acceptance.\n');
  write(projectDir, '_bmad/config.yaml', 'user_name: Fixture\noutput_folder: my-reports\n');
  write(projectDir, MANIFEST, JSON.stringify(manifest));
  const opts = { projectDir, packageRoot: REPO, version: '0.14.0' };
  expect(() => planUpdate({ ...opts, auto: true })).toThrow(/conflicts/);
  const plan = planUpdate(opts);
  expect(plan.conflicts).toContainEqual({ file: customized, reason: 'modified-managed-file' });
  const applied = applyPlan(plan);
  expect(fs.readFileSync(path.join(projectDir, customized), 'utf8')).toContain(
    'My delivery process'
  );
  restoreUpdate({ projectDir, receiptId: applied.receiptId });
  expect(fs.readFileSync(path.join(projectDir, customized), 'utf8')).toContain(
    'My delivery process'
  );
  expect(resolveConfig(projectDir).values.output_folder).toBe('my-reports');
  expect(JSON.parse(fs.readFileSync(path.join(projectDir, MANIFEST))).version).toBe('0.13.0');
});
