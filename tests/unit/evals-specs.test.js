/**
 * Eval-spec integrity tests (Pillar 4).
 *
 * Cross-checks every evals/<agent>/<task>/eval.yaml against the real repo:
 * pack ids must exist in tools/cli/lib/packs.js, agent_source files must exist,
 * fixtures must resolve, assertion kinds must be known. This is the JS-side
 * mirror of `python evals/_runner/run.py --self-check`, so a broken spec fails
 * `npm test` even on machines without Python.
 *
 * Author: Laurent Rochetta
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { PACKS, PACK_ORDER } = require('../../tools/cli/lib/packs');

const REPO_ROOT = path.join(__dirname, '..', '..');
const EVALS_ROOT = path.join(REPO_ROOT, 'evals');
const registry = yaml.load(fs.readFileSync(path.join(REPO_ROOT, 'registry.yaml'), 'utf8'));

const ALLOWED_KINDS = {
  file_exists: ['path'],
  contains: ['path', 'pattern'],
  command_succeeds: ['command'],
  must_flag: ['pattern'],
  must_not_flag: ['pattern'],
};
const SUPPORTED_MODELS = registry.targets.models_supported;

/** Match the registry glob while keeping private/generated directories out. */
function discoverSpecs() {
  const specs = [];
  const globParts = registry.eval.suite_glob.split('/');
  const escape = (value) => value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    '^' +
      globParts
        .map((part, index) => {
          if (part === '**') return '(?:[^/]+/)*';
          return (
            part.split('*').map(escape).join('[^/]*') + (index < globParts.length - 1 ? '/' : '')
          );
        })
        .join('') +
      '$'
  );
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.') || entry.isSymbolicLink())
        continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (regex.test(path.relative(REPO_ROOT, file).split(path.sep).join('/'))) {
        const dir = path.dirname(file);
        specs.push({ id: path.relative(EVALS_ROOT, dir).split(path.sep).join('/'), file, dir });
      }
    }
  }
  visit(EVALS_ROOT);
  return specs.sort((a, b) => a.id.localeCompare(b.id));
}

function isSafeRelPath(p) {
  return (
    typeof p === 'string' &&
    p.length > 0 &&
    !path.isAbsolute(p) &&
    !/^[A-Za-z]:/.test(p) &&
    !p.split(/[\\/]/).includes('..')
  );
}

const specs = discoverSpecs();

describe('evals golden specs', () => {
  test('at least the 3 seed specs exist (forge, shield, sentinel)', () => {
    const ids = specs.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(['forge/scaffold-api', 'shield/gdpr-ropa', 'sentinel/find-bug'])
    );
    expect(specs.length).toBeGreaterThanOrEqual(3);
  });

  test('the registry PR gate has an explicit sealed replay task for every pack', () => {
    expect(registry.eval.gates.pr).toMatchObject({
      mode: 'replay',
      blocking: true,
      require_all_packs: true,
    });
    const covered = new Set();
    for (const { file, dir } of specs) {
      const spec = yaml.load(fs.readFileSync(file, 'utf8'));
      if (!spec.gates?.includes('pr')) continue;
      expect(isSafeRelPath(spec.replay)).toBe(true);
      const replay = JSON.parse(fs.readFileSync(path.join(dir, spec.replay), 'utf8'));
      expect(replay.kind).toBe('maintainer-authored-replay');
      expect(replay.bindings.agent_resources.files.length).toBeGreaterThan(0);
      expect(replay.files.length).toBeGreaterThan(0);
      expect(spec.scoring.weights.rubric).toBe(0);
      covered.add(spec.pack);
    }
    expect([...covered].sort()).toEqual([...PACK_ORDER].sort());
  });

  describe.each(specs)('$id', ({ id, file, dir }) => {
    const spec = yaml.load(fs.readFileSync(file, 'utf8'));

    test('parses and declares schema_version 1 with an id matching its path', () => {
      expect(spec).toBeInstanceOf(Object);
      expect(spec.schema_version).toBe(1);
      expect(spec.id).toBe(id);
    });

    test('pack exists in tools/cli/lib/packs.js', () => {
      expect(PACK_ORDER).toContain(spec.pack);
      expect(PACKS[spec.pack]).toBeDefined();
    });

    test('agent_source points to a real agent definition in the repo', () => {
      expect(isSafeRelPath(spec.agent_source)).toBe(true);
      const resolved = path.join(REPO_ROOT, spec.agent_source);
      expect(fs.existsSync(resolved)).toBe(true);
      // the file must actually mention the agent key it claims to define
      const content = fs.readFileSync(resolved, 'utf8');
      const shortName = spec.agent.replace(/^agent-/, '');
      expect(content.toLowerCase()).toContain(shortName.split('-')[0]);
    });

    test('fixture directory exists and is non-empty', () => {
      expect(isSafeRelPath(spec.fixture)).toBe(true);
      const fixtureDir = path.join(dir, spec.fixture);
      expect(fs.existsSync(fixtureDir)).toBe(true);
      expect(fs.statSync(fixtureDir).isDirectory()).toBe(true);
      expect(fs.readdirSync(fixtureDir).length).toBeGreaterThan(0);
    });

    test('models is a non-empty subset of the supported model set', () => {
      expect(Array.isArray(spec.models)).toBe(true);
      expect(spec.models.length).toBeGreaterThan(0);
      for (const m of spec.models) expect(SUPPORTED_MODELS).toContain(m);
    });

    test('task has a non-empty prompt', () => {
      expect(typeof spec.task.prompt).toBe('string');
      expect(spec.task.prompt.trim().length).toBeGreaterThan(0);
    });

    test('every assertion has a known kind, its required fields, and valid regexes', () => {
      expect(Array.isArray(spec.assertions)).toBe(true);
      expect(spec.assertions.length).toBeGreaterThan(0);
      for (const a of spec.assertions) {
        expect(Object.keys(ALLOWED_KINDS)).toContain(a.kind);
        for (const req of ALLOWED_KINDS[a.kind]) {
          expect(a[req]).toBeDefined();
        }
        if (a.path !== undefined) expect(isSafeRelPath(a.path)).toBe(true);
        if (a.pattern !== undefined) {
          // schema.md: only a LEADING (?i)/(?is)... inline-flag group is allowed
          // (Python-style); JS RegExp does not support it, so strip before compiling.
          const jsPattern = a.pattern.replace(/^\(\?[a-z]+\)/, '');
          expect(() => new RegExp(jsPattern)).not.toThrow();
        }
        if (a.weight !== undefined) expect(a.weight).toBeGreaterThan(0);
      }
    });

    test('scoring is well-formed (threshold in (0,1], weights sum to 1)', () => {
      const { pass_threshold: thr, weights } = spec.scoring;
      expect(thr).toBeGreaterThan(0);
      expect(thr).toBeLessThanOrEqual(1);
      expect(Object.keys(weights).sort()).toEqual(['assertions', 'rubric']);
      expect(weights.assertions + weights.rubric).toBeCloseTo(1.0, 6);
      if (weights.rubric > 0) {
        expect(Array.isArray(spec.rubric)).toBe(true);
        expect(spec.rubric.length).toBeGreaterThan(0);
        for (const r of spec.rubric) {
          expect(typeof r.id).toBe('string');
          expect(typeof r.criterion).toBe('string');
        }
      }
    });
  });

  test('runner and docs ship alongside the specs', () => {
    expect(fs.existsSync(path.join(EVALS_ROOT, '_runner', 'run.py'))).toBe(true);
    expect(fs.existsSync(path.join(EVALS_ROOT, 'schema.md'))).toBe(true);
    expect(fs.existsSync(path.join(EVALS_ROOT, 'README.md'))).toBe(true);
  });

  test('the files a seal binds carry the same bytes on every platform', () => {
    // Seals hash agent sources, specs, fixtures and checkers byte for byte. When a
    // Windows checkout wrote CRLF where the runner reads LF, every replay sealed on
    // one platform was reported stale on the other and the 0.16.0 publication was
    // refused. .gitattributes pins these trees to LF; this test is the alarm.
    const crlf = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            !['__pycache__', 'node_modules', '_runs', '.pytest_cache', '.venv'].includes(entry.name)
          )
            walk(full);
          continue;
        }
        if (
          ['.pyc', '.pyo', '.png', '.jpg', '.gif', '.ico', '.woff', '.woff2'].includes(
            path.extname(entry.name)
          )
        )
          continue;
        if (fs.readFileSync(full).includes('\r\n')) crlf.push(path.relative(REPO_ROOT, full));
      }
    };
    for (const root of ['evals', path.join('src', 'bmad-plus'), 'oveanet-pack']) {
      const full = path.join(REPO_ROOT, root);
      if (fs.existsSync(full)) walk(full);
    }
    expect(crlf).toEqual([]);
  });
});
