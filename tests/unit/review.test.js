/** Review evidence on a real git repository: scope, anchoring and a coverage-derived verdict. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const review = require('../../tools/cli/lib/review');

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
let repo;

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
};
const run = (...args) => {
  const r = spawnSync(process.execPath, [cli, 'review', ...args, '--directory', repo, '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  });
  return { code: r.status, value: r.stdout.trim() ? JSON.parse(r.stdout) : null, stderr: r.stderr };
};
const paths = (id) => review.layout(repo, review.DEFAULT_DIR, id);
const saveJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'review-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  write(
    'src/cart.js',
    'function total(items) {\n  let sum = 0;\n  return sum;\n}\nmodule.exports = { total };\n'
  );
  write('src/old.js', 'module.exports = 1;\n');
  write('README.md', '# demo\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  // The change under review.
  write(
    'src/cart.js',
    'function total(items) {\n  let sum = 0;\n  for (let i = 0; i <= items.length; i++) sum += items[i].price;\n  return sum;\n}\nmodule.exports = { total };\n'
  );
  write('src/util.js', 'const same = 1;\nconst same = 1;\nmodule.exports = { same };\n');
  write('.env', 'API_KEY=do-not-send\n');
  write('config/secrets/token.txt', 'x\n');
  write('package-lock.json', '{}\n');
  write('assets/logo.bin', Buffer.from([0, 1, 2, 3, 0]));
  fs.unlinkSync(path.join(repo, 'src/old.js'));
  git('add', '-A');
  git('commit', '-q', '-m', 'change');
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('review scope', () => {
  it('selects the reviewable changes and names why every other file is left out', () => {
    const scope = review.buildScope(repo, { id: 'r1' });
    expect(scope.schema).toBe(review.SCOPE_SCHEMA);
    expect(scope.selected.map((s) => s.path)).toEqual(['src/cart.js', 'src/util.js']);
    const reasons = Object.fromEntries(scope.excluded.map((e) => [e.path, e.reason]));
    expect(reasons).toEqual({
      '.env': 'secret',
      'assets/logo.bin': 'binary',
      'config/secrets/token.txt': 'secret',
      'package-lock.json': 'generated-or-vendored',
      'src/old.js': 'deleted',
    });
    expect(scope.totals).toMatchObject({ changed: 7, selected: 2, excluded: 5 });
    expect(scope.identity.head).toMatch(/^[0-9a-f]{40}$/);
    expect(scope.units).toEqual([
      {
        id: 'u1',
        paths: ['src/cart.js', 'src/util.js'],
        lines: expect.any(Number),
        rules: ['general', 'javascript-typescript'],
        groups: [{ id: 'code', rules: ['general', 'javascript-typescript'] }],
      },
    ]);
    expect(scope.selected[0].rules).toEqual(['general', 'javascript-typescript']);
    expect(scope.identity).toMatchObject({
      effort: 'medium',
      rulesSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(scope.plan).toEqual({
      effort: 'medium',
      passes: 2,
      refute: true,
      planFirst: false,
      parallelUnits: false,
    });
  });

  it('binds the scope to its effort and its rule set', () => {
    const medium = review.buildScope(repo, { id: 'r1' });
    const high = review.buildScope(repo, { id: 'r1', effort: 'high' });
    expect(high.plan.passes).toBe(3);
    expect(high.sha256).not.toBe(medium.sha256);
    write('_bmad/rules/extra.md', 'House rule: every exported function has a test.');
    write(
      '_bmad/review-rules.yaml',
      "schema: bmad-plus/review-rules/1\nrules:\n  - id: extra\n    title: Extra\n    globs: ['src/**']\n    doc: rules/extra.md\n"
    );
    const withProjectRule = review.buildScope(repo, { id: 'r1' });
    expect(withProjectRule.identity.rulesSha256).not.toBe(medium.identity.rulesSha256);
    expect(withProjectRule.sha256).not.toBe(medium.sha256);
    expect(withProjectRule.selected[0].rules).toContain('extra');
    expect(() => review.buildScope(repo, { effort: 'extreme' })).toThrow(/effort must be one of/);
  });

  it('plans before reading and splits units when the change is large', () => {
    expect(review.reviewPlan('low', 40, 1)).toEqual({
      effort: 'low',
      passes: 1,
      refute: false,
      planFirst: false,
      parallelUnits: false,
    });
    expect(review.reviewPlan('high', 900, 4)).toMatchObject({
      planFirst: true,
      parallelUnits: true,
    });
    expect(review.reviewPlan('medium', 900, 1).parallelUnits).toBe(false);
  });

  it('never lets an include pattern bring a secret back, and is reproducible', () => {
    const scope = review.buildScope(repo, { id: 'r1', include: ['**'] });
    expect(scope.selected.map((s) => s.path)).not.toContain('.env');
    expect(scope.selected.map((s) => s.path)).toContain('package-lock.json');
    expect(review.buildScope(repo, { id: 'r1', include: ['**'] }).sha256).toBe(scope.sha256);
  });

  it('refuses a ref that would reach git as an option', () => {
    expect(() => review.buildScope(repo, { base: '--output=/tmp/x' })).toThrow(/invalid ref/);
    expect(() => review.buildScope(repo, { base: 'no-such-branch' })).toThrow(
      /git rev-parse failed/
    );
  });

  it('reviews the working tree, untracked files included', () => {
    write('src/draft.js', 'module.exports = 2;\n');
    const scope = review.buildScope(repo, { id: 'w', base: 'HEAD', workspace: true });
    expect(scope.identity.head).toBe('WORKTREE');
    expect(scope.selected.map((s) => s.path)).toEqual(['src/draft.js']);
  });

  it('cuts review units by directory, file count and line budget, in path order', () => {
    const selected = ['a/1', 'a/2', 'a/3', 'b/1'].map((p) => ({ path: p, added: 150, removed: 0 }));
    expect(review.planUnits(selected, { files: 8, lines: 400 }).map((u) => u.paths)).toEqual([
      ['a/1', 'a/2'],
      ['a/3'],
      ['b/1'],
    ]);
  });
});

describe('anchoring', () => {
  it('locates a verbatim quote whatever the indentation, and never trusts a line number', () => {
    const text = 'a\n  for (let i = 0; i <= n; i++)\r\n    x();\nb\n';
    expect(review.locate(text, 'for (let i = 0; i <= n; i++)\n x();')).toEqual([
      { lineStart: 2, lineEnd: 3 },
    ]);
    expect(review.locate(text, 'for (let i = 0; i < n; i++)')).toEqual([]);
    expect(review.locate('x\ny\nx\n', 'x')).toHaveLength(2);
  });
});

describe('the review command', () => {
  const finding = (over = {}) => ({
    id: 'F1',
    path: 'src/cart.js',
    existing_code: 'for (let i = 0; i <= items.length; i++) sum += items[i].price;',
    content: 'Off-by-one: the last iteration reads items[items.length], which is undefined.',
    category: 'correctness',
    severity: 'high',
    confidence: 'high',
    disposition: 'confirmed',
    trigger: 'total([{ price: 1 }])',
    consequence: 'TypeError: Cannot read properties of undefined',
    evidence: 'loop bound uses <= on src/cart.js',
    ...over,
  });

  it('seals a scope, anchors findings and gates on coverage', () => {
    const scoped = run('scope', 'demo-1');
    expect(scoped.code).toBe(0);
    expect(scoped.value.totals.selected).toBe(2);
    const scope = JSON.parse(fs.readFileSync(paths('demo-1').scope, 'utf8'));

    // Without coverage the review is incomplete, whatever the findings say.
    saveJson(paths('demo-1').findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings: [],
    });
    const noCoverage = run('gate', 'demo-1');
    expect(noCoverage.code).toBe(2);
    expect(noCoverage.value.status).toBe('incomplete');

    // Zero findings with one file never looked at is not clean.
    saveJson(paths('demo-1').coverage, {
      schema: review.COVERAGE_SCHEMA,
      scopeSha256: scope.sha256,
      items: [{ path: 'src/cart.js', outcome: 'completed' }],
    });
    const partial = run('gate', 'demo-1');
    expect(partial.value.status).toBe('incomplete');
    expect(partial.value.reasons.join(' ')).toContain('never accounted for: src/util.js');

    // Full coverage and no finding: clean, and said to prove nothing more.
    saveJson(paths('demo-1').coverage, {
      schema: review.COVERAGE_SCHEMA,
      scopeSha256: scope.sha256,
      items: [
        { path: 'src/cart.js', outcome: 'completed' },
        { path: 'src/util.js', outcome: 'waived', reason: 'constants only' },
      ],
    });
    expect(run('gate', 'demo-1').value.status).toBe('clean');

    // A confirmed, anchored finding.
    saveJson(paths('demo-1').findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings: [finding()],
    });
    const anchored = run('anchor', 'demo-1');
    expect(anchored.code).toBe(0);
    expect(anchored.value.counts).toEqual({
      located: 1,
      ambiguous: 0,
      unlocated: 0,
      redactions: 0,
    });
    const withFinding = run('gate', 'demo-1');
    expect(withFinding.code).toBe(1);
    expect(withFinding.value.status).toBe('findings');
    expect(withFinding.value.findings.bySeverity.high).toBe(1);
  });

  it('refuses invented code, unknown enums, out-of-scope paths and a refutation without its ground', () => {
    run('scope', 'demo-2');
    const scope = JSON.parse(fs.readFileSync(paths('demo-2').scope, 'utf8'));
    const doc = (findings) => ({
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings,
    });

    saveJson(
      paths('demo-2').findings,
      doc([finding({ existing_code: 'for (const item of items) sum += item.cost;' })])
    );
    const invented = run('anchor', 'demo-2');
    expect(invented.code).toBe(1);
    expect(invented.value.counts.unlocated).toBe(1);

    saveJson(
      paths('demo-2').findings,
      doc([finding({ severity: 'major', path: '.env', disposition: 'refuted' })])
    );
    const invalid = run('anchor', 'demo-2');
    expect(invalid.code).toBe(1);
    const errors = invalid.value.errors.join(' ');
    expect(errors).toContain('severity "major"');
    expect(errors).toContain('.env is not in the review scope');
    expect(errors).toContain('keeps its refutation');

    // An ambiguous quote is not an anchor either.
    saveJson(
      paths('demo-2').findings,
      doc([finding({ id: 'F2', path: 'src/util.js', existing_code: 'const same = 1;' })])
    );
    expect(run('anchor', 'demo-2').value.counts.ambiguous).toBe(1);
  });

  it('keeps an unanchored open finding from producing a verdict, and ignores refuted ones', () => {
    run('scope', 'demo-3');
    const scope = JSON.parse(fs.readFileSync(paths('demo-3').scope, 'utf8'));
    saveJson(paths('demo-3').coverage, {
      schema: review.COVERAGE_SCHEMA,
      scopeSha256: scope.sha256,
      items: scope.selected.map((s) => ({ path: s.path, outcome: 'completed' })),
    });
    saveJson(paths('demo-3').findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings: [finding({ existing_code: 'not in the file' })],
    });
    expect(run('gate', 'demo-3').value.status).toBe('incomplete');
    saveJson(paths('demo-3').findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings: [
        finding({
          disposition: 'refuted',
          refutation: 'B: the caller filters empty carts (quoted)',
        }),
      ],
    });
    const verdict = run('gate', 'demo-3').value;
    expect(verdict.status).toBe('clean');
    expect(verdict.findings.refuted).toBe(1);
  });

  it('reads evidence written by Windows PowerShell 5.1, byte-order mark included', () => {
    run('scope', 'demo-bom');
    const scope = JSON.parse(fs.readFileSync(paths('demo-bom').scope, 'utf8'));
    const bom = String.fromCharCode(0xfeff);
    fs.writeFileSync(
      paths('demo-bom').findings,
      bom +
        JSON.stringify({
          schema: review.FINDINGS_SCHEMA,
          scopeSha256: scope.sha256,
          findings: [finding()],
        })
    );
    const anchored = run('anchor', 'demo-bom');
    expect(anchored.code).toBe(0);
    expect(anchored.value.counts.located).toBe(1);
  });

  it('rejects evidence written for another scope', () => {
    run('scope', 'demo-4');
    saveJson(paths('demo-4').coverage, {
      schema: review.COVERAGE_SCHEMA,
      scopeSha256: 'x'.repeat(64),
      items: [],
    });
    saveJson(paths('demo-4').findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: 'x'.repeat(64),
      findings: [],
    });
    const verdict = run('gate', 'demo-4').value;
    expect(verdict.status).toBe('incomplete');
    expect(verdict.reasons.join(' ')).toContain('scopeSha256 does not match');
  });

  it('refuses a bad id and an unknown action', () => {
    expect(run('scope', '../escape').code).toBe(3);
    expect(run('publish', 'demo-5').value.message).toContain('unknown action');
  });
});

describe('checklists, redaction and comparison', () => {
  const finding = (over = {}) => ({
    id: 'F1',
    path: 'src/cart.js',
    existing_code: 'for (let i = 0; i <= items.length; i++) sum += items[i].price;',
    content: 'Off-by-one: the last iteration reads items[items.length].',
    category: 'correctness',
    severity: 'high',
    confidence: 'high',
    disposition: 'confirmed',
    evidence: 'loop bound uses <=',
    ...over,
  });
  const record = (id, findings, coverageItems) => {
    const scope = JSON.parse(fs.readFileSync(paths(id).scope, 'utf8'));
    saveJson(paths(id).findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings,
    });
    if (coverageItems)
      saveJson(paths(id).coverage, {
        schema: review.COVERAGE_SCHEMA,
        scopeSha256: scope.sha256,
        items: coverageItems,
      });
    return scope;
  };

  it('writes the checklist of the rules that apply, and lists rules for a path', () => {
    const scoped = run('scope', 'c1', '--effort', 'high');
    expect(scoped.code).toBe(0);
    expect(scoped.value.plan.passes).toBe(3);
    const checklist = fs.readFileSync(paths('c1').checklist, 'utf8');
    expect(checklist).toContain('`javascript-typescript`');
    expect(checklist).toContain('Applies to: `src/cart.js`, `src/util.js`');
    expect(checklist).not.toContain('`python`');
    const rules = run('rules', 'src/app.py').value;
    expect(rules.rules.map((r) => r.id)).toEqual(['general', 'python']);
    expect(rules.rules.map((r) => r.group)).toEqual(['code', 'code']);
    expect(run('rules').value.rules.length).toBeGreaterThanOrEqual(8);
    expect(run('scope', 'c2', '--effort', 'extreme').code).toBe(3);
  });

  it('accepts a finding that names an applicable rule and refuses one that does not', () => {
    run('scope', 'c3');
    record('c3', [finding({ rule: 'javascript-typescript' })]);
    expect(run('anchor', 'c3').code).toBe(0);
    record('c3', [finding({ rule: 'python' })]);
    const refused = run('anchor', 'c3');
    expect(refused.code).toBe(1);
    expect(refused.value.errors.join(' ')).toContain('rule "python" does not apply to src/cart.js');
  });

  it('seals the controls each file touches and links a finding only to those', () => {
    write('_bmad/rules/money.md', 'Amounts are integer cents; never floats.');
    write(
      '_bmad/review-rules.yaml',
      [
        'schema: bmad-plus/review-rules/1',
        'rules:',
        '  - id: money',
        '    title: Money handling',
        "    globs: ['src/cart.js']",
        '    doc: rules/money.md',
        '    controls: [ISO27001:A.8.28, SOC2:CC8.1]',
      ].join('\n')
    );
    run('scope', 'c6');
    const scope = JSON.parse(fs.readFileSync(paths('c6').scope, 'utf8'));
    const touched = ['ISO27001:A.8.28', 'SOC2:CC8.1'];
    expect(scope.selected.find((s) => s.path === 'src/cart.js').controls).toEqual(touched);
    expect(scope.selected.find((s) => s.path === 'src/util.js')).not.toHaveProperty('controls');
    expect(scope.units.flatMap((unit) => unit.controls || [])).toEqual(touched);

    record('c6', [finding({ controls: ['GDPR:Art.32'] })]);
    const refused = run('anchor', 'c6');
    expect(refused.code).toBe(1);
    expect(refused.value.errors.join(' ')).toContain(
      'control "GDPR:Art.32" is not examined by the rules for src/cart.js'
    );
    record('c6', [finding({ controls: 'SOC2:CC8.1' })]);
    expect(run('anchor', 'c6').value.errors.join(' ')).toContain(
      'controls must be a non-empty list'
    );

    record(
      'c6',
      [finding({ controls: ['SOC2:CC8.1'] })],
      scope.selected.map((s) => ({ path: s.path, outcome: 'completed' }))
    );
    expect(run('anchor', 'c6').code).toBe(0);
    run('gate', 'c6', '--emit-check', 'out/c6.json');
    const check = JSON.parse(fs.readFileSync(path.join(repo, 'out/c6.json'), 'utf8'));
    expect(check.open[0].controls).toEqual(['SOC2:CC8.1']);
  });

  it('anchors on the real quote, then removes credentials from the written record', () => {
    run('scope', 'c4');
    const pat = `ghp_${'aB3dE5gH7jK9mN1pQ2sT4vW6xY8zAb3dE5gH'}`;
    record('c4', [finding({ content: `Reproduced with the token ${pat} pasted by mistake.` })]);
    const anchored = run('anchor', 'c4');
    expect(anchored.code).toBe(0);
    expect(anchored.value.counts).toMatchObject({ located: 1, redactions: 1 });
    const written = fs.readFileSync(paths('c4').anchored, 'utf8');
    expect(written).not.toContain(pat);
    expect(written).toContain('[REDACTED]');
  });

  it('compares two reviews without calling an unreviewed finding fixed', () => {
    run('scope', 'before');
    record('before', [
      finding({ id: 'B1' }),
      finding({
        id: 'B2',
        path: 'src/util.js',
        existing_code: 'module.exports = { same };',
        category: 'maintainability',
        severity: 'low',
      }),
      finding({
        id: 'B3',
        existing_code: 'let sum = 0;',
        category: 'documentation',
        severity: 'low',
      }),
      finding({
        id: 'B4',
        existing_code: 'return sum;',
        category: 'error-handling',
        severity: 'medium',
      }),
    ]);
    // The next change touches cart.js only, and moves its lines: identity must not depend on them.
    write(
      'src/cart.js',
      '// Cart totals.\nfunction total(items) {\n    let sum = 0;\n    for (let i = 0; i <= items.length; i++) sum += items[i].price;\n    return sum;\n}\nmodule.exports = { total };\n'
    );
    git('commit', '-q', '-am', 'comment');
    run('scope', 'after');
    record(
      'after',
      [
        finding({ id: 'A1' }),
        finding({
          id: 'A2',
          existing_code: 'let sum = 0;',
          category: 'documentation',
          severity: 'low',
          disposition: 'refuted',
          refutation: 'A: the header comment now documents it',
        }),
        finding({
          id: 'A3',
          existing_code: '// Cart totals.',
          category: 'documentation',
          severity: 'low',
        }),
      ],
      [{ path: 'src/cart.js', outcome: 'completed' }]
    );
    const compared = run('compare', 'after', '--since', 'before');
    expect(compared.code).toBe(0);
    expect(compared.value.counts).toEqual({
      new: 1,
      persisting: 1,
      resolved: 1,
      refuted: 1,
      not_reviewed: 1,
    });
    const result = JSON.parse(fs.readFileSync(paths('after').compare, 'utf8'));
    expect(result.buckets.persisting[0]).toMatchObject({ before: 'B1', after: 'A1' });
    expect(result.buckets.refuted[0]).toMatchObject({ before: 'B3', after: 'A2' });
    expect(result.buckets.resolved[0]).toMatchObject({ before: 'B4', path: 'src/cart.js' });
    expect(result.buckets.not_reviewed[0]).toMatchObject({ before: 'B2', path: 'src/util.js' });
    expect(result.buckets.new[0]).toMatchObject({ after: 'A3' });
    expect(run('compare', 'after').code).toBe(3);
    expect(run('compare', 'after', '--since', 'after').code).toBe(3);
  });

  it('follows a renamed file from one review to the next', () => {
    run('scope', 'r-before');
    record('r-before', [finding({ id: 'B1' })]);
    git('mv', 'src/cart.js', 'src/basket.js');
    git('commit', '-q', '-m', 'rename');
    run('scope', 'r-after');
    record(
      'r-after',
      [finding({ id: 'A1', path: 'src/basket.js' })],
      [{ path: 'src/basket.js', outcome: 'completed' }]
    );
    const result = run('compare', 'r-after', '--since', 'r-before').value;
    expect(result.counts).toMatchObject({ persisting: 1, new: 0, not_reviewed: 0 });
  });
});

describe('the check result for CI', () => {
  const finding = (over = {}) => ({
    id: 'F1',
    path: 'src/cart.js',
    existing_code: 'for (let i = 0; i <= items.length; i++) sum += items[i].price;',
    content: 'Off-by-one: the last iteration reads items[items.length].',
    category: 'correctness',
    severity: 'high',
    confidence: 'high',
    disposition: 'confirmed',
    evidence: 'loop bound uses <=',
    ...over,
  });
  const evidence = (id, findings, coverage) => {
    const scope = JSON.parse(fs.readFileSync(paths(id).scope, 'utf8'));
    saveJson(paths(id).findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: scope.sha256,
      findings,
    });
    if (coverage)
      saveJson(paths(id).coverage, {
        schema: review.COVERAGE_SCHEMA,
        scopeSha256: scope.sha256,
        ...coverage,
      });
    return scope;
  };
  const completed = (scope) => scope.selected.map((s) => ({ path: s.path, outcome: 'completed' }));

  it('writes the verdict, its anchored findings and a GitHub check payload, exit code unchanged', () => {
    run('scope', 'ci-1');
    const scope = JSON.parse(fs.readFileSync(paths('ci-1').scope, 'utf8'));
    evidence(
      'ci-1',
      [
        finding(),
        finding({
          id: 'F2',
          severity: 'low',
          category: 'documentation',
          existing_code: 'return sum;',
        }),
      ],
      {
        items: completed(scope),
      }
    );
    const gated = run('gate', 'ci-1', '--emit-check', 'out/check.json');
    expect(gated.code).toBe(1);
    const file = path.join(repo, 'out/check.json');
    expect(gated.value.check).toBe(file);
    const check = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(check).toMatchObject({
      schema: review.CHECK_SCHEMA,
      id: 'ci-1',
      scopeSha256: scope.sha256,
      status: 'findings',
      exitCode: 1,
      reasons: [],
      identity: { head: scope.identity.head, effort: 'medium' },
      findings: { open: 2, confirmed: 2 },
      coverage: { selected: 2, completed: 2 },
    });
    expect(check.open.map((f) => [f.id, f.lineStart, f.lineEnd])).toEqual([
      ['F1', 3, 3],
      ['F2', 4, 4],
    ]);
    expect(check.github.conclusion).toBe('failure');
    expect(check.github.output.annotations[0]).toEqual({
      path: 'src/cart.js',
      start_line: 3,
      end_line: 3,
      annotation_level: 'failure',
      title: 'high correctness (F1)',
      message: 'Off-by-one: the last iteration reads items[items.length].',
    });
    expect(check.github.output.annotations[1].annotation_level).toBe('notice');
    expect(check.github.output.summary).toContain('| high | correctness | F1 | src/cart.js:3 |');
    expect(check.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Same evidence, same bytes: nothing in the document depends on the clock.
    const bytes = fs.readFileSync(file, 'utf8');
    run('gate', 'ci-1', '--emit-check', 'out/check.json');
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes);
  });

  it('writes an incomplete verdict too, with the stop reason redacted of credentials', () => {
    run('scope', 'ci-2');
    const scope = JSON.parse(fs.readFileSync(paths('ci-2').scope, 'utf8'));
    const pat = `ghp_${'aB3dE5gH7jK9mN1pQ2sT4vW6xY8zAb3dE5gH'}`;
    evidence('ci-2', [], {
      items: completed(scope),
      run: { stop: 'budget', detail: `quota hit for token ${pat}`, passes: 1, attempts: [] },
    });
    const gated = run('gate', 'ci-2', '--emit-check', 'check.json');
    expect(gated.code).toBe(2);
    const text = fs.readFileSync(path.join(repo, 'check.json'), 'utf8');
    expect(text).not.toContain(pat);
    const check = JSON.parse(text);
    expect(check).toMatchObject({ status: 'incomplete', exitCode: 2, stop: 'budget' });
    expect(check.reasons[0]).toContain('the review stopped before the end (budget)');
    expect(check.github.conclusion).toBe('failure');
    // The CI log is the more exposed channel: the printed verdict is redacted the same way.
    expect(JSON.stringify(gated.value)).not.toContain(pat);
    expect(gated.value.reasons[0]).toContain('[REDACTED]');
    const printed = spawnSync(
      process.execPath,
      [cli, 'review', 'gate', 'ci-2', '--directory', repo],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 }
    );
    expect(printed.stdout).toContain('the review stopped before the end (budget)');
    expect(printed.stdout).not.toContain(pat);
  });

  it('keeps the check of a working-tree review out of the change it reports on', () => {
    write('src/draft.js', 'module.exports = 2;\n');
    run('scope', 'ci-5', '--workspace', '--base', 'HEAD');
    const refused = run('gate', 'ci-5', '--emit-check', 'review-check.json');
    expect(refused.code).toBe(3);
    expect(refused.value.message).toContain('a working-tree review writes its check in');
    expect(fs.existsSync(path.join(repo, 'review-check.json'))).toBe(false);
    const target = `${review.DEFAULT_DIR}/ci-5.check.json`;
    expect(run('gate', 'ci-5', '--emit-check', target).code).toBe(2);
    expect(fs.existsSync(path.join(repo, target))).toBe(true);
    expect(run('continue', 'ci-5').code).toBe(0);
  });

  it('reports a clean review as a success that proves nothing more', () => {
    run('scope', 'ci-3');
    const scope = JSON.parse(fs.readFileSync(paths('ci-3').scope, 'utf8'));
    evidence('ci-3', [], { items: completed(scope) });
    expect(run('gate', 'ci-3', '--emit-check', 'check.json').code).toBe(0);
    const check = JSON.parse(fs.readFileSync(path.join(repo, 'check.json'), 'utf8'));
    expect(check).toMatchObject({ status: 'clean', exitCode: 0, open: [] });
    expect(check.github.conclusion).toBe('success');
    expect(check.github.output.summary).toContain('does not prove the code correct');
  });

  it('never overwrites the review evidence and writes only JSON', () => {
    run('scope', 'ci-4');
    const coverage = path.relative(repo, paths('ci-4').coverage);
    expect(run('gate', 'ci-4', '--emit-check', coverage).value.message).toContain(
      'must not overwrite the review evidence'
    );
    expect(run('gate', 'ci-4', '--emit-check', 'package.js').code).toBe(3);
    expect(fs.existsSync(paths('ci-4').coverage)).toBe(false);
  });
});

describe('continuing an interrupted review', () => {
  const sealed = (id) => JSON.parse(fs.readFileSync(paths(id).scope, 'utf8'));
  const cover = (id, items, reviewRun) =>
    saveJson(paths(id).coverage, {
      schema: review.COVERAGE_SCHEMA,
      scopeSha256: sealed(id).sha256,
      items,
      ...(reviewRun ? { run: reviewRun } : {}),
    });

  it('lists what remains against the same scope: files, passes and findings to requote', () => {
    run('scope', 'k1');
    cover('k1', [{ path: 'src/cart.js', outcome: 'completed' }], {
      stop: 'budget',
      detail: 'the host token budget ran out',
      passes: 1,
      attempts: [{ unit: 'u1', outcome: 'completed' }],
    });
    saveJson(paths('k1').findings, {
      schema: review.FINDINGS_SCHEMA,
      scopeSha256: sealed('k1').sha256,
      findings: [
        {
          id: 'F1',
          path: 'src/cart.js',
          existing_code: 'for (const item of items)',
          content: 'Quoted from memory, not from the file.',
          category: 'correctness',
          severity: 'medium',
          confidence: 'low',
          disposition: 'unresolved',
        },
      ],
    });
    const continued = run('continue', 'k1');
    expect(continued.code).toBe(0);
    expect(continued.value.status).toBe('ready');
    const packet = JSON.parse(fs.readFileSync(paths('k1').continue, 'utf8'));
    expect(packet).toMatchObject({
      schema: review.CONTINUE_SCHEMA,
      scopeSha256: sealed('k1').sha256,
      counts: { files: 1, units: 1, abandoned: 0, requote: 1, findingErrors: 0, passes: 1 },
      units: [{ id: 'u1', paths: ['src/util.js'] }],
      files: [{ path: 'src/util.js', unit: 'u1', state: 'missing' }],
      requote: [{ id: 'F1', status: 'unlocated' }],
      previous: { stop: 'budget', usage: { passes: 1, plannedPasses: 2 } },
    });
  });

  it('does not retry a unit abandoned under the three-strikes rule', () => {
    run('scope', 'k2');
    const failed = { unit: 'u1', outcome: 'failed', reason: 'the reviewer crashed' };
    cover(
      'k2',
      [
        { path: 'src/cart.js', outcome: 'failed', reason: 'three failed attempts' },
        { path: 'src/util.js', outcome: 'failed', reason: 'three failed attempts' },
      ],
      {
        stop: 'failure-streak',
        detail: 'u1 failed three times',
        passes: 0,
        attempts: [failed, failed, failed],
      }
    );
    const packet = run('continue', 'k2').value;
    expect(packet.counts).toMatchObject({ files: 0, abandoned: 2 });
  });

  it('refuses to continue once the head moved, and says to scope again and compare', () => {
    run('scope', 'k3');
    write('src/util.js', 'module.exports = { same: 2 };\n');
    git('commit', '-q', '-am', 'more work');
    const refused = run('continue', 'k3');
    expect(refused.code).toBe(3);
    expect(refused.value.status).toBe('moved');
    expect(refused.value.drift[0]).toMatch(/^HEAD moved from [0-9a-f]{12} to [0-9a-f]{12}$/);
    expect(refused.value.next[1]).toBe('bmad-plus review compare <new-id> --since k3');
    expect(fs.existsSync(paths('k3').continue)).toBe(false);
  });

  it('continues a scope sealed on an explicit commit after new commits land', () => {
    const head = git('rev-parse', 'HEAD').trim();
    run('scope', 'k4', '--head', head);
    write('NOTES.md', 'later\n');
    git('add', '.');
    git('commit', '-q', '-m', 'later');
    expect(run('continue', 'k4').code).toBe(0);
  });

  it('refuses when the review rules changed', () => {
    run('scope', 'k5');
    write('_bmad/rules/extra.md', 'House rule: every exported function has a test.');
    write(
      '_bmad/review-rules.yaml',
      "schema: bmad-plus/review-rules/1\nrules:\n  - id: extra\n    title: Extra\n    globs: ['src/**']\n    doc: rules/extra.md\n"
    );
    const refused = run('continue', 'k5');
    expect(refused.code).toBe(3);
    expect(refused.value.drift).toEqual(['the review rules changed']);
  });

  it('seals the bytes of a working tree, so an edit of the same size is still seen', () => {
    write('src/draft.js', 'module.exports = 2;\n');
    run('scope', 'k6', '--workspace', '--base', 'HEAD');
    expect(sealed('k6').selected[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(run('continue', 'k6').code).toBe(0);
    write('src/draft.js', 'module.exports = 3;\n');
    const refused = run('continue', 'k6');
    expect(refused.code).toBe(3);
    expect(refused.value.drift).toEqual([
      '1 file(s) changed since the scope was sealed: src/draft.js',
    ]);
  });

  it('refuses a scope sealed before continuation existed and coverage for another scope', () => {
    run('scope', 'k7');
    const legacy = sealed('k7');
    delete legacy.identity.headRef;
    saveJson(paths('k7').scope, legacy);
    expect(run('continue', 'k7').value.drift[0]).toContain('before continuation existed');

    // A working tree sealed then had neither headRef nor per-file digests: the same answer,
    // not a false report that every file changed.
    write('src/draft.js', 'module.exports = 2;\n');
    run('scope', 'k9', '--workspace', '--base', 'HEAD');
    const older = sealed('k9');
    delete older.identity.headRef;
    for (const item of older.selected) delete item.sha256;
    saveJson(paths('k9').scope, older);
    const refused = run('continue', 'k9');
    expect(refused.code).toBe(3);
    expect(refused.value.drift).toEqual([
      'the scope was sealed without its head ref, before continuation existed',
    ]);

    run('scope', 'k8');
    saveJson(paths('k8').coverage, {
      schema: review.COVERAGE_SCHEMA,
      scopeSha256: 'x'.repeat(64),
      items: [],
    });
    const invalid = run('continue', 'k8');
    expect(invalid.code).toBe(3);
    expect(invalid.value.errors.join(' ')).toContain('scopeSha256 does not match');
  });
});
