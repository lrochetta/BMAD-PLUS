/** Installer/update ownership contract with real registry-derived adapters. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
jest.mock('@clack/prompts', () => ({
  log: { warn: jest.fn() },
}));
const clack = require('@clack/prompts');
const { loadRegistry } = require('../../tools/build/generate');
const {
  generateAllFiles,
  generateUserFiles,
  GENERATED_MARKER,
  USER_CONFIG_MARKER,
} = require('../../tools/build/generate-adapters');
const { DERIVED } = require('../../tools/cli/lib/packs');
const {
  writeIDEConfigs,
  INSTALLER_MARKER,
  contentHash,
} = require('../../tools/cli/lib/installed-adapters');
const {
  _internal: { generateConfigYaml },
} = require('../../tools/cli/commands/install');

const userFiles = generateUserFiles(DERIVED, { packs: ['core'], userName: 'Test', language: 'en' });
const adoptedFiles = generateAllFiles(loadRegistry());
let tmp;
function seed(file, content) {
  const target = path.join(tmp, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function run(options = {}) {
  return writeIDEConfigs({ projectDir: tmp, files: userFiles, yes: true, ...options });
}
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-spine-'));
  jest.clearAllMocks();
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test.each([true, false])(
  'adopted spine and nested adapters survive byte-identically (yes=%s)',
  (yes) => {
    for (const { file, content } of adoptedFiles) seed(file, content);
    const result = run({ yes });
    expect(result.written).toEqual([]);
    expect(result.backedUp).toEqual([]);
    expect(result.adapterHashes).toEqual({});
    expect(result.skipped.sort()).toEqual(userFiles.map((item) => item.file).sort());
    for (const { file, content } of adoptedFiles)
      expect(fs.readFileSync(path.join(tmp, file), 'utf8')).toBe(content);
  }
);

test('adopted skip provides a command reachable from an npm package', () => {
  for (const { file, content } of adoptedFiles) seed(file, content);
  run();
  for (const [warning] of clack.log.warn.mock.calls) {
    expect(warning).toContain(require.resolve('../../tools/build/generate-adapters'));
    expect(warning).toContain('--target');
    expect(warning).toContain('--check');
    expect(warning).not.toContain('node tools/build/');
  }
});

test('fresh installation writes every distinct target including common root spine', () => {
  const result = run();
  expect(result.written).toEqual(userFiles.map((item) => item.file));
  for (const { file, content } of userFiles) {
    expect(fs.readFileSync(path.join(tmp, file), 'utf8')).toBe(content);
    expect(result.adapterHashes[file]).toBe(contentHash(content));
    expect(content).toContain(GENERATED_MARKER);
    expect(content).toContain(USER_CONFIG_MARKER);
  }
  expect(result.written.filter((file) => file === 'GEMINI.md')).toHaveLength(1);
});

test('interactive installation preserves hand-authored instructions', () => {
  seed('CLAUDE.md', '# Local instructions');
  const result = run({ yes: false });
  expect(result.skipped).toContain('CLAUDE.md');
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8')).toBe('# Local instructions');
});

test('--yes backs up hand-authored instructions without replacing an existing backup', () => {
  seed('CLAUDE.md', '# Local instructions');
  seed('CLAUDE.md.bak', '# Earlier backup');
  const result = run();
  expect(result.backedUp).toEqual(['CLAUDE.md']);
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md.bak'), 'utf8')).toBe('# Earlier backup');
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md.bak.1'), 'utf8')).toBe('# Local instructions');
});

test('legacy installer configs are backed up during migration', () => {
  const legacy = '# ' + INSTALLER_MARKER + '\nLocal additions';
  seed('CLAUDE.md', legacy);
  const result = run({ update: true });
  expect(result.written).toContain('CLAUDE.md');
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md.bak'), 'utf8')).toBe(legacy);
});

test('update preserves hand-authored files even under --yes', () => {
  seed('CLAUDE.md', '# Local instructions');
  expect(run({ update: true }).skipped).toContain('CLAUDE.md');
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8')).toBe('# Local instructions');
});

test('unchanged installed adapters refresh from a newer registry render', () => {
  const initial = run();
  const newerFiles = generateUserFiles(DERIVED, {
    packs: ['core', 'osint'],
    userName: 'Test',
    language: 'en',
  });
  const result = run({ files: newerFiles, adapterHashes: initial.adapterHashes, update: true });
  expect(result.skipped).toEqual([]);
  expect(fs.readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8')).toContain('Shadow');
});

test.each([true, false])(
  'local additions survive both install and update (update=%s)',
  (update) => {
    const initial = run();
    const target = path.join(tmp, 'CLAUDE.md');
    fs.appendFileSync(target, '\nMy project instructions.');
    const expected = fs.readFileSync(target, 'utf8');
    const result = run({ update, adapterHashes: initial.adapterHashes });
    expect(result.skipped).toContain('CLAUDE.md');
    expect(result.adapterHashes['CLAUDE.md']).toBe(initial.adapterHashes['CLAUDE.md']);
    expect(fs.readFileSync(target, 'utf8')).toBe(expected);
  }
);

test('a marker without ownership hash cannot authorize overwriting edited content', () => {
  seed('CLAUDE.md', GENERATED_MARKER + '\n' + USER_CONFIG_MARKER + '\nCustom text');
  expect(run().skipped).toContain('CLAUDE.md');
});

test('same content can recover a missing hash without a write', () => {
  run();
  const result = run();
  expect(result.written).toEqual([]);
  expect(Object.keys(result.adapterHashes)).toHaveLength(userFiles.length);
});

test('line ending conversion does not masquerade as a user edit', () => {
  const initial = run();
  const target = path.join(tmp, 'CLAUDE.md');
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\r?\n/g, '\r\n'));
  expect(run({ adapterHashes: initial.adapterHashes, update: true }).skipped).toEqual([]);
});

test('all target paths are checked before any adapter is written', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-adapter-outside-'));
  try {
    fs.symlinkSync(outside, path.join(tmp, '.codex'), 'junction');
    expect(() => run()).toThrow(/junction/);
    expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(false);
    expect(fs.readdirSync(outside)).toEqual([]);
  } finally {
    fs.unlinkSync(path.join(tmp, '.codex'));
    fs.rmdirSync(outside);
  }
});

test('refuses path traversal before writing', () => {
  expect(() => run({ files: [{ file: '../escape.md', content: 'unsafe' }] })).toThrow(
    /outside project/
  );
});

test.each(['manual', 'autopilot', 'hybrid'])(
  'persists execution mode %s with checkpoint defaults',
  (mode) => {
    const config = yaml.load(generateConfigYaml('Test', 'en', tmp, mode));
    expect(config.execution_mode).toBe(mode);
    expect(config.checkpoints.delivery).toBe('require_approval');
    expect(config.checkpoints.story).toBe(
      mode === 'autopilot' ? 'notify_only' : 'require_approval'
    );
  }
);

test('serializes quoted names and languages as YAML data', () => {
  const name = 'Name"\ninjected: true';
  const language = 'en: value';
  const config = yaml.load(generateConfigYaml(name, language, tmp));
  expect(config.user_name).toBe(name);
  expect(config.communication_language).toBe(language);
  expect(config.injected).toBeUndefined();
});
