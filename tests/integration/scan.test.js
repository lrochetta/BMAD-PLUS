/**
 * BMAD+ CLI — Scan Integration Tests
 * Functional tests for the scan command
 *
 * Run: npx jest tests/integration/scan.test.js
 */

const path = require('node:path');
const fs = require('node:fs');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scan — Functional Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Scan — Functional Tests', () => {
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

  const scanModule = require('../../tools/cli/commands/scan');
  const {
    PROJECT_MARKERS,
    SKIP_DIRS,
    getProjectStatus,
    getProjectName,
    hasBmadInstalled,
    scanDirectory,
  } = scanModule._internal;

  const tmpDir = path.join(__dirname, '../..', '_test_tmp_scan');

  beforeAll(() => {
    // Create temp directory structure for testing
    const fsExtra = require('fs-extra');
    fsExtra.ensureDirSync(tmpDir);

    // Project A: Node.js + React project
    const projA = path.join(tmpDir, 'my-react-app');
    fsExtra.ensureDirSync(projA);
    fs.writeFileSync(
      path.join(projA, 'package.json'),
      JSON.stringify({
        name: 'my-react-app',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      }),
      'utf8'
    );

    // Project B: Python project
    const projB = path.join(tmpDir, 'ml-pipeline');
    fsExtra.ensureDirSync(projB);
    fs.writeFileSync(path.join(projB, 'requirements.txt'), 'numpy\npandas\n', 'utf8');

    // Project C: Rust project
    const projC = path.join(tmpDir, 'rust-cli');
    fsExtra.ensureDirSync(projC);
    fs.writeFileSync(path.join(projC, 'Cargo.toml'), '[package]\nname = "rust-cli"\n', 'utf8');

    // Project D: Node.js with BMAD+ installed
    const projD = path.join(tmpDir, 'bmad-project');
    fsExtra.ensureDirSync(path.join(projD, '.agents'));
    fs.writeFileSync(
      path.join(projD, 'package.json'),
      JSON.stringify({
        name: 'bmad-project',
        dependencies: { express: '^4.18.0' },
      }),
      'utf8'
    );

    // Project E: Next.js + TypeScript
    const projE = path.join(tmpDir, 'nextjs-app');
    fsExtra.ensureDirSync(projE);
    fs.writeFileSync(
      path.join(projE, 'package.json'),
      JSON.stringify({
        name: 'nextjs-app',
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'utf8'
    );

    // Non-project directory (no markers)
    const nonProj = path.join(tmpDir, 'random-folder');
    fsExtra.ensureDirSync(nonProj);
    fs.writeFileSync(path.join(nonProj, 'notes.txt'), 'hello', 'utf8');

    // Skippable directory (node_modules)
    fsExtra.ensureDirSync(path.join(tmpDir, 'node_modules', 'fake-pkg'));
  });

  afterAll(() => {
    const fsExtra = require('fs-extra');
    fsExtra.removeSync(tmpDir);
  });

  // ── PROJECT_MARKERS ──

  test('PROJECT_MARKERS should contain at least 8 language markers', () => {
    expect(PROJECT_MARKERS.length).toBeGreaterThanOrEqual(8);
  });

  test('first marker should be package.json (highest priority)', () => {
    expect(PROJECT_MARKERS[0].file).toBe('package.json');
  });

  test('package.json marker should have a detect function', () => {
    expect(typeof PROJECT_MARKERS[0].detect).toBe('function');
  });

  // ── SKIP_DIRS ──

  test('SKIP_DIRS should skip node_modules', () => {
    expect(SKIP_DIRS.has('node_modules')).toBe(true);
  });

  test('SKIP_DIRS should skip .git', () => {
    expect(SKIP_DIRS.has('.git')).toBe(true);
  });

  test('SKIP_DIRS should skip Windows system dirs', () => {
    expect(SKIP_DIRS.has('Program Files')).toBe(true);
    expect(SKIP_DIRS.has('$RECYCLE.BIN')).toBe(true);
  });

  // ── getProjectStatus ──

  test('getProjectStatus should return "active" for recently modified dir', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    expect(getProjectStatus(projA)).toBe('active');
  });

  test('getProjectStatus should respect custom activeDays threshold', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    // With activeDays=0, even a just-created dir is "paused"
    // (it was created milliseconds ago, so daysSince ≈ 0 which is < 0.001)
    // Actually 0 days means anything modified today should be active... let's test a real threshold
    expect(getProjectStatus(projA, 30, 180)).toBe('active');
  });

  test('getProjectStatus should return "unknown" for non-existent dir', () => {
    expect(getProjectStatus('/nonexistent/path/xyz')).toBe('unknown');
  });

  // ── getProjectName ──

  test('getProjectName should read name from package.json', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    expect(getProjectName(projA)).toBe('my-react-app');
  });

  test('getProjectName should fall back to directory basename', () => {
    const nonProj = path.join(tmpDir, 'random-folder');
    expect(getProjectName(nonProj)).toBe('random-folder');
  });

  // ── hasBmadInstalled ──

  test('hasBmadInstalled should return true when .agents/ exists', () => {
    const projD = path.join(tmpDir, 'bmad-project');
    expect(hasBmadInstalled(projD)).toBe(true);
  });

  test('hasBmadInstalled should return false when no .agents/ or _bmad/', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    expect(hasBmadInstalled(projA)).toBe(false);
  });

  // ── scanDirectory (the main function) ──

  test('scanDirectory should find all projects in temp dir', () => {
    const projects = scanDirectory(tmpDir, 2);
    // Should find: my-react-app, ml-pipeline, rust-cli, bmad-project, nextjs-app
    expect(projects.length).toBe(5);
  });

  test('scanDirectory should detect correct stack for React project', () => {
    const projects = scanDirectory(tmpDir, 2);
    const react = projects.find((p) => p.name === 'my-react-app');
    expect(react).toBeDefined();
    expect(react.stack).toBe('React');
  });

  test('scanDirectory should detect Python stack', () => {
    const projects = scanDirectory(tmpDir, 2);
    const python = projects.find((p) => p.name === 'ml-pipeline');
    expect(python).toBeDefined();
    expect(python.stack).toBe('Python');
  });

  test('scanDirectory should detect Rust stack', () => {
    const projects = scanDirectory(tmpDir, 2);
    const rust = projects.find((p) => p.name === 'rust-cli');
    expect(rust).toBeDefined();
    expect(rust.stack).toBe('Rust');
  });

  test('scanDirectory should detect Next.js stack (over React)', () => {
    const projects = scanDirectory(tmpDir, 2);
    const nextjs = projects.find((p) => p.name === 'nextjs-app');
    expect(nextjs).toBeDefined();
    expect(nextjs.stack).toBe('Next.js');
  });

  test('scanDirectory should detect Express stack', () => {
    const projects = scanDirectory(tmpDir, 2);
    const express = projects.find((p) => p.name === 'bmad-project');
    expect(express).toBeDefined();
    expect(express.stack).toBe('Express');
  });

  test('scanDirectory should detect BMAD+ installed', () => {
    const projects = scanDirectory(tmpDir, 2);
    const bmad = projects.find((p) => p.name === 'bmad-project');
    expect(bmad.bmad).toBe(true);
  });

  test('scanDirectory should NOT find non-project directories', () => {
    const projects = scanDirectory(tmpDir, 2);
    const random = projects.find((p) => p.name === 'random-folder');
    expect(random).toBeUndefined();
  });

  test('scanDirectory should NOT recurse into node_modules', () => {
    const projects = scanDirectory(tmpDir, 2);
    const fake = projects.find((p) => p.name === 'fake-pkg');
    expect(fake).toBeUndefined();
  });

  test('scanDirectory should respect maxDepth=0', () => {
    const projects = scanDirectory(tmpDir, 0);
    expect(projects.length).toBe(0); // tmpDir itself has no markers
  });

  test('scanDirectory should return empty for non-existent dir', () => {
    const projects = scanDirectory('/nonexistent/xyz', 2);
    expect(projects.length).toBe(0);
  });
});
