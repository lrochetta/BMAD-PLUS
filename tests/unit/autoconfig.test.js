/**
 * BMAD+ Autoconfig — Unit Tests
 * Tests for internal utility functions with adapted signatures.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { _internal } = require('../../tools/cli/commands/autoconfig');
const {
  analyzeStructure,
  calculateHealth,
  getProjectName,
  recommendPacks,
  generateRecommendations,
} = _internal;

describe('autoconfig — Utility functions', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-autoconfig-'));
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('analyzeStructure should handle non-existent directory gracefully', () => {
    const result = analyzeStructure('/nonexistent/path/that/does/not/exist');
    expect(result).toBeDefined();
    expect(result.fileCount).toBe(0);
  });

  test('getProjectName should handle invalid package.json gracefully', () => {
    const projDir = path.join(tmpDir, 'bad-pkg');
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, 'package.json'), '{ broken json !! }');
    const name = getProjectName(projDir);
    expect(typeof name).toBe('string');
  });

  test('calculateHealth should return health score for a project structure', () => {
    const structure = {
      hasSrc: true,
      hasTests: true,
      hasDocs: false,
      hasCI: false,
      hasDocker: false,
      hasGit: true,
      hasReadme: false,
      hasLicense: false,
    };
    const health = calculateHealth(structure);
    expect(typeof health.pct).toBe('number');
    expect(health.pct).toBeGreaterThanOrEqual(0);
    expect(health.pct).toBeLessThanOrEqual(100);
    expect(Array.isArray(health.checks)).toBe(true);
  });

  test('recommendPacks should return pack recommendations', () => {
    const stack = { language: 'JavaScript', framework: 'React' };
    const structure = {
      hasTests: true,
      hasCI: false,
      hasDocker: false,
      hasSrc: true,
      hasDocs: true,
      directories: ['src'],
    };
    const health = { pct: 75, checks: [] };
    const result = recommendPacks(stack, structure, health);
    expect(result).toBeDefined();
    expect(Array.isArray(result.packs)).toBe(true);
    expect(result.packs).toContain('core');
    expect(result.packs).toContain('memory');
    expect(typeof result.reasons).toBe('object');
  });

  test('generateRecommendations should return array of recommendation objects', () => {
    const stack = { language: 'JavaScript', framework: 'React' };
    const structure = { hasTests: true, hasCI: false, hasDocker: false, hasSrc: true };
    const health = { pct: 75, checks: [] };
    const recs = generateRecommendations(stack, structure, health);
    expect(Array.isArray(recs)).toBe(true);
    recs.forEach((r) => {
      expect(typeof r).toBe('object');
      expect(typeof r.agent).toBe('string');
      expect(typeof r.action).toBe('string');
      expect(typeof r.priority).toBe('string');
    });
  });
});
