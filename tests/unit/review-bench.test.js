/** Review bench: a valid planted corpus, the published matching rule, reference runs, reproducible builds. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const bench = require('../../tools/qa/review-bench');
const review = require('../../tools/cli/lib/review');

const script = path.resolve(__dirname, '../../tools/qa/review-bench.js');
const temps = [];
const tempDir = (prefix) => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), prefix));
  temps.push(dir);
  return dir;
};
afterAll(() => temps.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const writeFile = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const filler = Array.from({ length: 20 }, (_, i) => `const k${i} = ${i};`).join('\n');
const DEMO_HEAD = [
  'function f(xs) {',
  '  for (let i = 0; i <= xs.length; i++) use(xs[i]);',
  '  return null;',
  '}',
  'function g(v) {',
  '  if (v == null) return 0;',
  '  return null;',
  '}',
  filler,
  '',
].join('\n');

/** A two-case corpus on disk; `change` edits the demo manifest before it is written. */
function syntheticCorpus(change = (manifest) => manifest) {
  const root = tempDir('bench-corpus-');
  const demo = change({
    schema: bench.CASE_SCHEMA,
    id: 'demo',
    language: 'javascript',
    summary: 'A loop and a null check.',
    message: 'Add f and g',
    defects: [
      {
        id: 'demo/bound',
        path: 'a.js',
        quote: 'for (let i = 0; i <= xs.length; i++) use(xs[i]);',
        categories: ['correctness'],
        severity: 'high',
        why: 'Reads one element past the end.',
      },
    ],
    decoys: [
      { id: 'demo/null', path: 'a.js', quote: 'if (v == null) return 0;', why: 'Deliberate.' },
    ],
  });
  writeFile(path.join(root, 'cases/demo/case.json'), JSON.stringify(demo));
  writeFile(path.join(root, 'cases/demo/before/a.js'), 'module.exports = {};\n');
  writeFile(path.join(root, 'cases/demo/before/b.js'), 'const unchanged = 1;\n');
  writeFile(path.join(root, 'cases/demo/after/a.js'), DEMO_HEAD);
  writeFile(
    path.join(root, 'cases/other/case.json'),
    JSON.stringify({
      schema: bench.CASE_SCHEMA,
      id: 'other',
      language: 'python',
      summary: 'Clean.',
      message: 'Add h',
      defects: [],
      decoys: [
        { id: 'other/pass', path: 'h.py', quote: 'pass', why: 'An empty body is intended.' },
      ],
    })
  );
  writeFile(path.join(root, 'cases/other/before/h.py'), 'x = 1\n');
  writeFile(path.join(root, 'cases/other/after/h.py'), 'def h():\n    pass\n');
  return root;
}

const finding = (id, existing_code, extra = {}) => ({
  id,
  path: 'a.js',
  existing_code,
  content: 'c',
  category: 'correctness',
  severity: 'high',
  confidence: 'high',
  disposition: 'confirmed',
  evidence: 'e',
  ...extra,
});
const runOf = (corpus, cases, extra = {}) => ({
  schema: bench.RUN_SCHEMA,
  id: 'test',
  reviewer: 'test',
  corpusSha256: corpus.sha256,
  cases,
  ...extra,
});

describe('review bench corpus', () => {
  const corpus = bench.loadCorpus();

  it('is valid, spans several languages, and plants decoys and a clean case', () => {
    expect(bench.validateCorpus(corpus)).toEqual([]);
    const manifests = corpus.cases.map((c) => c.manifest);
    expect(new Set(manifests.map((m) => m.language)).size).toBeGreaterThanOrEqual(6);
    expect(manifests.some((m) => !m.defects.length && m.decoys.length)).toBe(true);
    expect(manifests.flatMap((m) => m.decoys).length).toBeGreaterThanOrEqual(manifests.length);
    const categories = new Set(manifests.flatMap((m) => m.defects.flatMap((d) => d.categories)));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it('scores the three reference runs exactly as worked out by hand', () => {
    const results = bench.checkReferences(corpus);
    expect(results.map((r) => r.run).sort()).toEqual(['empty.json', 'noisy.json', 'perfect.json']);
    for (const result of results) expect(result.differences).toEqual([]);
    const score = (name) =>
      bench.scoreRun(
        JSON.parse(fs.readFileSync(path.join(corpus.root, 'runs', name), 'utf8')),
        corpus
      ).totals;
    expect(score('perfect.json')).toMatchObject({ recall: 1, precision: 1, falsePositives: 0 });
    expect(score('empty.json')).toMatchObject({ recall: 0, precision: null, f1: 0 });
    expect(score('noisy.json')).toMatchObject({
      recall: 0.5,
      precision: 0.375,
      tooBroad: 1,
      decoyHits: 3,
      unlocated: 3,
      dismissed: 1,
      costPerMatchedDefect: 0.019533,
    });
  });

  it('matches no defect with a whole-file quote of a short file', () => {
    const benchCase = corpus.cases.find((c) => c.dir === 'sh-release-upload');
    const file = 'scripts/release.sh';
    const whole = benchCase.head.get(file).trimEnd();
    expect(whole.split('\n').length).toBeLessThan(20);
    const vague = (id, category) => finding(id, whole, { path: file, category });
    const run = runOf(corpus, {
      'sh-release-upload': { findings: [vague('w1', 'data-loss'), vague('w2', 'security')] },
    });
    const [scored] = bench.scoreRun(run, corpus).cases.filter((c) => c.id === 'sh-release-upload');
    expect(scored.findings.map((f) => f.verdict)).toEqual(['too-broad', 'too-broad']);
    expect(scored.matchedDefects).toEqual([]);
  });

  it('refuses a run recorded against another version of the corpus', () => {
    const run = JSON.parse(fs.readFileSync(path.join(corpus.root, 'runs/perfect.json'), 'utf8'));
    run.corpusSha256 = '0'.repeat(64);
    expect(() => bench.scoreRun(run, corpus)).toThrow(/answers another version/);
  });
});

describe('matching rule', () => {
  const corpus = bench.loadCorpus(syntheticCorpus());

  it('matches by path, category and quote overlap; every other outcome is named', () => {
    const findings = [
      finding('reindented', '    for (let i = 0;   i <= xs.length; i++)   use(xs[i]);'),
      finding('again', 'function f(xs) {\n  for (let i = 0; i <= xs.length; i++) use(xs[i]);'),
      finding('mislabelled', 'for (let i = 0; i <= xs.length; i++) use(xs[i]);', {
        category: 'security',
      }),
      finding('decoy', 'if (v == null) return 0;'),
      finding('ambiguous', 'return null;'),
      finding('invented', 'for (const x of xs) use(x);'),
      finding('elsewhere', 'module.exports = {};', { path: 'missing.js' }),
      finding('whole-file', DEMO_HEAD),
      finding('unrelated', 'function g(v) {'),
    ];
    const score = bench.scoreRun(runOf(corpus, { demo: { findings } }), corpus);
    const verdicts = Object.fromEntries(score.cases[0].findings.map((f) => [f.id, f.verdict]));
    expect(verdicts).toEqual({
      reindented: 'match',
      again: 'duplicate',
      mislabelled: 'category-mismatch',
      decoy: 'decoy',
      ambiguous: 'unlocated',
      invented: 'unlocated',
      elsewhere: 'unlocated',
      'whole-file': 'too-broad',
      unrelated: 'false-positive',
    });
    expect(score.cases[0].findings[4].location).toBe('ambiguous');
    expect(score.totals).toMatchObject({
      matched: 1,
      findings: 9,
      duplicates: 1,
      falsePositives: 4,
      unlocated: 3,
      precision: 0.111,
      recall: 1,
      missingCases: ['other'],
    });
  });

  it('counts a quote as pointing at a plant only within a few lines of context around it', () => {
    const lines = DEMO_HEAD.split('\n');
    const quote = (from, to) => lines.slice(from - 1, to).join('\n');
    const findings = [
      finding('wider', quote(1, 2 + bench.MAX_CONTEXT_LINES)),
      finding('both', quote(2, 6)),
      finding('withdrawn', quote(1, 5), { disposition: 'refuted', refutation: 'r' }),
      finding('context', quote(1, 1 + bench.MAX_CONTEXT_LINES)),
    ];
    const [demo] = bench.scoreRun(runOf(corpus, { demo: { findings } }), corpus).cases;
    expect(demo.findings.map((f) => [f.id, f.verdict, f.target])).toEqual([
      ['wider', 'too-broad', undefined],
      ['both', 'too-broad', undefined],
      ['withdrawn', 'refuted', undefined],
      ['context', 'match', 'demo/bound'],
    ]);
    expect(demo.counts).toMatchObject({ tooBroad: 2, falsePositives: 2, dismissed: 0 });
  });

  it('gives the defect to the first fitting finding, whatever came before it', () => {
    const findings = [
      finding('mislabelled', 'for (let i = 0; i <= xs.length; i++) use(xs[i]);', {
        category: 'performance',
      }),
      finding('right', 'for (let i = 0; i <= xs.length; i++) use(xs[i]);'),
    ];
    const [demo] = bench.scoreRun(runOf(corpus, { demo: { findings } }), corpus).cases;
    expect(demo.findings.map((f) => f.verdict)).toEqual(['category-mismatch', 'match']);
    expect(demo.matchedDefects).toEqual(['demo/bound']);
  });

  it('does not score a refuted finding, and reports a defect argued away', () => {
    const findings = [
      finding('withdrawn', 'for (let i = 0; i <= xs.length; i++) use(xs[i]);', {
        disposition: 'refuted',
        refutation: 'wrongly thought xs has a sentinel',
      }),
      finding('decoy-withdrawn', 'if (v == null) return 0;', {
        disposition: 'refuted',
        refutation: 'deliberate',
      }),
    ];
    const score = bench.scoreRun(runOf(corpus, { demo: { findings } }), corpus);
    expect(score.cases[0]).toMatchObject({
      dismissedDefects: ['demo/bound'],
      refutedDecoys: ['demo/null'],
    });
    expect(score.totals).toMatchObject({
      findings: 0,
      refuted: 2,
      dismissed: 1,
      decoysRefuted: 1,
      precision: null,
      recall: 0,
    });
  });

  it('never reads a line number: a finding that carries one is refused', () => {
    const run = runOf(corpus, {
      demo: { findings: [finding('lined', 'return null;', { line: 3 })] },
    });
    expect(bench.validateRun(run, corpus)).toEqual(['demo: finding lined: unknown key "line"']);
    expect(() => bench.scoreRun(run, corpus)).toThrow(/invalid run/);
  });

  it('refuses an invalid run whole instead of scoring what it can', () => {
    const errors = bench.validateRun(
      runOf(
        corpus,
        {
          demo: {
            findings: [finding('bug', 'return null;', { category: 'bug' })],
            usage: { costUsd: -1, tokens: 3 },
          },
          other: {},
          ghost: { findings: [] },
        },
        { reviewer: '', extra: true }
      ),
      corpus
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'unknown key "extra"',
        'reviewer is required — who or what produced the findings',
        expect.stringMatching(/^demo: finding bug: category "bug" is not one of/),
        'demo: usage.costUsd must be a non-negative number',
        'demo: unknown usage key "tokens"',
        'other: findings must be a list — an empty list when nothing was found',
        'ghost: no such case in the corpus',
      ])
    );
    expect(bench.validateRun({ schema: 'x' }, corpus)).toEqual([
      `schema must be "${bench.RUN_SCHEMA}"`,
    ]);
  });

  it('reports usage and cost only when every answered case reports them', () => {
    const match = finding('m', 'for (let i = 0; i <= xs.length; i++) use(xs[i]);');
    const partial = bench.scoreRun(
      runOf(corpus, {
        demo: { findings: [match], usage: { costUsd: 0.25, inputTokens: 100 } },
        other: { findings: [], usage: { inputTokens: 50 } },
      }),
      corpus
    ).totals;
    expect(partial.usage).toEqual({
      casesReporting: 2,
      inputTokens: 150,
      outputTokens: null,
      costUsd: null,
      seconds: null,
    });
    expect(partial.costPerMatchedDefect).toBeNull();
    const full = bench.scoreRun(
      runOf(corpus, {
        demo: { findings: [match], usage: { costUsd: 0.25 } },
        other: { findings: [], usage: { costUsd: 0.1 } },
      }),
      corpus
    ).totals;
    expect(full.usage.costUsd).toBe(0.35);
    expect(full.costPerMatchedDefect).toBe(0.35);
    const unanswered = bench.scoreRun(runOf(corpus, {}), corpus).totals;
    expect(unanswered).toMatchObject({
      answeredCases: 0,
      missingCases: ['demo', 'other'],
      missed: 1,
      usage: { casesReporting: 0, costUsd: null },
    });
  });
});

describe('corpus validation', () => {
  const errorsFor = (change) => bench.validateCorpus(bench.loadCorpus(syntheticCorpus(change)));

  it('accepts the synthetic corpus as written', () => {
    expect(errorsFor((m) => m)).toEqual([]);
  });

  it.each([
    ['a quote that is not in the file', (m) => (m.defects[0].quote = 'nope();'), /is unlocated/],
    ['a quote found twice', (m) => (m.decoys[0].quote = 'return null;'), /is ambiguous/],
    [
      'a target in an unchanged file',
      (m) => Object.assign(m.decoys[0], { path: 'b.js', quote: 'const unchanged = 1;' }),
      /b\.js is not a changed file/,
    ],
    [
      'two targets on one line',
      (m) => (m.decoys[0].quote = 'for (let i = 0; i <= xs.length; i++) use(xs[i]);'),
      /share a line/,
    ],
    ['an unknown category', (m) => (m.defects[0].categories = ['bug']), /categories must be/],
    ['an unknown severity', (m) => (m.defects[0].severity = 'major'), /severity must be/],
    ['an id outside the case', (m) => (m.decoys[0].id = 'null'), /id must start with "demo\/"/],
    ['a duplicated id', (m) => (m.decoys[0].id = 'demo/bound'), /duplicated id/],
    ['an undocumented plant', (m) => (m.defects[0].why = ' '), /why is required/],
    ['an unknown key', (m) => (m.defects[0].line = 2), /unknown key "line"/],
    ['an id unlike its directory', (m) => (m.id = 'renamed'), /id must equal the directory/],
    ['no plant at all', (m) => Object.assign(m, { defects: [], decoys: [] }), /at least one/],
  ])('refuses %s', (_, change, message) => {
    const errors = errorsFor((manifest) => {
      change(manifest);
      return manifest;
    });
    expect(errors.join('\n')).toMatch(message);
  });
});

describe('building the case repositories', () => {
  const corpus = bench.loadCorpus();
  const gitIn = (cwd, ...args) =>
    spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).stdout.trim();

  it('builds the same commits on every run, whatever the caller git environment says', () => {
    const first = tempDir('bench-build-a-');
    const second = tempDir('bench-build-b-');
    const builtA = corpus.cases.map((c) => bench.buildCase(c, path.join(first, c.dir)));
    const saved = process.env.GIT_AUTHOR_NAME;
    process.env.GIT_AUTHOR_NAME = 'Someone Else';
    let builtB;
    try {
      builtB = corpus.cases.map((c) => bench.buildCase(c, path.join(second, c.dir)));
    } finally {
      if (saved === undefined) delete process.env.GIT_AUTHOR_NAME;
      else process.env.GIT_AUTHOR_NAME = saved;
    }
    const commits = (built) => built.map(({ id, base, head }) => ({ id, base, head }));
    expect(commits(builtB)).toEqual(commits(builtA));

    const [js] = builtA.filter((b) => b.id === 'js-cart-discount');
    expect(gitIn(js.path, 'log', '-1', '--format=%an <%ae> %aI %cI')).toBe(
      `${bench.IDENTITY.name} <${bench.IDENTITY.email}> 2026-01-02T00:00:00+00:00 2026-01-02T00:00:00+00:00`
    );
    for (const built of builtA) {
      const benchCase = corpus.cases.find((c) => c.dir === built.id);
      const tracked = gitIn(built.path, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n');
      expect(tracked).toEqual([...benchCase.head.keys()].sort());
      expect(tracked).not.toContain('case.json');
    }
  });

  it('puts every planted defect and decoy inside the review scope of its case', () => {
    const out = tempDir('bench-scope-');
    for (const benchCase of corpus.cases) {
      const built = bench.buildCase(benchCase, path.join(out, benchCase.dir));
      const scope = review.buildScope(built.path, { id: 'bench' });
      const selected = scope.selected.map((s) => s.path);
      for (const target of [...benchCase.manifest.defects, ...benchCase.manifest.decoys])
        expect(selected).toContain(target.path);
    }
  });

  it('never builds over existing files', () => {
    const target = tempDir('bench-busy-');
    fs.writeFileSync(path.join(target, 'keep.txt'), 'mine');
    expect(() => bench.buildCase(corpus.cases[0], target)).toThrow(/is not empty/);
    expect(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8')).toBe('mine');
  });
});

describe('review-bench command line', () => {
  const cli = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    });

  it('checks the corpus and the reference runs', () => {
    const result = cli('check');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/ok {3}noisy\.json/);
  });

  it('is a blocking step of CI, not only a part of the test suite', () => {
    const ci = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/^\s+run: node tools\/qa\/review-bench\.js check$/m);
  });

  it('fails the check when a reference run no longer scores as recorded', () => {
    const root = syntheticCorpus();
    const corpus = bench.loadCorpus(root);
    writeFile(path.join(root, 'runs/empty.json'), JSON.stringify(runOf(corpus, {})));
    writeFile(
      path.join(root, 'runs/expected.json'),
      JSON.stringify({
        schema: 'bmad-plus/review-bench-expected/1',
        runs: { 'empty.json': { recall: 1 } },
      })
    );
    const result = cli('check', '--corpus', root);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/FAIL empty\.json\s+recall: expected 1, got 0/);
  });

  it('scores a run as JSON and refuses an invalid one', () => {
    const noisy = path.join(bench.DEFAULT_CORPUS, 'runs/noisy.json');
    const result = cli('score', noisy, '--json');
    expect(result.status).toBe(0);
    const score = JSON.parse(result.stdout);
    expect(score).toMatchObject({ schema: bench.SCORE_SCHEMA, rule: bench.MATCH_RULE });
    expect(score.totals.recall).toBe(0.5);
    expect(cli('score', noisy).stdout).toMatch(/recall 0\.5 · precision 0\.375/);

    const bad = path.join(tempDir('bench-bad-'), 'run.json');
    fs.writeFileSync(bad, JSON.stringify({ schema: bench.RUN_SCHEMA }));
    const refused = cli('score', bad);
    expect(refused.status).toBe(3);
    expect(refused.stderr).toMatch(/invalid run/);
  });

  it('builds one case on request', () => {
    const out = tempDir('bench-cli-');
    const result = cli('build', '--out', out, '--case', 'go-worker-pool');
    expect(result.status).toBe(0);
    const { cases } = JSON.parse(result.stdout);
    expect(cases).toEqual([
      expect.objectContaining({
        id: 'go-worker-pool',
        head: expect.stringMatching(/^[0-9a-f]{40}$/),
      }),
    ]);
    expect(cli('build', '--out', out, '--case', 'nope').status).toBe(3);
    expect(cli('frobnicate').status).toBe(3);
  });
});
