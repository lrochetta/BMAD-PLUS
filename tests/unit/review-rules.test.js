/** Path-scoped review checklists: built-in rules, project layer, confinement. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const reviewRules = require('../../tools/cli/lib/review-rules');

let project;
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
  fs.writeFileSync(path.join(project, file), text);
};

beforeEach(() => {
  project = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'rules-'));
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

describe('built-in review rules', () => {
  it('load, every document is non-empty, and every rule id is unique', () => {
    const ruleset = reviewRules.loadRuleset(project);
    expect(ruleset.rules.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ruleset.rules.map((r) => r.id)).size).toBe(ruleset.rules.length);
    for (const rule of ruleset.rules) {
      expect(rule.layer).toBe('builtin');
      expect(rule.text.length).toBeGreaterThan(200);
    }
    expect(ruleset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ruleset.projectFile).toBeNull();
  });

  it('apply by path, and several rules add up on one file', () => {
    const ruleset = reviewRules.loadRuleset(project);
    expect(reviewRules.rulesFor(ruleset, 'src/app.ts')).toEqual([
      'general',
      'javascript-typescript',
    ]);
    expect(reviewRules.rulesFor(ruleset, 'api/views.py')).toEqual(['general', 'python']);
    expect(reviewRules.rulesFor(ruleset, 'db/migrations/001_init.sql')).toEqual([
      'general',
      'sql-and-migrations',
    ]);
    expect(reviewRules.rulesFor(ruleset, '.github/workflows/ci.yml')).toEqual([
      'general',
      'ci-workflows',
      'configuration',
    ]);
    expect(reviewRules.rulesFor(ruleset, 'deploy/Dockerfile')).toEqual(['general', 'containers']);
    expect(reviewRules.rulesFor(ruleset, 'README.md')).toEqual(['general']);
  });
});

describe('project review rules', () => {
  it('add rules, replace a built-in one by id, and disable another — all hashed', () => {
    const before = reviewRules.loadRuleset(project).sha256;
    write(
      '_bmad/rules/money.md',
      'Amounts are integer cents; never floats. Rounding happens once, at display.'
    );
    write('_bmad/rules/python.md', 'Our Python rule: every public function is typed.');
    write(
      '_bmad/review-rules.yaml',
      [
        'schema: bmad-plus/review-rules/1',
        'disable: [shell]',
        'rules:',
        '  - id: money',
        '    title: Money handling',
        "    globs: ['src/billing/**']",
        '    doc: rules/money.md',
        '  - id: python',
        '    title: Python (house rules)',
        "    globs: ['**/*.py']",
        '    doc: rules/python.md',
      ].join('\n')
    );
    const ruleset = reviewRules.loadRuleset(project);
    expect(ruleset.sha256).not.toBe(before);
    expect(ruleset.projectFile).toBe('_bmad/review-rules.yaml');
    expect(ruleset.disabled).toEqual(['shell']);
    expect(reviewRules.rulesFor(ruleset, 'scripts/deploy.sh')).toEqual(['general']);
    expect(reviewRules.rulesFor(ruleset, 'src/billing/invoice.ts')).toEqual([
      'general',
      'javascript-typescript',
      'money',
    ]);
    const python = ruleset.rules.find((r) => r.id === 'python');
    expect(python.layer).toBe('project');
    expect(python.text).toBe('Our Python rule: every public function is typed.');
  });

  it('refuse a document outside the project folder, a non-Markdown file, unknown keys and a missing file', () => {
    const index = (doc, extra = '') =>
      write(
        '_bmad/review-rules.yaml',
        `schema: bmad-plus/review-rules/1\n${extra}rules:\n  - id: x\n    title: X\n    globs: ['**']\n    doc: ${doc}\n`
      );
    index('../../etc/passwd.md');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/leaves/);
    index('rules/x.txt');
    write('_bmad/rules/x.txt', 'text');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/Markdown/);
    index('rules/x.md', 'owner: me\n');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/unknown key/);
    index('rules/missing.md', 'disable: [nope]\n');
    expect(() => reviewRules.loadRuleset(project)).toThrow();
  });

  it('refuse to disable a rule that does not exist', () => {
    write('_bmad/review-rules.yaml', 'schema: bmad-plus/review-rules/1\ndisable: [not-a-rule]\n');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/unknown rule\(s\) not-a-rule/);
  });

  it('refuse an oversized document', () => {
    write('_bmad/rules/big.md', 'x'.repeat(70 * 1024));
    write(
      '_bmad/review-rules.yaml',
      "schema: bmad-plus/review-rules/1\nrules:\n  - id: big\n    title: Big\n    globs: ['**']\n    doc: rules/big.md\n"
    );
    expect(() => reviewRules.loadRuleset(project)).toThrow(/exceeds/);
  });
});

describe('rule groups', () => {
  it('sort the built-in rules into families, in rule order', () => {
    const ruleset = reviewRules.loadRuleset(project);
    expect(Object.fromEntries(ruleset.rules.map((r) => [r.id, r.group]))).toEqual({
      general: 'code',
      'javascript-typescript': 'code',
      python: 'code',
      'sql-and-migrations': 'data',
      shell: 'code',
      'ci-workflows': 'delivery',
      containers: 'delivery',
      configuration: 'delivery',
    });
    expect(
      reviewRules.groupsOf(ruleset, ['configuration', 'general', 'sql-and-migrations', 'python'])
    ).toEqual([
      { id: 'code', rules: ['general', 'python'] },
      { id: 'data', rules: ['sql-and-migrations'] },
      { id: 'delivery', rules: ['configuration'] },
    ]);
  });

  it('default to the rule id, are hashed, and refuse an invalid name', () => {
    write('_bmad/rules/money.md', 'Amounts are integer cents; never floats.');
    const index = (group) =>
      write(
        '_bmad/review-rules.yaml',
        `schema: bmad-plus/review-rules/1\nrules:\n  - id: money\n    title: Money\n${group ? `    group: ${group}\n` : ''}    globs: ['src/billing/**']\n    doc: rules/money.md\n`
      );
    index();
    const alone = reviewRules.loadRuleset(project);
    expect(alone.rules.find((r) => r.id === 'money').group).toBe('money');
    index('data');
    const withData = reviewRules.loadRuleset(project);
    expect(withData.rules.find((r) => r.id === 'money').group).toBe('data');
    expect(withData.sha256).not.toBe(alone.sha256);
    index('"Data Team"');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/invalid group/);
    // A YAML number or boolean is not a name, even when its digits would be one.
    for (const scalar of ['123', 'true']) {
      index(scalar);
      expect(() => reviewRules.loadRuleset(project)).toThrow(/invalid group/);
    }
  });
});

describe('the checklist', () => {
  it('lists each applicable rule once with the files it covers, and nothing else', () => {
    const ruleset = reviewRules.loadRuleset(project);
    const text = reviewRules.checklist(ruleset, {
      'src/a.ts': ['general', 'javascript-typescript'],
      'src/b.ts': ['general', 'javascript-typescript'],
      'README.md': ['general'],
    });
    expect(text.match(/^## /gm)).toHaveLength(2);
    expect(text).toContain('Applies to: `src/a.ts`, `src/b.ts`');
    expect(text).toContain('Group: `code`');
    expect(text).not.toContain('`python`');
    expect(text).toContain(ruleset.sha256.slice(0, 12));
    expect(text).not.toContain('Controls');
  });
});

describe('control-tagged rules', () => {
  const rule = (extra) =>
    write(
      '_bmad/review-rules.yaml',
      `schema: bmad-plus/review-rules/1\nrules:\n  - id: money\n    title: Money\n    globs: ['src/billing/**']\n    doc: rules/money.md\n${extra}`
    );
  beforeEach(() => write('_bmad/rules/money.md', 'Amounts are integer cents; never floats.'));

  it('keep the hash of a rule set that names no control', () => {
    const sha256 = (value) =>
      require('node:crypto').createHash('sha256').update(value).digest('hex');
    const ruleset = reviewRules.loadRuleset(project);
    const before = ruleset.rules.map((r) => [r.id, r.group, r.layer, r.globs, sha256(r.text)]);
    expect(ruleset.sha256).toBe(sha256(JSON.stringify({ rules: before, disabled: [] })));
  });

  it('carry validated controls, hashed, and refuse an invented one', () => {
    rule('');
    const plain = reviewRules.loadRuleset(project);
    rule('    controls: [ISO27001:A.8.28, SOC2:CC8.1]\n');
    const tagged = reviewRules.loadRuleset(project);
    expect(tagged.rules.find((r) => r.id === 'money').controls).toEqual([
      'ISO27001:A.8.28',
      'SOC2:CC8.1',
    ]);
    expect(tagged.sha256).not.toBe(plain.sha256);
    rule('    controls: [ISO27001:A.8.99]\n');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/rule money: .*names no ISO27001/);
    rule('    controls: []\n');
    expect(() => reviewRules.loadRuleset(project)).toThrow(/non-empty list/);
  });

  it('list the controls a change touches at the head of the checklist', () => {
    rule('    controls: [ISO27001:A.8.28, GDPR:Art.32]\n');
    const ruleset = reviewRules.loadRuleset(project);
    const byPath = { 'src/billing/a.ts': reviewRules.rulesFor(ruleset, 'src/billing/a.ts') };
    expect(reviewRules.controlsOf(ruleset, byPath['src/billing/a.ts'])).toEqual([
      { id: 'ISO27001:A.8.28', rules: ['money'] },
      { id: 'GDPR:Art.32', rules: ['money'] },
    ]);
    const text = reviewRules.checklist(ruleset, byPath);
    expect(text).toContain('## Controls this change touches');
    expect(text).toContain('- `ISO27001:A.8.28` — `money`');
    expect(text).toContain('Controls: `ISO27001:A.8.28`, `GDPR:Art.32`');
    expect(text.indexOf('## Controls')).toBeLessThan(text.indexOf('## Money'));
  });
});

describe('the Shield pack rules', () => {
  const shieldRules = path.resolve(__dirname, '../../src/bmad-plus/packs/pack-shield/review-rules');
  const installShield = () =>
    fs.cpSync(shieldRules, path.join(project, '.agents/skills/pack-shield/review-rules'), {
      recursive: true,
    });

  it('apply only once the pack is installed, as one compliance group with controls', () => {
    const without = reviewRules.loadRuleset(project);
    expect(without.packFiles).toEqual([]);
    installShield();
    const ruleset = reviewRules.loadRuleset(project);
    expect(ruleset.packFiles).toEqual(['.agents/skills/pack-shield/review-rules/index.yaml']);
    expect(ruleset.sha256).not.toBe(without.sha256);
    const shield = ruleset.rules.filter((r) => r.layer === 'pack');
    expect(shield.length).toBeGreaterThanOrEqual(6);
    for (const r of shield) {
      expect(r.pack).toBe('shield');
      expect(r.group).toBe('compliance');
      expect(r.controls.length).toBeGreaterThan(0);
      expect(r.text.length).toBeGreaterThan(200);
    }
    expect(reviewRules.rulesFor(ruleset, 'src/auth/login.ts')).toEqual([
      'general',
      'javascript-typescript',
      'shield-access-control',
    ]);
    expect(reviewRules.rulesFor(ruleset, 'src/llm/client.py')).toContain('shield-ai-integrations');
    expect(reviewRules.rulesFor(ruleset, 'db/migrations/002_users.sql')).toContain(
      'shield-personal-data'
    );
    expect(reviewRules.rulesFor(ruleset, 'src/controller.js')).toEqual([
      'general',
      'javascript-typescript',
    ]);
  });

  it('can be disabled by the project, never replace or disable a built-in rule', () => {
    installShield();
    write(
      '_bmad/review-rules.yaml',
      'schema: bmad-plus/review-rules/1\ndisable: [shield-logging]\n'
    );
    const ruleset = reviewRules.loadRuleset(project);
    expect(ruleset.disabled).toEqual(['shield-logging']);
    expect(ruleset.rules.some((r) => r.id === 'shield-logging')).toBe(false);
    fs.rmSync(path.join(project, '_bmad/review-rules.yaml'));

    const index = path.join(project, '.agents/skills/pack-shield/review-rules/index.yaml');
    const original = fs.readFileSync(index, 'utf8');
    fs.writeFileSync(index, original.replace('id: shield-logging', 'id: python'));
    expect(() => reviewRules.loadRuleset(project)).toThrow(/rule python already exists/);
    fs.writeFileSync(index, original.replace('rules:', 'disable: [python]\nrules:'));
    expect(() => reviewRules.loadRuleset(project)).toThrow(/only a project's rules can disable/);
  });

  it('show their controls in review rules --json', () => {
    installShield();
    const { spawnSync } = require('node:child_process');
    const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
    const r = spawnSync(
      process.execPath,
      [cli, 'review', 'rules', 'src/auth/session.ts', '--directory', project, '--json'],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 }
    );
    expect(r.status).toBe(0);
    const value = JSON.parse(r.stdout);
    expect(value.packFiles).toEqual(['.agents/skills/pack-shield/review-rules/index.yaml']);
    const access = value.rules.find((x) => x.id === 'shield-access-control');
    expect(access).toMatchObject({ layer: 'pack', pack: 'shield', group: 'compliance' });
    expect(access.controls).toContain('ISO27001:A.8.5');
    expect(value.controls.map((c) => c.id)).toContain('SOC2:CC6.1');
  });
});
