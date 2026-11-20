/**
 * BMAD+ Pack-Copy — Unit Tests
 * Tests for the shared pack-copy module extracted from install.js and update.js.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { copyPackFiles, copyManagedFile, fileHash } = require('../../tools/cli/lib/pack-copy');

describe('pack-copy — copyPackFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-pc-'));
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should return zero counts for null pack', () => {
    const result = copyPackFiles({
      bmadSrc: tmpDir,
      targetAgentsDir: tmpDir,
      targetDataDir: tmpDir,
      projectRoot: tmpDir,
      pack: null,
    });
    expect(result).toEqual({ copiedAgents: 0, copiedSkills: 0, copiedFiles: 0 });
  });

  test('records exact binary hashes and preserves unknown and edited destinations on reinstall', () => {
    const source = path.join(tmpDir, 'source.bin');
    const target = path.join(tmpDir, 'project', 'asset.bin');
    const projectDir = path.dirname(target);
    const original = Buffer.from([0, 255, 13, 10, 128]);
    fs.writeFileSync(source, original);
    const inventory = {};
    copyManagedFile({ source, target, projectDir, inventory });
    expect(fs.readFileSync(target)).toEqual(original);
    expect(inventory['asset.bin']).toBe(fileHash(original));
    fs.writeFileSync(source, Buffer.from([2, 254]));
    const onConflict = jest.fn();
    copyManagedFile({ source, target, projectDir, inventory: {}, onConflict });
    expect(fs.readFileSync(target)).toEqual(original);
    expect(onConflict).toHaveBeenCalledWith('asset.bin');
    copyManagedFile({ source, target, projectDir, inventory, previousInventory: { ...inventory } });
    expect(fs.readFileSync(target)).toEqual(Buffer.from([2, 254]));
    const owned = { ...inventory };
    fs.writeFileSync(target, Buffer.from([42]));
    copyManagedFile({ source, target, projectDir, inventory, previousInventory: owned });
    expect(fs.readFileSync(target)).toEqual(Buffer.from([42]));
    expect(inventory).toEqual(owned);
  });

  test('should return zero counts for undefined pack', () => {
    const result = copyPackFiles({
      bmadSrc: tmpDir,
      targetAgentsDir: tmpDir,
      targetDataDir: tmpDir,
      projectRoot: tmpDir,
      pack: undefined,
    });
    expect(result).toEqual({ copiedAgents: 0, copiedSkills: 0, copiedFiles: 0 });
  });

  test('should copy agent files when source exists', () => {
    const srcDir = path.join(tmpDir, 'src', 'bmad-plus');
    const targetAgents = path.join(tmpDir, 'target', 'agents');
    const targetData = path.join(tmpDir, 'target', 'data');
    fs.mkdirSync(path.join(srcDir, 'agents', 'test-agent'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'agents', 'test-agent', 'SKILL.md'), '# Test Agent');

    const result = copyPackFiles({
      bmadSrc: srcDir,
      targetAgentsDir: targetAgents,
      targetDataDir: targetData,
      projectRoot: tmpDir,
      pack: { agents: ['test-agent'], skills: [], data: [] },
    });

    expect(result.copiedAgents).toBe(1);
    expect(fs.existsSync(path.join(targetAgents, 'test-agent', 'SKILL.md'))).toBe(true);
  });

  test('should handle missing agent source files gracefully', () => {
    const result = copyPackFiles({
      bmadSrc: tmpDir,
      targetAgentsDir: tmpDir,
      targetDataDir: tmpDir,
      projectRoot: tmpDir,
      pack: { agents: ['nonexistent-agent'], skills: [], data: [] },
    });
    expect(result.copiedAgents).toBe(0);
  });

  test('should copy skill files when source exists', () => {
    const srcDir = path.join(tmpDir, 'src', 'bmad-plus');
    const targetAgents = path.join(tmpDir, 'target', 'agents');
    const targetData = path.join(tmpDir, 'target', 'data');
    fs.mkdirSync(path.join(srcDir, 'skills', 'test-skill'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'skills', 'test-skill', 'skill.md'), '# Skill');

    const result = copyPackFiles({
      bmadSrc: srcDir,
      targetAgentsDir: targetAgents,
      targetDataDir: targetData,
      projectRoot: tmpDir,
      pack: { agents: [], skills: ['test-skill'], data: [] },
    });

    expect(result.copiedSkills).toBe(1);
    expect(fs.existsSync(path.join(targetAgents, 'test-skill', 'skill.md'))).toBe(true);
  });

  test('should copy data files when source exists', () => {
    const srcDir = path.join(tmpDir, 'src', 'bmad-plus');
    const targetAgents = path.join(tmpDir, 'target', 'agents');
    const targetData = path.join(tmpDir, 'target', 'data');
    fs.mkdirSync(path.join(srcDir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'data', 'config.yaml'), 'key: value');

    const result = copyPackFiles({
      bmadSrc: srcDir,
      targetAgentsDir: targetAgents,
      targetDataDir: targetData,
      projectRoot: tmpDir,
      pack: { agents: [], skills: [], data: ['config.yaml'] },
    });

    expect(result.copiedFiles).toBe(1);
    expect(fs.existsSync(path.join(targetData, 'config.yaml'))).toBe(true);
  });

  test('should copy external package skills when pack.externalPackage is set', () => {
    const srcDir = path.join(tmpDir, 'src', 'bmad-plus');
    const targetAgents = path.join(tmpDir, 'target', 'agents');
    const targetData = path.join(tmpDir, 'target', 'data');

    // Create external package skill
    fs.mkdirSync(path.join(tmpDir, 'ext-pkg', 'skills', 'ext-skill'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ext-pkg', 'skills', 'ext-skill', 'tool.js'), '// tool');

    const result = copyPackFiles({
      bmadSrc: srcDir,
      targetAgentsDir: targetAgents,
      targetDataDir: targetData,
      projectRoot: tmpDir,
      pack: { agents: [], skills: [], data: [], externalPackage: 'ext-pkg' },
    });

    expect(result.copiedSkills).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(targetAgents, 'ext-skill', 'tool.js'))).toBe(true);
  });

  test('should copy packDir when pack.packDir is set', () => {
    const srcDir = path.join(tmpDir, 'src', 'bmad-plus');
    const targetAgents = path.join(tmpDir, 'target', 'agents');
    const targetData = path.join(tmpDir, 'target', 'data');

    fs.mkdirSync(path.join(srcDir, 'agents', 'shield-pack'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'agents', 'shield-pack', 'GRC.md'), '# GRC');

    const result = copyPackFiles({
      bmadSrc: srcDir,
      targetAgentsDir: targetAgents,
      targetDataDir: targetData,
      projectRoot: tmpDir,
      pack: { agents: [], skills: [], data: [], packDir: 'shield-pack' },
    });

    expect(result.copiedAgents).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(targetAgents, 'shield-pack', 'GRC.md'))).toBe(true);
  });
});

describe('pack-copy — external_module skills', () => {
  const { listPackFiles, externalModuleRoot } = require('../../tools/cli/lib/pack-copy');
  let root;
  const fakeModule = (base, { version = '1.0.0', skills = ['x'] } = {}) => {
    const dir = path.join(base, 'node_modules', 'fake-skill');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'fake-skill', version })
    );
    for (const id of skills) {
      fs.mkdirSync(path.join(dir, 'skills', id, 'ref'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'skills', id, 'SKILL.md'), '# ' + id);
      fs.writeFileSync(path.join(dir, 'skills', id, 'ref', 'notes.md'), 'notes');
    }
    return dir;
  };
  const pack = (version = '1.0.0', skills = ['x']) => ({
    agents: [],
    skills: [],
    externalModule: { package: 'fake-skill', version, skills },
  });
  const options = (extra = {}) => ({
    bmadSrc: path.join(root, 'src', 'bmad-plus'),
    targetAgentsDir: path.join(root, 'project', '.agents', 'skills'),
    targetDataDir: path.join(root, 'project', '.agents', 'data'),
    projectRoot: root,
    projectDir: path.join(root, 'project'),
    ...extra,
  });

  beforeEach(() => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-extmod-')));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('copies each listed skill from the resolved package into .agents/skills/<id>/, hashed like any file', () => {
    fakeModule(root, { skills: ['x', 'y'] });
    const inventory = {};
    const result = copyPackFiles(options({ pack: pack('1.0.0', ['x', 'y']), inventory }));
    expect(result).toEqual({ copiedAgents: 0, copiedSkills: 2, copiedFiles: 0 });
    expect(fs.readFileSync(path.join(root, 'project/.agents/skills/x/SKILL.md'), 'utf8')).toBe(
      '# x'
    );
    expect(fs.existsSync(path.join(root, 'project/.agents/skills/y/ref/notes.md'))).toBe(true);
    expect(Object.keys(inventory).sort()).toEqual([
      '.agents/skills/x/SKILL.md',
      '.agents/skills/x/ref/notes.md',
      '.agents/skills/y/SKILL.md',
      '.agents/skills/y/ref/notes.md',
    ]);
    const listed = listPackFiles(options({ pack: pack() }));
    const moduleRoot = path.join(root, 'node_modules', 'fake-skill');
    expect(listed.files.map((entry) => entry.root)).toEqual([moduleRoot, moduleRoot]);
  });

  test('refuses a version other than the pinned one, a missing package and a missing skill', () => {
    // Node remembers a failed lookup for the life of the process: the empty root is its own tree.
    const empty = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-extmod-empty-'))
    );
    try {
      expect(() => copyPackFiles(options({ pack: pack(), projectRoot: empty }))).toThrow(
        /fake-skill is not installed next to BMAD\+/
      );
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
    fakeModule(root, { version: '1.0.1' });
    expect(() => copyPackFiles(options({ pack: pack() }))).toThrow(
      /fake-skill is 1\.0\.1 but this BMAD\+ expects exactly 1\.0\.0/
    );
    fakeModule(root);
    expect(() => copyPackFiles(options({ pack: pack('1.0.0', ['x', 'z']) }))).toThrow(
      /fake-skill does not ship skill z/
    );
    expect(fs.existsSync(path.join(root, 'project', '.agents'))).toBe(false);
  });

  test('takes an injected resolver and refuses a package reached through a symlink', () => {
    const installed = fakeModule(root);
    const resolve = jest.fn(() => path.join(installed, 'package.json'));
    expect(
      externalModuleRoot({ externalModule: pack().externalModule, projectRoot: root, resolve })
    ).toBe(installed);
    expect(resolve).toHaveBeenCalledWith('fake-skill', root);
    const elsewhere = fakeModule(path.join(root, 'elsewhere'));
    const outside = jest.fn(() => path.join(elsewhere, 'package.json'));
    expect(() =>
      externalModuleRoot({
        externalModule: pack().externalModule,
        projectRoot: root,
        resolve: outside,
      })
    ).toThrow(/outside the node_modules chain/);
    fs.rmSync(installed, { recursive: true, force: true });
    fs.symlinkSync(elsewhere, installed, 'junction');
    expect(() => copyPackFiles(options({ pack: pack() }))).toThrow(
      /outside the node_modules chain/
    );
    const nested = path.join(root, 'app', 'node_modules', 'bmad-plus');
    fs.mkdirSync(nested, { recursive: true });
    fakeModule(path.join(root, 'app'));
    expect(copyPackFiles(options({ pack: pack(), projectRoot: nested })).copiedSkills).toBe(1);
  });
});
