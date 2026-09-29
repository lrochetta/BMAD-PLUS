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
