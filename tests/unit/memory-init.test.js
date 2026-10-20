/**
 * BMAD+ Memory Init — Unit Tests
 * Tests for the memory initialization module.
 *
 * Every initMemory/resolveBrain call injects a temp homeDir: these tests must
 * never read or write the real user home (a prior version of this suite left
 * hundreds of junk project entries in ~/.bmad-plus/brain/projects/).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock clack to avoid console output during tests
jest.mock('@clack/prompts', () => ({
  log: { info: jest.fn(), error: jest.fn(), success: jest.fn(), warn: jest.fn(), step: jest.fn() },
}));

const { initMemory, resolveBrain, ensureGlobalBrain } = require('../../tools/cli/lib/memory-init');
const { projectHash, normalizePathForHash } = require('../../tools/cli/lib/path-hash');

// Real templates shipped in the repo — exercises the actual creation path.
const REAL_BMAD_SRC = path.join(__dirname, '..', '..', 'src', 'bmad-plus');

describe('memory-init', () => {
  let tmpDir;
  let tmpHome;

  // resolveBrain honours BMAD_PLUS_BRAIN ahead of every other candidate, by design.
  // An ambient value in the developer's shell therefore outranks the fixtures below
  // and the suite silently stops testing what it claims. The variable is state, not
  // input: unset it for every test, and let the tests that need it set it themselves.
  const ambientBrain = process.env.BMAD_PLUS_BRAIN;

  const run = (overrides = {}) =>
    initMemory({
      projectDir: tmpDir,
      bmadSrc: path.join(tmpDir, 'nonexistent-src'),
      userName: 'Test',
      commLang: 'en',
      selectedPacks: ['core', 'memory'],
      homeDir: tmpHome,
      ...overrides,
    });

  beforeEach(() => {
    delete process.env.BMAD_PLUS_BRAIN;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-mi-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-mi-home-'));
  });

  afterEach(() => {
    delete process.env.BMAD_PLUS_BRAIN;
    for (const d of [tmpDir, tmpHome]) {
      if (d) fs.rmSync(d, { recursive: true, force: true });
    }
  });

  // Jest reuses a worker process across suites — hand the env back as found.
  afterAll(() => {
    if (ambientBrain === undefined) delete process.env.BMAD_PLUS_BRAIN;
    else process.env.BMAD_PLUS_BRAIN = ambientBrain;
  });

  describe('initMemory — project memory', () => {
    test('should create .agents/memory directory structure', () => {
      run();
      const memoryDir = path.join(tmpDir, '.agents', 'memory');
      expect(fs.existsSync(memoryDir)).toBe(true);
      expect(fs.existsSync(path.join(memoryDir, 'sessions'))).toBe(true);
    });

    test('should not throw when bmadSrc templates do not exist', () => {
      expect(() => run()).not.toThrow();
    });
  });

  describe('resolveBrain — detection', () => {
    test('should link to a _brain directory found in an ancestor (portfolio brain)', () => {
      const portfolioBrain = path.join(tmpDir, '_brain');
      const projectDir = path.join(tmpDir, 'clients', 'my-project');
      fs.mkdirSync(portfolioBrain, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });

      run({ projectDir });

      const linkPath = path.join(projectDir, '.agents', 'memory', '.brain-link');
      const link = JSON.parse(fs.readFileSync(linkPath, 'utf8'));
      expect(link.linked_brain).toBe(portfolioBrain);
      expect(link.brain_type).toBe('portfolio');
    });

    // Both candidates exist: only priority order can explain the result.
    test('BMAD_PLUS_BRAIN env var should override every other candidate', () => {
      const envBrain = path.join(tmpDir, 'custom-brain');
      const localBrain = path.join(tmpDir, '_brain');
      fs.mkdirSync(envBrain, { recursive: true });
      fs.mkdirSync(localBrain, { recursive: true });

      process.env.BMAD_PLUS_BRAIN = envBrain;

      const brain = resolveBrain(tmpDir, tmpHome);
      expect(brain.dir).toBe(envBrain);
      expect(brain.dir).not.toBe(localBrain);
      expect(brain.type).toBe('portfolio');
    });

    test('BMAD_PLUS_BRAIN pointing to a missing dir should fall back to walk-up detection', () => {
      const localBrain = path.join(tmpDir, '_brain');
      fs.mkdirSync(localBrain, { recursive: true });
      const missing = path.join(tmpDir, 'does-not-exist');

      process.env.BMAD_PLUS_BRAIN = missing;

      const brain = resolveBrain(tmpDir, tmpHome);
      expect(brain.dir).toBe(localBrain);
      expect(brain.dir).not.toBe(missing);
      expect(brain.type).toBe('portfolio');
    });

    test('should prefer the nearest _brain over global fallbacks', () => {
      const projectDir = path.join(tmpDir, 'a', 'b', 'project');
      const nearestBrain = path.join(tmpDir, 'a', '_brain');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(nearestBrain, { recursive: true });
      fs.mkdirSync(path.join(tmpHome, '.bmad-plus', 'brain'), { recursive: true });

      const brain = resolveBrain(projectDir, tmpHome);
      expect(brain.dir).toBe(nearestBrain);
      expect(brain.type).toBe('portfolio');
    });

    test('a FILE named _brain must not be detected as a brain', () => {
      fs.writeFileSync(path.join(tmpDir, '_brain'), 'not a directory', 'utf8');
      const brain = resolveBrain(tmpDir, tmpHome);
      expect(brain).toBeNull();
    });

    test('an EMPTY ~/.claude/memory must not be detected as a brain', () => {
      fs.mkdirSync(path.join(tmpHome, '.claude', 'memory'), { recursive: true });
      const brain = resolveBrain(tmpDir, tmpHome);
      expect(brain).toBeNull();
    });

    test('a non-empty ~/.claude/memory is detected as claude-memory', () => {
      const claudeMem = path.join(tmpHome, '.claude', 'memory');
      fs.mkdirSync(claudeMem, { recursive: true });
      fs.writeFileSync(path.join(claudeMem, 'MEMORY.md'), '# Memory', 'utf8');
      const brain = resolveBrain(tmpDir, tmpHome);
      expect(brain).toEqual({ dir: claudeMem, type: 'claude-memory' });
    });
  });

  describe('initMemory — global brain lifecycle', () => {
    test('fresh machine: creates a COMPLETE global brain and writes .brain-link', () => {
      run({ bmadSrc: REAL_BMAD_SRC, userName: 'Fresh User', commLang: 'fr' });

      const brainRoot = path.join(tmpHome, '.bmad-plus', 'brain');
      // Complete brain: identity + global memory files + projects/
      expect(fs.existsSync(path.join(brainRoot, 'identity.yaml'))).toBe(true);
      for (const gf of ['decisions.md', 'lessons.md', 'patterns.md']) {
        expect(fs.existsSync(path.join(brainRoot, gf))).toBe(true);
      }
      const identity = fs.readFileSync(path.join(brainRoot, 'identity.yaml'), 'utf8');
      expect(identity).toContain('Fresh User');

      // .brain-link is written on CREATION too, not only on detection
      const link = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.agents', 'memory', '.brain-link'), 'utf8')
      );
      expect(link.brain_type).toBe('bmad-global');
      expect(link.linked_brain).toBe(brainRoot);

      // Project indexed with the normalized hash
      const indexFile = path.join(brainRoot, 'projects', `${projectHash(tmpDir)}.yaml`);
      expect(fs.existsSync(indexFile)).toBe(true);
    });

    test('poisoned half-brain (projects/ only, no identity) is self-healed on next install', () => {
      // Simulate the legacy bug: projects/ exists but identity.yaml was never written
      fs.mkdirSync(path.join(tmpHome, '.bmad-plus', 'brain', 'projects'), { recursive: true });

      run({ bmadSrc: REAL_BMAD_SRC });

      const brainRoot = path.join(tmpHome, '.bmad-plus', 'brain');
      expect(fs.existsSync(path.join(brainRoot, 'identity.yaml'))).toBe(true);
      for (const gf of ['decisions.md', 'lessons.md', 'patterns.md']) {
        expect(fs.existsSync(path.join(brainRoot, gf))).toBe(true);
      }
    });

    test('portfolio-linked install does NOT write into the global brain', () => {
      fs.mkdirSync(path.join(tmpDir, '_brain'), { recursive: true });

      run({ bmadSrc: REAL_BMAD_SRC });

      expect(fs.existsSync(path.join(tmpHome, '.bmad-plus'))).toBe(false);
    });

    test('re-running install is idempotent: same link, single index entry', () => {
      run({ bmadSrc: REAL_BMAD_SRC });
      const linkPath = path.join(tmpDir, '.agents', 'memory', '.brain-link');
      const first = JSON.parse(fs.readFileSync(linkPath, 'utf8'));

      run({ bmadSrc: REAL_BMAD_SRC });
      const second = JSON.parse(fs.readFileSync(linkPath, 'utf8'));

      expect(second.linked_brain).toBe(first.linked_brain);
      expect(second.brain_type).toBe(first.brain_type);
      const entries = fs.readdirSync(path.join(tmpHome, '.bmad-plus', 'brain', 'projects'));
      expect(entries).toHaveLength(1);
    });
  });

  describe('ensureGlobalBrain', () => {
    test('is idempotent and never overwrites existing files', () => {
      const brainRoot = path.join(tmpHome, '.bmad-plus', 'brain');
      const templateDir = path.join(REAL_BMAD_SRC, 'packs', 'pack-memory', 'templates');

      ensureGlobalBrain(brainRoot, templateDir, 'User One', 'en');
      const identityPath = path.join(brainRoot, 'identity.yaml');
      const before = fs.readFileSync(identityPath, 'utf8');

      ensureGlobalBrain(brainRoot, templateDir, 'User Two', 'de');
      const after = fs.readFileSync(identityPath, 'utf8');

      expect(after).toBe(before);
      expect(after).toContain('User One');
    });
  });

  describe('path-hash', () => {
    test('drive-letter casing produces the same hash (no double-indexing)', () => {
      if (process.platform !== 'win32') return; // drive letters are a Windows concept
      const upper = 'D:\\travail\\DEV\\some-project';
      const lower = 'd:\\travail\\DEV\\some-project';
      expect(normalizePathForHash(upper)).toBe(normalizePathForHash(lower));
      expect(projectHash(upper)).toBe(projectHash(lower));
    });
  });
});
