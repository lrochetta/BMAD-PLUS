/** CI review recipes: they parse, pin every action, keep forks and secrets out, and their scripts work. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const semver = require('semver');

const { checkWorkflow, verifyDirectory } = require('../../tools/build/verify-action-pins');
const review = require('../../tools/cli/lib/review');
const reviewCommand = require('../../tools/cli/commands/review');
const pkg = require('../../package.json');

const DIR = path.resolve(__dirname, '../../docs/recipes/ci-review');
const CLI = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const RECIPES = ['review-gate.yml', 'review-scope.yml'];

const load = (name) => {
  const text = fs.readFileSync(path.join(DIR, name), 'utf8');
  return { text, doc: yaml.load(text) };
};
const scripts = (doc) =>
  Object.values(doc.jobs)
    .flatMap((job) => job.steps)
    .filter((step) => step.run)
    .map((step) => step.run);

describe('CI review recipes', () => {
  it('ships exactly the documented recipes', () => {
    const files = fs.readdirSync(DIR).filter((name) => /\.ya?ml$/.test(name));
    expect(files.sort()).toEqual(RECIPES);
  });

  it.each(RECIPES)(
    '%s runs read-only, on same-repository pull requests, on a self-hosted runner',
    (name) => {
      const { doc } = load(name);
      expect(Object.keys(doc.on)).toEqual(['pull_request']);
      expect(doc.permissions).toEqual({ contents: 'read' });
      expect(doc.defaults.run.shell).toBe('bash');
      const selfHosted = Object.values(doc.jobs).filter((job) =>
        [].concat(job['runs-on']).includes('self-hosted')
      );
      expect(selfHosted.length).toBeGreaterThan(0);
      for (const job of Object.values(doc.jobs)) {
        if (!selfHosted.includes(job)) {
          // Only the fork fallback runs elsewhere: GitHub-hosted, no checkout, no action at all.
          expect(job['runs-on']).toBe('ubuntu-latest');
          expect(job.if).toMatch(
            /github\.event\.pull_request\.head\.repo\.full_name != github\.repository/
          );
          expect(job.steps.every((step) => !step.uses && !/checkout|git /.test(step.run))).toBe(
            true
          );
          continue;
        }
        expect(job['runs-on']).toEqual(expect.arrayContaining(['self-hosted', 'linux']));
        expect(job.if).toMatch(
          /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/
        );
        expect(job['timeout-minutes']).toBeGreaterThan(0);
        const checkout = job.steps.find((step) =>
          String(step.uses).startsWith('actions/checkout@')
        );
        expect(checkout.with).toEqual({
          ref: '${{ github.event.pull_request.head.sha }}',
          'fetch-depth': 0,
          'persist-credentials': false,
        });
      }
    }
  );

  it('pins every third-party action by commit, with its version beside it', () => {
    const { files, references, problems } = verifyDirectory(DIR);
    expect(problems).toEqual([]);
    expect(files).toBe(RECIPES.length);
    expect(references).toBe(6);
    const retagged = load('review-gate.yml').text.replace(
      /actions\/checkout@[0-9a-f]{40}/,
      'actions/checkout@v7'
    );
    expect(checkWorkflow(retagged, 'review-gate.yml')).toEqual([
      expect.stringMatching(/actions\/checkout@v7 — pin to a full 40-character commit SHA/),
    ]);
  });

  it.each(RECIPES)('%s expands no expression inside a script and reads no secret', (name) => {
    const { text, doc } = load(name);
    expect(text).not.toMatch(/secrets\./);
    for (const script of scripts(doc)) expect(script).not.toMatch(/\$\{\{/);
  });

  it.each(RECIPES)('%s installs an exact BMAD+ release and uses only options it has', (name) => {
    const { text, doc } = load(name);
    const version = doc.env.BMAD_PLUS_VERSION;
    expect(semver.valid(version)).toBe(version);
    // 0.20.0 brought --effort and checklist.md; a recipe cannot name an unreleased version.
    expect(semver.gte(version, '0.20.0')).toBe(true);
    expect(semver.lte(version, pkg.version)).toBe(true);
    expect(text).not.toMatch(/bmad-plus@(?!\$\{BMAD_PLUS_VERSION\})/);
    const flags = new Set(reviewCommand.options.flatMap(([spec]) => spec.match(/--[a-z-]+/g)));
    let calls = 0;
    for (const script of scripts(doc))
      for (const [, action, rest] of script.matchAll(/bmad-plus review (\w+)([^\n|>]*)/g)) {
        calls += 1;
        expect(['scope', 'anchor', 'gate']).toContain(action);
        for (const flag of rest.match(/--[a-z-]+/g) || []) expect(flags).toContain(flag);
      }
    expect(calls).toBeGreaterThan(0);
  });

  it('review-gate fails a fork pull request instead of skipping it into a green check', () => {
    const { review: reviewJob, fork } = load('review-gate.yml').doc.jobs;
    const draft = ' && !github.event.pull_request.draft';
    const repoCondition = 'github.event.pull_request.head.repo.full_name %s github.repository';
    expect(reviewJob.if).toBe(repoCondition.replace('%s', '==') + draft);
    expect(fork.if).toBe(repoCondition.replace('%s', '!=') + draft);
    expect(fork.name).toBe(`${reviewJob.name} (fork)`);
    expect(fork.steps).toHaveLength(1);
    expect(fork.steps[0].run).toMatch(/exit 1\s*$/);
  });

  it('asks the agent for the exact vocabularies of the review schemas', () => {
    const text = fs.readFileSync(path.join(DIR, 'review-agent.sh'), 'utf8');
    expect(text).toMatch(/^#!\/usr\/bin\/env bash\n/);
    expect(text).toContain('set -euo pipefail');
    for (const value of [
      review.FINDINGS_SCHEMA,
      review.COVERAGE_SCHEMA,
      ...review.CATEGORIES,
      ...review.SEVERITIES,
      ...review.CONFIDENCE,
      ...review.DISPOSITIONS,
      ...review.OUTCOMES,
    ])
      expect(text).toContain(value);
    expect(
      text
        .match(/category \(([^)]+)\)/)[1]
        .replace(/\s/g, '')
        .split('|')
    ).toEqual(review.CATEGORIES);
  });
});

// The scripts of the recipes, run by bash as the runner would, against a real repository and
// the CLI of this checkout. The agent step is replaced by a test double.
const describeUnix = process.platform === 'win32' ? describe.skip : describe;

describeUnix('recipe scripts on a pull request', () => {
  let temp;
  let repo;
  let bin;
  let runnerTemp;
  let summary;
  let commits;

  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
  };

  beforeEach(() => {
    temp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recipes-'));
    repo = path.join(temp, 'repo');
    bin = path.join(temp, 'bin');
    runnerTemp = path.join(temp, 'runner');
    summary = path.join(runnerTemp, 'summary.md');
    for (const dir of [repo, bin, runnerTemp]) fs.mkdirSync(dir);
    // Stands in for the pinned CLI the install step would put on PATH.
    fs.writeFileSync(
      path.join(bin, 'bmad-plus'),
      `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`,
      { mode: 0o755 }
    );
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
    write('src/cart.js', 'function total(items) {\n  return 0;\n}\nmodule.exports = { total };\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    write(
      'src/cart.js',
      'function total(items) {\n  let sum = 0;\n  for (let i = 0; i <= items.length; i++) sum += items[i].price;\n  return sum;\n}\nmodule.exports = { total };\n'
    );
    git('commit', '-q', '-am', 'change');
    commits = { base, head: git('rev-parse', 'HEAD') };
  });

  afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));

  const expression = (value, outputs = {}) =>
    String(value).replace(/\$\{\{\s*(.+?)\s*\}\}/g, (_, name) => {
      const known = {
        'github.event.pull_request.number': '7',
        'github.event.pull_request.base.sha': commits.base,
        'github.event.pull_request.head.sha': commits.head,
      };
      const output = /^steps\.([\w-]+)\.outputs\.([\w-]+)$/.exec(name);
      // As on GitHub, an output the step did not set expands to an empty string.
      if (output) return (outputs[output[1]] || {})[output[2]] || '';
      if (!(name in known)) throw new Error(`the test does not know ${name}`);
      return known[name];
    });
  const resolved = (env = {}, outputs = {}) =>
    Object.fromEntries(
      Object.entries(env).map(([key, value]) => [key, expression(value, outputs)])
    );
  /** Reads the `name=value` lines a step appended to its GITHUB_OUTPUT file. */
  const readOutputs = (file) =>
    fs.existsSync(file)
      ? Object.fromEntries(
          fs
            .readFileSync(file, 'utf8')
            .split('\n')
            .filter((line) => line.includes('='))
            .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
        )
      : {};

  /** Runs every script step of the recipe's job in order; stops at the first failing one. */
  function runRecipe(name, agent, overrides = {}) {
    const { doc } = load(name);
    const [job] = Object.values(doc.jobs);
    const env = {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      RUNNER_TEMP: runnerTemp,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_PATH: path.join(runnerTemp, 'github-path'),
      ...resolved(doc.env),
      ...resolved(job.env),
      ...overrides,
    };
    const outputs = {};
    for (const [index, step] of job.steps.entries()) {
      if (step.uses || /^Install /.test(step.name)) continue;
      if (step.run.includes('.github/review/agent.sh')) {
        agent(path.join(repo, '_bmad-output/review', env.REVIEW_ID));
        continue;
      }
      const outputFile = path.join(runnerTemp, `output-${index}`);
      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run],
        {
          cwd: repo,
          env: { ...env, ...resolved(step.env, outputs), GITHUB_OUTPUT: outputFile },
          encoding: 'utf8',
          timeout: 30000,
        }
      );
      if (result.status !== 0)
        return { code: result.status, step: step.name, output: result.stdout + result.stderr };
      if (step.id) outputs[step.id] = readOutputs(outputFile);
    }
    return { code: 0 };
  }

  const readSummary = () => fs.readFileSync(summary, 'utf8');
  const VERIFY = 'Verify the review left the code and the scope untouched';
  /** A test double for agent.sh: writes the findings and, unless told otherwise, full coverage. */
  const agentWriting =
    (findings, { coverage = true } = {}) =>
    (dir) => {
      const { sha256, selected } = JSON.parse(
        fs.readFileSync(path.join(dir, 'scope.json'), 'utf8')
      );
      const doc = { schema: review.FINDINGS_SCHEMA, scopeSha256: sha256, findings };
      fs.writeFileSync(path.join(dir, 'findings.json'), JSON.stringify(doc));
      if (coverage)
        fs.writeFileSync(
          path.join(dir, 'coverage.json'),
          JSON.stringify({
            schema: review.COVERAGE_SCHEMA,
            scopeSha256: sha256,
            items: selected.map((item) => ({ path: item.path, outcome: 'completed' })),
          })
        );
    };
  const offByOne = {
    id: 'f1',
    path: 'src/cart.js',
    existing_code: 'for (let i = 0; i <= items.length; i++) sum += items[i].price;',
    content: 'Reads one item past the end.',
    category: 'correctness',
    severity: 'high',
    confidence: 'high',
    disposition: 'confirmed',
    evidence: 'items[items.length] is undefined.',
  };

  it('review-scope publishes the scope and its checklist', () => {
    expect(runRecipe('review-scope.yml')).toEqual({ code: 0 });
    const text = readSummary();
    expect(text).toContain('### BMAD+ review scope');
    expect(text).toMatch(/1 file\(s\) to review/);
    expect(text).toContain('Review checklist — pr-7');
    expect(fs.existsSync(path.join(repo, '_bmad-output/review/pr-7/scope.json'))).toBe(true);
  });

  it('review-gate passes a clean, fully covered review', () => {
    expect(runRecipe('review-gate.yml', agentWriting([]))).toEqual({ code: 0 });
    expect(readSummary()).toContain('### BMAD+ review: clean');
    expect(readSummary()).toContain('Coverage 1/1 files completed, 0 waived.');
  });

  it('review-gate fails on an open finding, unless told to report only', () => {
    const failed = runRecipe('review-gate.yml', agentWriting([offByOne]));
    expect(failed).toMatchObject({ code: 1, step: 'Anchor the findings and derive the verdict' });
    expect(failed.output).toContain('::error title=Review findings::');
    expect(readSummary()).toContain('Open findings 1 (1 confirmed, 0 unresolved), 0 refuted.');
    fs.rmSync(path.join(repo, '_bmad-output'), { recursive: true });
    const reported = runRecipe('review-gate.yml', agentWriting([offByOne]), {
      FAIL_ON_FINDINGS: 'false',
    });
    expect(reported).toEqual({ code: 0 });
    const anchored = JSON.parse(
      fs.readFileSync(path.join(repo, '_bmad-output/review/pr-7/findings.anchored.json'), 'utf8')
    );
    expect(anchored.findings[0].location).toEqual({ status: 'located', lineStart: 3, lineEnd: 3 });
  });

  it('review-gate fails an incomplete review and says why', () => {
    const result = runRecipe('review-gate.yml', agentWriting([], { coverage: false }));
    expect(result).toMatchObject({ code: 2, step: 'Anchor the findings and derive the verdict' });
    expect(readSummary()).toContain('### BMAD+ review: incomplete');
    expect(readSummary()).toContain('- no coverage.json');
  });

  it('review-gate stops when the agent changed the code it reviewed', () => {
    const result = runRecipe('review-gate.yml', (dir) => {
      agentWriting([])(dir);
      write('src/cart.js', 'module.exports = { total: () => 0 };\n');
    });
    expect(result).toMatchObject({ code: 1, step: VERIFY });
    expect(result.output).toContain('src/cart.js');
  });

  it('review-gate stops when the agent shrank the scope it was given', () => {
    // Without the seal, an empty selection with matching empty evidence gates as clean.
    const result = runRecipe('review-gate.yml', (dir) => {
      const file = path.join(dir, 'scope.json');
      const scope = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, JSON.stringify({ ...scope, selected: [] }));
      agentWriting([])(dir);
    });
    expect(result).toMatchObject({ code: 1, step: VERIFY });
    expect(result.output).toContain('::error title=The review changed its scope::');
    expect(readSummary).toThrow(/ENOENT/);
  });

  it.each([
    ['rewrites the checklist', (dir) => fs.appendFileSync(path.join(dir, 'checklist.md'), '\n')],
    ['adds a file to the review folder', (dir) => fs.writeFileSync(path.join(dir, 'x.json'), '')],
    ['removes a sealed file', (dir) => fs.rmSync(path.join(dir, 'checklist.md'))],
  ])('review-gate stops when the agent %s', (_, tamper) => {
    const result = runRecipe('review-gate.yml', (dir) => {
      agentWriting([])(dir);
      tamper(dir);
    });
    expect(result).toMatchObject({ code: 1, step: VERIFY });
    expect(result.output).toContain('::error title=The review changed its scope::');
  });

  it('review-gate stops when the agent wrote an ignored file outside the review folder', () => {
    fs.mkdirSync(path.join(repo, '.git/info'), { recursive: true });
    fs.appendFileSync(path.join(repo, '.git/info/exclude'), 'build/\n');
    const result = runRecipe('review-gate.yml', (dir) => {
      agentWriting([])(dir);
      write('build/payload.js', 'module.exports = 1;\n');
    });
    expect(result).toMatchObject({ code: 1, step: VERIFY });
    expect(result.output).toContain('build/');
  });

  it('review-gate fork job fails and tells the maintainer what to do', () => {
    const [step] = load('review-gate.yml').doc.jobs.fork.steps;
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run], {
      cwd: temp,
      env: { ...process.env, GITHUB_STEP_SUMMARY: summary },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Review not run::');
    expect(readSummary()).toContain('### BMAD+ review: not run');
  });

  it('review-agent.sh hands its prompt to the host and requires both files', () => {
    // A stand-in for the Codex CLI: records its arguments and prompt, writes files on request.
    fs.writeFileSync(
      path.join(bin, 'codex'),
      [
        '#!/bin/sh',
        'printf "%s\\n" "$@" > "$RUNNER_TEMP/codex-args.txt"',
        'cat > "$RUNNER_TEMP/codex-prompt.txt"',
        'if [ -n "$WRITE" ]; then',
        '  echo "{}" > _bmad-output/review/pr-7/findings.json',
        '  echo "{}" > _bmad-output/review/pr-7/coverage.json',
        'fi',
        '',
      ].join('\n'),
      { mode: 0o755 }
    );
    const agent = (id, extra = {}) =>
      spawnSync('bash', [path.join(DIR, 'review-agent.sh'), id], {
        cwd: repo,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          RUNNER_TEMP: runnerTemp,
          ...extra,
        },
        encoding: 'utf8',
      });
    expect(agent('pr-7')).toMatchObject({ status: 2, stderr: expect.stringContaining('no scope') });
    const scope = spawnSync(path.join(bin, 'bmad-plus'), ['review', 'scope', 'pr-7'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(scope.status).toBe(0);

    const silent = agent('pr-7');
    expect(silent.status).toBe(1);
    expect(silent.stderr).toContain('did not write _bmad-output/review/pr-7/findings.json');
    const args = fs.readFileSync(path.join(runnerTemp, 'codex-args.txt'), 'utf8').split('\n');
    expect(args.slice(0, 4)).toEqual(['-a', 'never', 'exec', '--json']);
    expect(args).toEqual(expect.arrayContaining(['--sandbox', 'workspace-write', '-']));
    const prompt = fs.readFileSync(path.join(runnerTemp, 'codex-prompt.txt'), 'utf8');
    expect(prompt).toContain('_bmad-output/review/pr-7/scope.json lists the files to review');
    expect(prompt).toContain('Write _bmad-output/review/pr-7/coverage.json');

    expect(agent('pr-7', { WRITE: '1' }).status).toBe(0);
  });
});
