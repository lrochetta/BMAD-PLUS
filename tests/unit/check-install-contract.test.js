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
