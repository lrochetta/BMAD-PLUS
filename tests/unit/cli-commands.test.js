/**
 * CLI action-layer coverage: uninstall / update / doctor (QA-03)
 *
 * Before this suite these three commands had ZERO executed lines — the shipped
 * CLI's primary maintenance paths were entirely untested. These tests drive each
 * command's real `action()` against a temp project (clack mocked, fs on disk),
 * exercising: not-installed early-exit, a full install, corrupt/again-current
 * manifests, the confirm/cancel branches, and a real update that rewrites the
 * manifest version. Paired with `collectCoverageFrom` in package.json so the gap
 * is now visible to the coverage threshold.
 *
 * Run: npx jest tests/unit/cli-commands.test.js --coverage=false
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const clack = require('@clack/prompts');
const doctor = require('../../tools/cli/commands/doctor');
const uninstall = require('../../tools/cli/commands/uninstall');
const update = require('../../tools/cli/commands/update');
const { generateUserFiles } = require('../../tools/build/generate-adapters');
const { DERIVED } = require('../../tools/cli/lib/packs');
const { contentHash } = require('../../tools/cli/lib/installed-adapters');

const PKG_VERSION = require('../../package.json').version;

let tmp;
let cwd0;
let exitCode0;
let tty0;

beforeEach(() => {
  // Fresh, controllable clack spies for this test (module registry is per-file).
  clack.intro = jest.fn();
  clack.outro = jest.fn();
  clack.cancel = jest.fn();
  clack.note = jest.fn();
  clack.confirm = jest.fn().mockResolvedValue(true);
  clack.isCancel = jest.fn().mockReturnValue(false);
  clack.spinner = () => ({ start: jest.fn(), stop: jest.fn(), message: jest.fn() });
  clack.log = {
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    step: jest.fn(),
    message: jest.fn(),
  };
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cli-'));
  cwd0 = process.cwd();
  exitCode0 = process.exitCode;
  tty0 = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
});

afterEach(() => {
  jest.restoreAllMocks();
  process.chdir(cwd0);
  process.exitCode = exitCode0;
  if (tty0) Object.defineProperty(process.stdin, 'isTTY', tty0);
  else delete process.stdin.isTTY;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function copyShipped(relativeSource, relativeTarget) {
  const target = path.join(tmp, relativeTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', '..', relativeSource), target);
  return target;
}

function testAdapter(packs) {
  return generateUserFiles(DERIVED, {
    packs: packs.filter((id) => DERIVED.packs[id]),
    userName: 'Test User',
    language: 'en',
    tools: ['claude-code'],
  }).find((item) => item.file === 'CLAUDE.md').content;
}

function makeProject(dir, opts = {}) {
  const {
    version = '0.0.1',
    packs = ['core'],
    manifest = true,
    manifestRaw = null,
    agents = true,
    config = true,
    moduleY = true,
    ide = true,
    output = false,
  } = opts;
  fs.mkdirSync(path.join(dir, '_bmad'), { recursive: true });
  if (manifestRaw !== null) {
    fs.writeFileSync(path.join(dir, '_bmad', '.bmad-plus-install.json'), manifestRaw);
  } else if (manifest) {
    fs.writeFileSync(
      path.join(dir, '_bmad', '.bmad-plus-install.json'),
      JSON.stringify({
        version,
        installed: '2026-01-01T00:00:00.000Z',
        packs,
        uiLanguage: 'en',
        user: 'Test User',
        language: 'en',
        ides: ['claude-code'],
        adapterHashes: { 'CLAUDE.md': contentHash(testAdapter(packs)) },
      })
    );
  }
  if (config) fs.writeFileSync(path.join(dir, '_bmad', 'config.yaml'), 'mode: manual\n');
  if (moduleY) fs.writeFileSync(path.join(dir, '_bmad', 'module.yaml'), 'packs: {}\n');
  if (agents) fs.mkdirSync(path.join(dir, '.agents', 'skills'), { recursive: true });
  if (ide) fs.writeFileSync(path.join(dir, 'CLAUDE.md'), testAdapter(packs));
  if (output) fs.mkdirSync(path.join(dir, '_bmad-output'), { recursive: true });
}

describe('doctor', () => {
  test('reports not-installed and exits early when no manifest', async () => {
    await doctor.action({ directory: tmp });
    expect(clack.log.error).toHaveBeenCalled();
    expect(clack.note).not.toHaveBeenCalled(); // never reached the health report
  });

  test('runs the full check battery on an installed project', async () => {
    makeProject(tmp, { packs: ['core'], output: true });
    await doctor.action({ directory: tmp });
    expect(clack.note).toHaveBeenCalledTimes(1); // health report emitted
    expect(clack.log.success).toHaveBeenCalled(); // at least the manifest check passed
  });

  test('flags a version mismatch as a warning', async () => {
    makeProject(tmp, { version: '0.0.1' });
    await doctor.action({ directory: tmp });
    const warned = clack.log.warn.mock.calls.some((c) => /Version mismatch/.test(String(c[0])));
    expect(warned).toBe(true);
  });
});

describe('uninstall', () => {
  test('does nothing when BMAD+ is not installed', async () => {
    process.chdir(tmp);
    await uninstall.action({});
    expect(clack.log.warn).toHaveBeenCalled();
    // no _bmad created, nothing to remove
    expect(fs.existsSync(path.join(tmp, '_bmad'))).toBe(false);
  });

  test('removes unchanged BMAD files and marked IDE files on confirm', async () => {
    makeProject(tmp, { agents: true, ide: true });
    copyShipped(
      'src/bmad-plus/agents/agent-strategist/SKILL.md',
      '.agents/skills/agent-strategist/SKILL.md'
    );
    copyShipped('src/bmad-plus/data/role-triggers.yaml', '.agents/data/role-triggers.yaml');
    process.chdir(tmp);
    await uninstall.action({});
    expect(fs.existsSync(path.join(tmp, '.agents'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, '_bmad', 'config.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(false);
  });

  test('preserves memory, custom skills/data, and edits within installed skills', async () => {
    makeProject(tmp);
    const kept = {
      '.agents/memory/decisions.md': 'Project decisions',
      '.agents/skills/custom/SKILL.md': 'My own skill',
      '.agents/data/custom.yaml': 'custom: true',
      '.agents/skills/agent-strategist/SKILL.md': 'My edited Atlas instructions',
      '.agents/skills/agent-quality/notes.md': 'My local QA notes',
      '_bmad/custom.yaml': 'Keep my settings',
    };
    for (const [file, contents] of Object.entries(kept)) {
      fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
      fs.writeFileSync(path.join(tmp, file), contents);
    }
    const removable = copyShipped(
      'src/bmad-plus/agents/agent-quality/SKILL.md',
      '.agents/skills/agent-quality/SKILL.md'
    );
    process.chdir(tmp);
    await uninstall.action({});
    for (const [file, contents] of Object.entries(kept)) {
      expect(fs.readFileSync(path.join(tmp, file), 'utf8')).toBe(contents);
    }
    expect(fs.existsSync(removable)).toBe(false);
  });

  test('removes only unchanged files from external package skills', async () => {
    makeProject(tmp, { packs: ['core', 'osint'] });
    const externalDir = path.join(__dirname, '..', '..', 'osint-agent-package', 'skills');
    const skill = fs
      .readdirSync(externalDir)
      .find((name) => fs.existsSync(path.join(externalDir, name, 'SKILL.md')));
    const removable = copyShipped(
      `osint-agent-package/skills/${skill}/SKILL.md`,
      `.agents/skills/${skill}/SKILL.md`
    );
    const custom = path.join(path.dirname(removable), 'custom.md');
    fs.writeFileSync(custom, 'Keep this');
    process.chdir(tmp);
    await uninstall.action({});
    expect(fs.existsSync(removable)).toBe(false);
    expect(fs.readFileSync(custom, 'utf8')).toBe('Keep this');
  });

  test('preserves output containing hidden files', async () => {
    makeProject(tmp, { output: true });
    const hidden = path.join(tmp, '_bmad-output', '.notes');
    fs.writeFileSync(hidden, 'Keep hidden output');
    process.chdir(tmp);
    await uninstall.action({});
    expect(fs.readFileSync(hidden, 'utf8')).toBe('Keep hidden output');
  });

  test('removes an actually empty output directory', async () => {
    makeProject(tmp, { output: true });
    process.chdir(tmp);
    await uninstall.action({});
    expect(fs.existsSync(path.join(tmp, '_bmad-output'))).toBe(false);
  });

  test.each(['.agents', '.agents/skills/agent-strategist', '_bmad'])(
    'refuses a junction at %s before any deletion',
    async (linkedPath) => {
      makeProject(tmp, { agents: false });
      const outside = path.join(tmp, 'outside');
      fs.mkdirSync(outside);
      const link = path.join(tmp, linkedPath);
      if (linkedPath === '_bmad') {
        fs.renameSync(link, path.join(outside, 'installation'));
      }
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(
        linkedPath === '_bmad' ? path.join(outside, 'installation') : outside,
        link,
        'junction'
      );
      fs.writeFileSync(path.join(outside, 'untouched.txt'), 'Must survive');
      process.chdir(tmp);
      await expect(uninstall.action({})).resolves.toBeUndefined();
      expect(process.exitCode).toBe(1);
      expect(clack.log.error).toHaveBeenCalled();
      expect(fs.readFileSync(path.join(outside, 'untouched.txt'), 'utf8')).toBe('Must survive');
      expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(true);
    }
  );

  test('fails without prompting when stdin is not a TTY', async () => {
    makeProject(tmp);
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    process.chdir(tmp);
    await uninstall.action({});
    expect(process.exitCode).toBe(1);
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(true);
  });

  test('accepts --yes without prompting in a noninteractive shell', async () => {
    makeProject(tmp);
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    process.chdir(tmp);
    await uninstall.action({ yes: true });
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(false);
  });

  test('keeps everything when the user cancels the confirm', async () => {
    clack.confirm = jest.fn().mockResolvedValue(false);
    makeProject(tmp);
    process.chdir(tmp);
    await uninstall.action({});
    expect(clack.cancel).toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, '_bmad'))).toBe(true); // not removed
  });

  test('keeps a hand-authored IDE config that lacks the generator marker', async () => {
    makeProject(tmp, { ide: false });
    fs.writeFileSync(
      path.join(tmp, 'AGENTS.md'),
      '# My own notes, mentions BMAD+ but not generated\n'
    );
    process.chdir(tmp);
    await uninstall.action({});
    expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(true);
  });

  test('preserves user additions to an installer-generated IDE config', async () => {
    makeProject(tmp);
    const configPath = path.join(tmp, 'CLAUDE.md');
    fs.appendFileSync(configPath, '\n## My project instructions\nKeep my decisions.\n');
    const original = fs.readFileSync(configPath, 'utf8');
    process.chdir(tmp);
    await uninstall.action({});
    expect(fs.readFileSync(configPath, 'utf8')).toBe(original);
  });

  test('refuses unknown installed packs before deleting files', async () => {
    makeProject(tmp, { packs: ['core', 'future-pack'] });
    process.chdir(tmp);
    await uninstall.action({});
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(true);
  });

  test('rechecks junctions created while waiting for confirmation', async () => {
    makeProject(tmp);
    const skillPath = path.join(tmp, '.agents', 'skills', 'agent-strategist');
    copyShipped(
      'src/bmad-plus/agents/agent-strategist/SKILL.md',
      '.agents/skills/agent-strategist/SKILL.md'
    );
    const moved = path.join(tmp, 'outside');
    clack.confirm.mockImplementation(async () => {
      fs.renameSync(skillPath, moved);
      fs.symlinkSync(moved, skillPath, 'junction');
      return true;
    });
    process.chdir(tmp);
    await uninstall.action({});
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(moved, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(true);
  });
});

describe.each([
  ['doctor', doctor],
  ['uninstall', uninstall],
])('%s manifest validation', (name, command) => {
  test.each([
    '{ invalid json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ version: '1', installed: 42, packs: ['core'] }),
    JSON.stringify({ version: '1', installed: 'invalid date', packs: ['core'] }),
    JSON.stringify({ version: '1', installed: '2026-01-01', packs: 'core' }),
    JSON.stringify({ version: '1', installed: '2026-01-01', packs: [{}] }),
  ])('rejects malformed manifest %s without a raw crash or writes', async (manifestRaw) => {
    makeProject(tmp, { manifestRaw });
    process.chdir(tmp);
    await expect(command.action({ directory: tmp })).resolves.toBeUndefined();
    expect(clack.log.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'), 'utf8')).toBe(
      manifestRaw
    );
    expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(true);
  });
});

describe('update', () => {
  test('aborts when BMAD+ is not installed', async () => {
    await update.action({ directory: tmp });
    expect(clack.log.error).toHaveBeenCalled();
  });

  test('aborts gracefully on a corrupt manifest (no raw crash — JS-02)', async () => {
    makeProject(tmp, { manifestRaw: '{ this is not json' });
    await expect(update.action({ directory: tmp })).resolves.toBeUndefined();
    const errored = clack.log.error.mock.calls.some((c) =>
      /unreadable or corrupt/.test(String(c[0]))
    );
    expect(errored).toBe(true);
  });

  test('reports already-current when versions match', async () => {
    makeProject(tmp, { version: PKG_VERSION });
    await update.action({ directory: tmp });
    expect(clack.log.success).toHaveBeenCalled();
    // manifest version unchanged
    const m = JSON.parse(
      fs.readFileSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'), 'utf8')
    );
    expect(m.version).toBe(PKG_VERSION);
  });

  test('updates files and rewrites the manifest version on confirm', async () => {
    makeProject(tmp, { version: '0.0.1', packs: ['core'] });
    await update.action({ directory: tmp });
    const m = JSON.parse(
      fs.readFileSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'), 'utf8')
    );
    expect(m.version).toBe(PKG_VERSION); // bumped
    expect(m.lastUpdated).toBeTruthy();
  });
});

describe('registry adapter lifecycle', () => {
  test('version update refreshes owned adapters and preserves settings and output', async () => {
    makeProject(tmp, { packs: ['core', 'osint'] });
    const old = testAdapter(['core']);
    const configPath = path.join(tmp, 'CLAUDE.md');
    fs.writeFileSync(configPath, old);
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.adapterHashes['CLAUDE.md'] = contentHash(old);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.mkdirSync(path.join(tmp, '_bmad-output'));
    fs.writeFileSync(path.join(tmp, '_bmad-output', 'notes.md'), 'Keep this output');
    await update.action({ directory: tmp, yes: true });
    expect(fs.readFileSync(configPath, 'utf8')).toBe(testAdapter(['core', 'osint']));
    expect(fs.readFileSync(path.join(tmp, '_bmad', 'config.yaml'), 'utf8')).toBe('mode: manual\n');
    expect(fs.readFileSync(path.join(tmp, '_bmad-output', 'notes.md'), 'utf8')).toBe(
      'Keep this output'
    );
  });

  test('update keeps edited adapters and their original ownership hash', async () => {
    makeProject(tmp);
    const configPath = path.join(tmp, 'CLAUDE.md');
    fs.appendFileSync(configPath, '\nCustom project rules');
    const expected = fs.readFileSync(configPath, 'utf8');
    await update.action({ directory: tmp, yes: true });
    expect(fs.readFileSync(configPath, 'utf8')).toBe(expected);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'), 'utf8')
    );
    expect(manifest.adapterHashes['CLAUDE.md']).toBe(contentHash(testAdapter(['core'])));
  });

  test('update requires --yes without a terminal before mutating files', async () => {
    makeProject(tmp);
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    await update.action({ directory: tmp });
    expect(process.exitCode).toBe(1);
    expect(clack.confirm).not.toHaveBeenCalled();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'), 'utf8')
    );
    expect(manifest.version).toBe('0.0.1');
  });

  test('uninstall removes unchanged root and nested adapters and empty adapter directories', async () => {
    makeProject(tmp);
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.ides = DERIVED.targets.adapters.map((adapter) => adapter.tool);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const files = generateUserFiles(DERIVED, {
      packs: ['core'],
      userName: 'Test User',
      language: 'en',
    });
    for (const { file, content } of files) {
      fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
      fs.writeFileSync(path.join(tmp, file), content);
    }
    process.chdir(tmp);
    await uninstall.action({ yes: true });
    for (const { file } of files) expect(fs.existsSync(path.join(tmp, file))).toBe(false);
    expect(fs.existsSync(path.join(tmp, '.codex'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, '.cursor'))).toBe(false);
  });

  test('the install wizard persists its selected execution mode', async () => {
    const install = require('../../tools/cli/commands/install');
    clack.group = jest
      .fn()
      .mockResolvedValue({ userName: 'Test User', commLang: 'English', execMode: 'autopilot' });
    await install.action({ directory: tmp, packs: 'core', tools: 'none', lang: 'en' });
    const config = require('js-yaml').load(
      fs.readFileSync(path.join(tmp, '_bmad', 'config.yaml'), 'utf8')
    );
    expect(config.execution_mode).toBe('autopilot');
    expect(config.checkpoints.story).toBe('notify_only');
    expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(false);
  });
});

describe('repair and conservative adapter migration', () => {
  test('reinstall backs up a corrupt manifest and preserves edited instructions and memory', async () => {
    const install = require('../../tools/cli/commands/install');
    const corrupt = '{ this manifest needs repair';
    makeProject(tmp, { manifestRaw: corrupt });
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    fs.writeFileSync(manifestPath + '.corrupt.bak', 'Earlier manifest backup');
    const instructions = testAdapter(['core']) + '\nKeep my project rules';
    fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), instructions);
    fs.mkdirSync(path.join(tmp, '.agents', 'memory'));
    const memoryPath = path.join(tmp, '.agents', 'memory', 'decisions.md');
    fs.writeFileSync(memoryPath, 'Keep my project decisions');

    await install.action({
      directory: tmp,
      yes: true,
      tools: 'claude-code',
      packs: 'core',
      lang: 'en',
    });

    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version).toBe(PKG_VERSION);
    expect(fs.readFileSync(manifestPath + '.corrupt.bak', 'utf8')).toBe('Earlier manifest backup');
    expect(fs.readFileSync(manifestPath + '.corrupt.bak.1', 'utf8')).toBe(corrupt);
    expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8')).toBe(instructions);
    expect(fs.readFileSync(memoryPath, 'utf8')).toBe('Keep my project decisions');
    expect(
      clack.log.warn.mock.calls.some(([message]) =>
        /manifest.*corrupt|corrupt.*manifest/i.test(message)
      )
    ).toBe(true);
  });

  test('migrates an old Codex root config when the manifest has no IDE metadata', async () => {
    makeProject(tmp, { ide: false });
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.ides;
    delete manifest.adapterHashes;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const legacy =
      require('../../tools/cli/lib/installed-adapters').INSTALLER_MARKER +
      '\nKeep my old Codex notes';
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), legacy);

    await update.action({ directory: tmp, yes: true });

    const updated = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(updated.ides).toEqual(['codex-cli']);
    expect(fs.readFileSync(path.join(tmp, 'AGENTS.md.bak'), 'utf8')).toBe(legacy);
    expect(fs.existsSync(path.join(tmp, '.codex', 'AGENTS.md'))).toBe(true);
  });

  test('does not infer Codex from an untracked common generated spine', async () => {
    makeProject(tmp, { ide: false });
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.ides;
    delete manifest.adapterHashes;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const spine = generateUserFiles(DERIVED, { packs: ['core'], tools: [] })[0].content;
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), spine);
    await update.action({ directory: tmp, yes: true });
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).ides).toEqual([]);
    expect(fs.existsSync(path.join(tmp, '.codex'))).toBe(false);
    expect(fs.readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8')).toBe(spine);
  });

  test.each([true, false])(
    'uninstall ignores unowned tool junctions (IDE metadata=%s)',
    async (metadata) => {
      makeProject(tmp);
      const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
      if (!metadata) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        delete manifest.ides;
        delete manifest.adapterHashes;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      }
      const outside = path.join(tmp, 'custom-cursor');
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, 'keep.txt'), 'Keep custom tool settings');
      fs.symlinkSync(outside, path.join(tmp, '.cursor'), 'junction');
      process.chdir(tmp);
      await uninstall.action({ yes: true });
      expect(process.exitCode).not.toBe(1);
      expect(fs.existsSync(manifestPath)).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(false);
      expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe(
        'Keep custom tool settings'
      );
      expect(fs.lstatSync(path.join(tmp, '.cursor')).isSymbolicLink()).toBe(true);
    }
  );

  test('uninstall still removes hash-owned targets omitted from the current IDE list', async () => {
    makeProject(tmp);
    const entry = generateUserFiles(DERIVED, { packs: ['core'], tools: ['aider'] }).find(
      (file) => file.file === 'CONVENTIONS.md'
    );
    fs.writeFileSync(path.join(tmp, entry.file), entry.content);
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.adapterHashes[entry.file] = contentHash(entry.content);
    manifest.adapterHashes['custom.txt'] = contentHash('User content');
    fs.writeFileSync(path.join(tmp, 'custom.txt'), 'User content');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    process.chdir(tmp);
    await uninstall.action({ yes: true });
    expect(fs.existsSync(path.join(tmp, entry.file))).toBe(false);
    expect(fs.readFileSync(path.join(tmp, 'custom.txt'), 'utf8')).toBe('User content');
  });

  test('uninstall refuses a redirected adapter whose path is recorded as owned', async () => {
    makeProject(tmp);
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.adapterHashes['.codex/AGENTS.md'] = contentHash('Former owned adapter');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const outside = path.join(tmp, 'custom-codex');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'AGENTS.md'), 'Keep external instructions');
    fs.symlinkSync(outside, path.join(tmp, '.codex'), 'junction');
    process.chdir(tmp);
    await uninstall.action({ yes: true });
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(true);
    expect(fs.readFileSync(path.join(outside, 'AGENTS.md'), 'utf8')).toBe(
      'Keep external instructions'
    );
  });
});

test('doctor requires actual agent instructions instead of empty directories', async () => {
  makeProject(tmp);
  fs.mkdirSync(path.join(tmp, '.agents', 'skills', 'agent-strategist'));
  fs.writeFileSync(
    path.join(tmp, '.agents', 'skills', 'agent-strategist', 'SKILL.md'),
    'Strategist instructions'
  );
  await doctor.action({ directory: tmp });
  const errors = clack.log.error.mock.calls.map(([message]) => message).join('\n');
  expect(errors).toContain('agent-architect-dev/SKILL.md');
  expect(errors).not.toContain('agent-strategist/SKILL.md');
});

test('legacy update discovers existing adapters and saves their content before migration', async () => {
  makeProject(tmp);
  const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.ides;
  delete manifest.adapterHashes;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const legacy =
    require('../../tools/cli/lib/installed-adapters').INSTALLER_MARKER + '\nMy old configuration';
  fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), legacy);
  await update.action({ directory: tmp, yes: true });
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md.bak'), 'utf8')).toBe(legacy);
  expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8')).toBe(testAdapter(['core']));
  const updated = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(updated.ides).toEqual(['claude-code']);
});

describe('guarded update execution', () => {
  function ownProject() {
    makeProject(tmp);
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.fileInventory = { schemaVersion: 1, complete: true, files: {} };
    fs.writeFileSync(path.join(tmp, '_bmad', 'module-help.csv'), 'old help');
    for (const file of ['_bmad/module.yaml', '_bmad/module-help.csv']) {
      manifest.fileInventory.files[file] = require('../../tools/cli/lib/pack-copy').fileHash(
        fs.readFileSync(path.join(tmp, file))
      );
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    return manifestPath;
  }

  test.each([
    [{ auto: true }, /expected-version/],
    [{ expectedVersion: '99.0.0' }, /does not match/],
  ])('rejects a missing or wrong exact child version before writes', async (options, message) => {
    makeProject(tmp);
    await update.action({ directory: tmp, yes: true, ...options });
    expect(process.exitCode).toBe(1);
    expect(clack.log.error.mock.calls.flat().join(' ')).toMatch(message);
    expect(fs.existsSync(path.join(tmp, '.bmad'))).toBe(false);
  });

  test('refuses downgrades and leaves the installation untouched', async () => {
    makeProject(tmp, { version: '99.0.0' });
    await update.action({ directory: tmp, yes: true });
    expect(clack.log.error.mock.calls.flat().join(' ')).toMatch(/Downgrade refused/);
    expect(fs.existsSync(path.join(tmp, '.bmad'))).toBe(false);
  });

  test('rejects a noncanonical installed version before mutation', async () => {
    makeProject(tmp, { version: 'v0.0.1' });
    await update.action({ directory: tmp, yes: true });
    expect(process.exitCode).toBe(1);
    expect(clack.log.error.mock.calls.flat().join(' ')).toMatch(/strict semantic versions/);
    expect(fs.existsSync(path.join(tmp, '.bmad'))).toBe(false);
  });

  test.each([{ latest: true }, { expectedVersion: PKG_VERSION }])(
    'rejects ambiguous restore options before dispatch',
    async (options) => {
      const dispatch = jest.spyOn(
        require('../../tools/cli/lib/update-dispatch'),
        'runLatestUpdate'
      );
      makeProject(tmp);
      await update.action({ directory: tmp, yes: true, restore: 'receipt-id', ...options });
      expect(process.exitCode).toBe(1);
      expect(clack.log.error.mock.calls.flat().join(' ')).toMatch(/cannot be combined/);
      expect(dispatch).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(tmp, '.bmad'))).toBe(false);
    }
  );

  test('automatic mode enforces policy and fresh exact metadata, then reauthorizes under lock', async () => {
    const manifestPath = ownProject();
    const policy = require('../../tools/cli/lib/update-policy');
    policy.writeUpdatePolicy(tmp, { mode: 'auto', allowedRange: PKG_VERSION });
    const authorization = jest.spyOn(policy, 'authorizeTarget');
    const check = jest
      .spyOn(require('../../tools/cli/lib/update-check'), 'checkForUpdate')
      .mockResolvedValue({
        source: 'registry',
        stale: false,
        versionEligible: true,
        targetVersion: PKG_VERSION,
      });
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    await update.action({ directory: tmp, auto: true, expectedVersion: PKG_VERSION });
    expect(check).toHaveBeenCalledWith({
      projectDir: tmp,
      runningVersion: PKG_VERSION,
      refresh: true,
    });
    expect(authorization).toHaveBeenCalledTimes(2);
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(JSON.parse(fs.readFileSync(manifestPath)).version).toBe(PKG_VERSION);
  });

  test.each(['policy', 'stale', 'revoked'])(
    'automatic %s refusal does not promote the manifest',
    async (failure) => {
      const manifestPath = ownProject();
      const policy = require('../../tools/cli/lib/update-policy');
      if (failure !== 'policy')
        policy.writeUpdatePolicy(tmp, { mode: 'auto', allowedRange: PKG_VERSION });
      jest
        .spyOn(require('../../tools/cli/lib/update-check'), 'checkForUpdate')
        .mockImplementation(async () => {
          if (failure === 'revoked') policy.writeUpdatePolicy(tmp, { mode: 'notify' });
          return {
            source: 'registry',
            stale: failure === 'stale',
            versionEligible: true,
            targetVersion: PKG_VERSION,
          };
        });
      await update.action({ directory: tmp, auto: true, expectedVersion: PKG_VERSION });
      expect(process.exitCode).toBe(1);
      expect(JSON.parse(fs.readFileSync(manifestPath)).version).toBe('0.0.1');
      expect(fs.existsSync(path.join(tmp, '.bmad', 'update.lock'))).toBe(false);
    }
  );

  test('dispatches --latest before checking the version of the local CLI and prints the child result', async () => {
    const dispatch = jest
      .spyOn(require('../../tools/cli/lib/update-dispatch'), 'runLatestUpdate')
      .mockResolvedValue({
        status: 'updated',
        targetVersion: '0.12.3',
        output: '1 conflict preserved; receipt saved',
        reloadInstructions: true,
      });
    makeProject(tmp);
    await update.action({ directory: tmp, latest: true, expectedVersion: '0.12.3', yes: true });
    expect(dispatch).toHaveBeenCalledWith({ projectDir: tmp, auto: false, yes: true });
    expect(clack.log.info).toHaveBeenCalledWith('1 conflict preserved; receipt saved');
    expect(clack.log.info).toHaveBeenCalledWith(
      'Reload your agent instructions or start a new session.'
    );
  });

  test('reports a dispatcher error without attempting a local update', async () => {
    jest
      .spyOn(require('../../tools/cli/lib/update-dispatch'), 'runLatestUpdate')
      .mockRejectedValue(new Error('Registry unavailable'));
    makeProject(tmp);
    await update.action({ directory: tmp, latest: true });
    expect(process.exitCode).toBe(1);
    expect(clack.log.error).toHaveBeenCalledWith('Registry unavailable');
  });

  test('supports manual restore through its saved receipt and refuses automatic recovery', async () => {
    makeProject(tmp);
    await update.action({ directory: tmp, yes: true });
    const id = fs.readdirSync(path.join(tmp, '.bmad', 'updates'))[0];
    await update.action({ directory: tmp, restore: id, auto: true, yes: true });
    expect(clack.log.error).toHaveBeenCalledWith('Recovery requires manual approval.');
    process.exitCode = exitCode0;
    await update.action({ directory: tmp, restore: id, yes: true });
    expect(
      JSON.parse(fs.readFileSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).version
    ).toBe('0.0.1');
    expect(clack.log.success).toHaveBeenCalledWith('Restored BMAD+ v0.0.1');
  });

  test('cancelling a planned update leaves files untouched', async () => {
    makeProject(tmp);
    clack.confirm.mockResolvedValue(false);
    await update.action({ directory: tmp });
    expect(clack.cancel).toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, '.bmad'))).toBe(false);
  });

  test('installation records inventory without claiming customized files and keeps existing ownership', async () => {
    const install = require('../../tools/cli/commands/install');
    const relative = '.agents/skills/agent-strategist/SKILL.md';
    const target = path.join(tmp, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'My custom Atlas');
    await install.action({ directory: tmp, yes: true, packs: 'core', tools: 'none' });
    const manifestPath = path.join(tmp, '_bmad', '.bmad-plus-install.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    expect(manifest.fileInventory.complete).toBe(false);
    expect(manifest.fileInventory.files[relative]).toBeUndefined();
    expect(Object.keys(manifest.fileInventory.files).length).toBeGreaterThan(10);
    expect(fs.readFileSync(target, 'utf8')).toBe('My custom Atlas');
    await install.action({ directory: tmp, yes: true, packs: 'core', tools: 'none' });
    expect(fs.readFileSync(target, 'utf8')).toBe('My custom Atlas');
  });
});

describe('install over an existing installation', () => {
  const install = require('../../tools/cli/commands/install');
  const manifestPath = () => path.join(tmp, '_bmad', '.bmad-plus-install.json');
  const readManifest = () => JSON.parse(fs.readFileSync(manifestPath(), 'utf8'));
  const readConfig = () =>
    require('js-yaml').load(fs.readFileSync(path.join(tmp, '_bmad', 'config.yaml'), 'utf8'));

  test.each([
    ['99.0.0', /Downgrade refused: BMAD\+ v99\.0\.0 is installed/],
    ['0.0.1', /Run `bmad-plus update` first/],
  ])('refuses a version change from v%s before touching files', async (version, message) => {
    makeProject(tmp, { version });
    const before = fs.readFileSync(manifestPath(), 'utf8');
    await install.action({ directory: tmp, yes: true, packs: 'core', tools: 'none', lang: 'en' });
    expect(process.exitCode).toBe(1);
    expect(clack.log.error.mock.calls.flat().join(' ')).toMatch(message);
    expect(fs.readFileSync(manifestPath(), 'utf8')).toBe(before);
    expect(fs.readFileSync(path.join(tmp, '_bmad', 'config.yaml'), 'utf8')).toBe('mode: manual\n');
    expect(fs.existsSync(path.join(tmp, '.agents', 'skills', 'agent-strategist'))).toBe(false);
  });

  test('keeps existing settings, adds missing defaults, and leaves an unchanged config byte-identical', async () => {
    fs.mkdirSync(path.join(tmp, '_bmad'), { recursive: true });
    const configPath = path.join(tmp, '_bmad', 'config.yaml');
    fs.writeFileSync(
      configPath,
      'user_name: "Ada"\ncommunication_language: "Deutsch"\nexecution_mode: "hybrid"\ncustom_key: 7\n'
    );
    await install.action({ directory: tmp, yes: true, packs: 'core', tools: 'none', lang: 'en' });
    const config = readConfig();
    expect(config).toMatchObject({
      user_name: 'Ada',
      communication_language: 'Deutsch',
      execution_mode: 'hybrid',
      custom_key: 7,
    });
    expect(config.output_folder).toBe('_bmad-output');
    expect(config.uat.mode).toBe('advisory');
    expect(readManifest()).toMatchObject({
      user: 'Ada',
      language: 'Deutsch',
      executionMode: 'hybrid',
    });
    const merged = fs.readFileSync(configPath, 'utf8');
    await install.action({ directory: tmp, yes: true, packs: 'core', tools: 'none', lang: 'en' });
    expect(fs.readFileSync(configPath, 'utf8')).toBe(merged);
  });

  test('an explicit --mode replaces the stored mode; an unparsable config is left untouched', async () => {
    const { mergeConfigYaml } = install._internal;
    const generated = install._internal.generateConfigYaml('Dev', 'English', tmp, 'manual');
    const merged = mergeConfigYaml('execution_mode: "hybrid"\n', generated, {
      execution_mode: 'autopilot',
    });
    expect(require('js-yaml').load(merged.content).execution_mode).toBe('autopilot');
    expect(mergeConfigYaml('- not\n- a mapping\n', generated)).toBeNull();
    expect(mergeConfigYaml('a: [unclosed', generated)).toBeNull();
    fs.mkdirSync(path.join(tmp, '_bmad'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '_bmad', 'config.yaml'), 'a: [unclosed');
    await install.action({ directory: tmp, yes: true, packs: 'core', tools: 'none', lang: 'en' });
    expect(fs.readFileSync(path.join(tmp, '_bmad', 'config.yaml'), 'utf8')).toBe('a: [unclosed');
    expect(clack.log.warn.mock.calls.flat().join(' ')).toMatch(/config\.yaml could not be parsed/);
  });

  test('a pack subset adds to the installed packs and keeps owned tools', async () => {
    await install.action({
      directory: tmp,
      yes: true,
      packs: 'core,maker',
      tools: 'claude-code',
      lang: 'en',
    });
    await install.action({ directory: tmp, yes: true, packs: 'osint', tools: 'none', lang: 'en' });
    const manifest = readManifest();
    expect(manifest.packs).toEqual(['core', 'osint', 'maker']);
    expect(manifest.ides).toEqual(['claude-code']);
    expect(fs.existsSync(path.join(tmp, '.agents', 'skills', 'agent-maker'))).toBe(true);
  });

  test.each([
    [{ packs: 'core,osnit' }, /Unknown pack ID\(s\): osnit\. Available: core, osint/],
    [{ tools: 'claude-code,vscodee' }, /Unknown tool ID\(s\): vscodee\./],
  ])('rejects unknown IDs before writing anything (%o)', async (options, message) => {
    await expect(
      install.action({ directory: tmp, yes: true, lang: 'en', ...options })
    ).rejects.toThrow(message);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  test('--yes without a detected tool writes no adapter and uses the --lang language', async () => {
    await install.action({ directory: tmp, yes: true, packs: 'core', lang: 'fr' });
    expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(false);
    expect(readManifest().ides).toEqual([]);
    expect(readConfig().communication_language).toBe('Français');
    expect(clack.log.info.mock.calls.flat().join(' ')).toMatch(/No AI tool detected/);
  });

  test('communication language falls back from --lang to the locale, then English', () => {
    const { communicationLanguage } = install._internal;
    expect(communicationLanguage('es', 'de-DE')).toBe('Español');
    expect(communicationLanguage(undefined, 'pt-BR')).toBe('Português (Brasil)');
    expect(communicationLanguage(undefined, 'de-AT')).toBe('Deutsch');
    expect(communicationLanguage(undefined, 'ko-KR')).toBe('English');
  });

  test('uninstall targets --directory instead of the working directory', async () => {
    makeProject(tmp);
    await uninstall.action({ directory: tmp, yes: true });
    expect(fs.existsSync(manifestPath())).toBe(false);
    await uninstall.action({ directory: path.join(tmp, 'missing'), yes: true });
    expect(process.exitCode).toBe(1);
    expect(clack.log.error.mock.calls.flat().join(' ')).toMatch(/Project directory not found/);
  });

  test('installer labels packs with their registry emoji, never glyph letters', async () => {
    await install.action({
      directory: tmp,
      yes: true,
      packs: 'core,osint',
      tools: 'none',
      lang: 'en',
    });
    const selected = clack.log.success.mock.calls.flat().find((line) => /Core/.test(line));
    expect(selected).toContain(DERIVED.packs.core.iconEmoji + ' Core');
    expect(selected).not.toMatch(/\bb Core\b/);
  });
});
