const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveWithin, verifyInstallation } = require('../../tools/build/check-install-contract');

describe('installed adapter contract checker', () => {
  let projectDir;
  let contract;
  let files;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-contract-checker-test-'));
    fs.mkdirSync(path.join(projectDir, '_bmad'));
    fs.writeFileSync(
      path.join(projectDir, '_bmad', '.bmad-plus-install.json'),
      JSON.stringify({
        packs: ['core'],
        ides: ['claude-code'],
        user: 'Test User',
        language: 'French',
      })
    );
    files = [
      { file: 'AGENTS.md', content: '# Project agents\n\nCore agents.\n', spine: true, tools: [] },
      { file: 'CLAUDE.md', content: '# Claude\n\nRead AGENTS.md.\n', tools: ['claude-code'] },
    ];
    for (const { file, content } of files) fs.writeFileSync(path.join(projectDir, file), content);
    contract = {
      packs: ['core'],
      tools: ['claude-code'],
      derived: { targets: { spine: 'AGENTS.md' } },
      ideConfigs: {
        'claude-code': { configFile: 'CLAUDE.md' },
        cursor: { configFile: '.cursor/rules/bmad-plus.mdc' },
      },
      renderFiles: jest.fn(() => files),
    };
  });

  afterEach(() => {
    const parent = fs.realpathSync(os.tmpdir());
    const actual = fs.realpathSync(projectDir);
    expect(path.dirname(actual)).toBe(parent);
    expect(path.basename(actual).startsWith('bmad-contract-checker-test-')).toBe(true);
    fs.rmSync(actual, { recursive: true, force: true });
  });

  test('compares every file and renders with the actual installed user and language', () => {
    // EOL differences are the only allowed byte-level difference.
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), files[1].content.replace(/\n/g, '\r\n'));
    expect(verifyInstallation(projectDir, contract)).toBe(2);
    expect(contract.renderFiles).toHaveBeenCalledWith(contract.derived, {
      packs: ['core'],
      tools: ['claude-code'],
      userName: 'Test User',
      language: 'French',
    });
  });

  test('fails when an installed adapter drifts from the renderer', () => {
    fs.appendFileSync(path.join(projectDir, 'CLAUDE.md'), '\nUnexpected instructions.\n');
    expect(() => verifyInstallation(projectDir, contract)).toThrow(
      'differs from renderer: CLAUDE.md'
    );
  });

  test('fails when the installer omits the root spine', () => {
    fs.unlinkSync(path.join(projectDir, 'AGENTS.md'));
    expect(() => verifyInstallation(projectDir, contract)).toThrow(
      'Missing installed file: AGENTS.md'
    );
  });

  test('fails even when both the renderer and installer omit a selected target', () => {
    files.pop();
    fs.unlinkSync(path.join(projectDir, 'CLAUDE.md'));
    expect(() => verifyInstallation(projectDir, contract)).toThrow(
      'Renderer omitted the claude-code adapter'
    );
  });

  test('fails when the manifest silently drops requested packs or tools', () => {
    expect(() => verifyInstallation(projectDir, { ...contract, packs: ['core', 'osint'] })).toThrow(
      'Manifest packs differs'
    );
    expect(() =>
      verifyInstallation(projectDir, { ...contract, tools: ['claude-code', 'cursor'] })
    ).toThrow('Manifest ides differs');
  });

  test('fails when an unselected adapter is emitted', () => {
    const cursorFile = resolveWithin(projectDir, contract.ideConfigs.cursor.configFile);
    fs.mkdirSync(path.dirname(cursorFile), { recursive: true });
    fs.writeFileSync(cursorFile, '# Unrequested cursor config');
    expect(() => verifyInstallation(projectDir, contract)).toThrow(
      'Unselected adapter was installed'
    );
  });

  test('rejects paths outside the temporary project before reading them', () => {
    for (const unsafe of ['../outside.md', '/outside.md', 'C:\\outside.md', '']) {
      expect(() => resolveWithin(projectDir, unsafe)).toThrow();
    }
  });
});

describe('external modules beside the extracted npm archive', () => {
  const { provisionExternalModules } = require('../../tools/build/check-install-contract');
  const registry = {
    packs: {
      core: {},
      design: { external_module: { package: 'fake-skill', version: '1.2.3', skills: ['x'] } },
    },
  };
  let sourceRoot;
  let packageRoot;

  const fakeModule = ({ version = '1.2.3', skills = ['x'] } = {}) => {
    const dir = path.join(sourceRoot, 'node_modules', 'fake-skill');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'fake-skill', version })
    );
    for (const id of skills) {
      fs.mkdirSync(path.join(dir, 'skills', id), { recursive: true });
      fs.writeFileSync(path.join(dir, 'skills', id, 'SKILL.md'), `# ${id}\n`);
    }
    return dir;
  };

  beforeEach(() => {
    sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-contract-modules-src-'));
    packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-contract-modules-pkg-'));
  });

  afterEach(() => {
    for (const dir of [sourceRoot, packageRoot]) fs.rmSync(dir, { recursive: true, force: true });
  });

  test('copies the lockfile-installed module into the package node_modules chain as real files', () => {
    fakeModule();
    expect(provisionExternalModules(packageRoot, registry, { sourceRoot })).toEqual([
      'fake-skill@1.2.3',
    ]);
    const copied = path.join(packageRoot, 'node_modules', 'fake-skill');
    expect(fs.lstatSync(copied).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(copied, 'skills', 'x', 'SKILL.md'), 'utf8')).toBe('# x\n');
    expect(provisionExternalModules(packageRoot, { packs: { core: {} } }, { sourceRoot })).toEqual(
      []
    );
  });

  test('refuses a bad name, a missing module, a version other than the pinned one and a missing skill', () => {
    const odd = {
      packs: { x: { external_module: { package: '../x', version: '1.0.0', skills: [] } } },
    };
    expect(() => provisionExternalModules(packageRoot, odd, { sourceRoot })).toThrow(
      /not an npm package name/
    );
    expect(() => provisionExternalModules(packageRoot, registry, { sourceRoot })).toThrow(
      /fake-skill is not installed as a directory/
    );
    fakeModule({ version: '1.2.4' });
    expect(() => provisionExternalModules(packageRoot, registry, { sourceRoot })).toThrow(
      /installed fake-skill@1.2.4 is not the pinned fake-skill@1.2.3/
    );
    fakeModule({ skills: ['y'] });
    expect(() => provisionExternalModules(packageRoot, registry, { sourceRoot })).toThrow(
      /does not ship skills\/x\/SKILL.md/
    );
  });

  test('refuses to overwrite a module the archive already carries', () => {
    fakeModule();
    fs.mkdirSync(path.join(packageRoot, 'node_modules', 'fake-skill'), { recursive: true });
    expect(() => provisionExternalModules(packageRoot, registry, { sourceRoot })).toThrow(
      /npm archive must not ship fake-skill/
    );
  });
});
