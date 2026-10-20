/**
 * BMAD+ CLI — Autoconfig Integration Tests
 * Functional tests for the autoconfig command
 *
 * Run: npx jest tests/integration/autoconfig.test.js
 */

const path = require('node:path');
const fs = require('node:fs');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Autoconfig — Functional Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Autoconfig — Functional Tests', () => {
  // Mock ESM-only dependencies that can't be loaded by Jest
  jest.mock('@clack/prompts', () => ({
    intro: jest.fn(),
    outro: jest.fn(),
    log: { info: jest.fn(), error: jest.fn(), success: jest.fn() },
    spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
    select: jest.fn(),
    multiselect: jest.fn(),
    confirm: jest.fn(),
    isCancel: jest.fn(),
  }));
  jest.mock('picocolors', () => ({
    green: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    blue: (s) => s,
    cyan: (s) => s,
    dim: (s) => s,
    bold: (s) => s,
    white: (s) => s,
    bgMagenta: (s) => s,
    bgCyan: (s) => s,
    black: (s) => s,
  }));

  const autoconfigModule = require('../../tools/cli/commands/autoconfig');
  const {
    detectStack,
    analyzeStructure,
    calculateHealth,
    recommendPacks,
    generateRecommendations,
    getProjectName,
  } = autoconfigModule._internal;

  const tmpDir = path.join(__dirname, '../..', '_test_tmp_autoconfig');

  beforeAll(() => {
    const fsExtra = require('fs-extra');
    fsExtra.ensureDirSync(tmpDir);

    // Complete project with everything
    const fullProj = path.join(tmpDir, 'full-project');
    fsExtra.ensureDirSync(path.join(fullProj, 'src'));
    fsExtra.ensureDirSync(path.join(fullProj, 'tests'));
    fsExtra.ensureDirSync(path.join(fullProj, 'docs'));
    fsExtra.ensureDirSync(path.join(fullProj, '.github'));
    fsExtra.ensureDirSync(path.join(fullProj, '.git'));
    fs.writeFileSync(
      path.join(fullProj, 'package.json'),
      JSON.stringify({
        name: 'full-project',
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(fullProj, 'tsconfig.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'Dockerfile'), 'FROM node:22', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'LICENSE'), 'MIT', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'README.md'), '# Full Project', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'pnpm-lock.yaml'), '', 'utf8');

    // Minimal project (only package.json)
    const minProj = path.join(tmpDir, 'minimal');
    fsExtra.ensureDirSync(minProj);
    fs.writeFileSync(
      path.join(minProj, 'package.json'),
      JSON.stringify({
        name: 'minimal',
        dependencies: { express: '^4.18.0' },
      }),
      'utf8'
    );

    // Python project
    const pyProj = path.join(tmpDir, 'py-project');
    fsExtra.ensureDirSync(pyProj);
    fs.writeFileSync(path.join(pyProj, 'pyproject.toml'), '[project]\nname="py-project"', 'utf8');
    fs.writeFileSync(path.join(pyProj, 'requirements.txt'), 'flask\n', 'utf8');

    // Go project
    const goProj = path.join(tmpDir, 'go-api');
    fsExtra.ensureDirSync(goProj);
    fs.writeFileSync(path.join(goProj, 'go.mod'), 'module go-api', 'utf8');

    // Project with BMAD+ and IDE configs
    const bmadProj = path.join(tmpDir, 'bmad-existing');
    fsExtra.ensureDirSync(path.join(bmadProj, '.agents'));
    fsExtra.ensureDirSync(path.join(bmadProj, '_bmad'));
    fs.writeFileSync(
      path.join(bmadProj, 'package.json'),
      JSON.stringify({ name: 'bmad-existing' }),
      'utf8'
    );
    fs.writeFileSync(path.join(bmadProj, 'CLAUDE.md'), '# Claude', 'utf8');
    fs.writeFileSync(path.join(bmadProj, 'GEMINI.md'), '# Gemini', 'utf8');
    fs.writeFileSync(path.join(bmadProj, 'AGENTS.md'), '# Agents', 'utf8');

    // Empty project
    const emptyProj = path.join(tmpDir, 'empty-proj');
    fsExtra.ensureDirSync(emptyProj);
  });

  afterAll(() => {
    const fsExtra = require('fs-extra');
    fsExtra.removeSync(tmpDir);
  });

  // ── detectStack ──

  test('detectStack should detect Next.js + TypeScript', () => {
    const stack = detectStack(path.join(tmpDir, 'full-project'));
    expect(stack.framework).toBe('Next.js');
    expect(stack.language).toBe('TypeScript');
    expect(stack.runtime).toBe('Node.js');
    expect(stack.hasTypeScript).toBe(true);
    expect(stack.packageManager).toBe('pnpm');
  });

  test('detectStack should detect Express', () => {
    const stack = detectStack(path.join(tmpDir, 'minimal'));
    expect(stack.framework).toBe('Express');
    expect(stack.language).toBe('JavaScript');
    expect(stack.packageManager).toBe('npm');
  });

  test('detectStack should detect Python', () => {
    const stack = detectStack(path.join(tmpDir, 'py-project'));
    expect(stack.language).toBe('Python');
    expect(stack.runtime).toBe('Python');
  });

  test('detectStack should detect Go', () => {
    const stack = detectStack(path.join(tmpDir, 'go-api'));
    expect(stack.language).toBe('Go');
    expect(stack.runtime).toBe('Go');
  });

  test('detectStack should return null fields for empty dir', () => {
    const stack = detectStack(path.join(tmpDir, 'empty-proj'));
    expect(stack.language).toBeNull();
    expect(stack.framework).toBeNull();
    expect(stack.runtime).toBeNull();
  });

  // ── analyzeStructure ──

  test('analyzeStructure should detect all structure elements in full project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    expect(structure.hasSrc).toBe(true);
    expect(structure.hasTests).toBe(true);
    expect(structure.hasDocs).toBe(true);
    expect(structure.hasCI).toBe(true);
    expect(structure.hasDocker).toBe(true);
    expect(structure.hasLicense).toBe(true);
    expect(structure.hasReadme).toBe(true);
    expect(structure.hasGit).toBe(true);
  });

  test('analyzeStructure should detect minimal project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'minimal'));
    expect(structure.hasSrc).toBe(false);
    expect(structure.hasTests).toBe(false);
    expect(structure.hasDocs).toBe(false);
    expect(structure.fileCount).toBeGreaterThan(0);
  });

  test('analyzeStructure should detect BMAD+ installation', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'bmad-existing'));
    expect(structure.hasBmad).toBe(true);
    expect(structure.hasIdeConfigs).toContain('claude-code');
    expect(structure.hasIdeConfigs).toContain('gemini-cli');
    expect(structure.hasIdeConfigs).toContain('codex-cli');
    expect(structure.hasIdeConfigs).toHaveLength(3);
  });

  test('analyzeStructure should list directories', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    expect(structure.directories).toContain('src');
    expect(structure.directories).toContain('tests');
    expect(structure.directories).toContain('docs');
  });

  // ── calculateHealth ──

  test('calculateHealth should score 100% for full project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    const health = calculateHealth(structure);
    expect(health.pct).toBe(100);
    expect(health.checks.every((c) => c.pass)).toBe(true);
  });

  test('calculateHealth should score low for minimal project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'minimal'));
    const health = calculateHealth(structure);
    expect(health.pct).toBeLessThan(50);
  });

  test('calculateHealth checks should have weights', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    const health = calculateHealth(structure);
    expect(health.checks.length).toBeGreaterThanOrEqual(7);
    for (const check of health.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('pass');
      expect(check).toHaveProperty('weight');
      expect(check.weight).toBeGreaterThan(0);
    }
  });

  // ── recommendPacks ──

  test('recommendPacks should always include core and memory', () => {
    const stack = { framework: null, language: 'JavaScript', runtime: 'Node.js' };
    const structure = { hasDocs: true, hasCI: false, hasDocker: false, directories: [] };
    const health = { pct: 50 };
    const { packs } = recommendPacks(stack, structure, health);
    expect(packs).toContain('core');
    expect(packs).toContain('memory');
  });

  test('recommendPacks should recommend seo for web frameworks', () => {
    const stack = { framework: 'Next.js', language: 'TypeScript', runtime: 'Node.js' };
    const structure = { hasDocs: true, hasCI: false, hasDocker: false, directories: [] };
    const health = { pct: 80 };
    const { packs, reasons } = recommendPacks(stack, structure, health);
    expect(packs).toContain('seo');
    expect(reasons.seo).toContain('Next.js');
  });

  test('recommendPacks should recommend shield for CI/CD projects', () => {
    const stack = { framework: 'Express', language: 'JavaScript', runtime: 'Node.js' };
    const structure = { hasDocs: true, hasCI: true, hasDocker: false, directories: [] };
    const health = { pct: 70 };
    const { packs } = recommendPacks(stack, structure, health);
    expect(packs).toContain('shield');
  });

  test('recommendPacks should recommend dev-studio when no docs', () => {
    const stack = { framework: null, language: 'JavaScript', runtime: 'Node.js' };
    const structure = { hasDocs: false, hasCI: false, hasDocker: false, directories: [] };
    const health = { pct: 30 };
    const { packs, reasons } = recommendPacks(stack, structure, health);
    expect(packs).toContain('dev-studio');
    expect(reasons['dev-studio']).toContain('docs');
  });

  // ── generateRecommendations ──

  test('generateRecommendations should suggest Sentinel for missing tests', () => {
    const stack = { framework: null };
    const structure = { hasTests: false, hasDocs: true, hasCI: true, hasSrc: true };
    const health = { pct: 60 };
    const recs = generateRecommendations(stack, structure, health);
    const sentinel = recs.find((r) => r.agent === 'Sentinel' && r.action.includes('test'));
    expect(sentinel).toBeDefined();
    expect(sentinel.priority).toBe('high');
  });

  test('generateRecommendations should suggest Forge for missing docs', () => {
    const stack = { framework: null };
    const structure = { hasTests: true, hasDocs: false, hasCI: true, hasSrc: true };
    const health = { pct: 70 };
    const recs = generateRecommendations(stack, structure, health);
    const forge = recs.find((r) => r.agent === 'Forge' && r.action.includes('document'));
    expect(forge).toBeDefined();
  });

  test('generateRecommendations should always include Zecher', () => {
    const stack = { framework: null };
    const structure = { hasTests: true, hasDocs: true, hasCI: true, hasSrc: true };
    const health = { pct: 100 };
    const recs = generateRecommendations(stack, structure, health);
    const zecher = recs.find((r) => r.agent === 'Zecher');
    expect(zecher).toBeDefined();
  });

  test('generateRecommendations should flag low health', () => {
    const stack = { framework: null };
    const structure = { hasTests: false, hasDocs: false, hasCI: false, hasSrc: false };
    const health = { pct: 20 };
    const recs = generateRecommendations(stack, structure, health);
    const healthRec = recs.find((r) => r.action.includes('health'));
    expect(healthRec).toBeDefined();
    expect(healthRec.priority).toBe('high');
  });

  // ── getProjectName ──

  test('getProjectName should read from package.json', () => {
    expect(getProjectName(path.join(tmpDir, 'full-project'))).toBe('full-project');
  });

  test('getProjectName should fallback to dirname', () => {
    expect(getProjectName(path.join(tmpDir, 'empty-proj'))).toBe('empty-proj');
  });
});
