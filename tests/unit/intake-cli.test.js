/** The intake command through a real separate process: exit codes and files are the contract. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawnTimeout, removeTree } = require('../helpers/process-budget');

jest.setTimeout(spawnTimeout(16));

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;

const INTAKE = `schema_version: 1
id: shop-brief
pack: shop
title: Shop brief
language: user
max_per_message: 2
sections:
  - id: offer
    title: What is sold
    questions:
      - id: product_kind
        ask: What does the shop sell?
        kind: text
        must_have: true
        feeds: [brief.md#offer]
        risk_if_unknown: Pages written for a product nobody described.
      - id: price_band
        ask: Where do prices sit?
        kind: choice
        choices: [budget, mid, premium]
        default: mid
      - id: launch_in_days
        ask: In how many days?
        kind: number
        min: 1
        max: 365
      - id: markets
        ask: Which countries?
        kind: list
        must_have: true
        risk_if_unknown: Taxes and currencies cannot be chosen.
`;

function write(file, content) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function run(args, { json = true } = {}) {
  const child = spawnSync(
    process.execPath,
    [cli, 'intake', ...args, '--directory', project, ...(json ? ['--json'] : [])],
    { encoding: 'utf8', timeout: 20000, windowsHide: true }
  );
  expect(child.error).toBeUndefined();
  return {
    code: child.status,
    value: json && child.stdout.trim() ? JSON.parse(child.stdout) : child.stdout,
    stderr: child.stderr,
  };
}

const files = ['--intake', 'pack/intake.yaml', '--answers', 'out/answers.json'];

beforeEach(() => {
  project = fs.mkdtempSync(path.join(tempParent, 'bmad-intake-cli-é space-'));
  write('pack/intake.yaml', INTAKE);
});

afterEach(() => removeTree(project, { force: true }));

test('check validates an intake file and reports every problem of a bad one', () => {
  const valid = run(['check', 'pack/intake.yaml']);
  expect(valid.code).toBe(0);
  expect(valid.value).toMatchObject({
    schemaVersion: 1,
    status: 'valid',
    id: 'shop-brief',
    pack: 'shop',
    questions: 4,
    mustHave: 2,
  });
  write(
    'pack/bad.yaml',
    INTAKE.replace('must_have: true\n        feeds', 'must_have: yes\n        feeds')
  );
  const invalid = run(['check', 'pack/bad.yaml']);
  expect(invalid.code).toBe(1);
  expect(invalid.value.status).toBe('invalid');
  expect(invalid.value.problems.join('\n')).toMatch(/must_have/);
  const plain = run(['check', 'pack/intake.yaml'], { json: false });
  expect(plain.code).toBe(0);
  expect(plain.value).toContain('valid intake shop-brief (shop), 4 questions, 2 must-have');
});

test('plan, record and render walk the protocol with the right exit codes', () => {
  const first = run(['plan', ...files]);
  expect(first.code).toBe(2);
  expect(first.value.status).toBe('needs-answers');
  expect(first.value.next.map((q) => q.id)).toEqual(['product_kind', 'markets']);
  expect(fs.existsSync(path.join(project, 'out/answers.json'))).toBe(false);

  const recorded = run([
    'record',
    ...files,
    '--set',
    'product_kind=Soy candles',
    '--set',
    'markets=UNKNOWN',
    '--default',
    'price_band',
  ]);
  expect(recorded.code).toBe(0);
  expect(recorded.value).toMatchObject({
    status: 'recorded',
    recorded: ['product_kind', 'markets', 'price_band'],
    ready: true,
    unknowns: [{ id: 'markets', mustHave: true, risk: 'Taxes and currencies cannot be chosen.' }],
  });
  const stored = JSON.parse(fs.readFileSync(path.join(project, 'out/answers.json'), 'utf8'));
  expect(stored).toEqual({
    schemaVersion: 1,
    intake: 'shop-brief',
    answers: {
      product_kind: { value: 'Soy candles', status: 'answered' },
      markets: { status: 'unknown', risk: 'Taxes and currencies cannot be chosen.' },
      price_band: { value: 'mid', status: 'defaulted' },
    },
  });
  expect(fs.readdirSync(path.join(project, 'out'))).toEqual(['answers.json']);

  const ready = run(['plan', ...files]);
  expect(ready.code).toBe(0);
  expect(ready.value.status).toBe('ready');
  expect(ready.value.next.map((q) => q.id)).toEqual(['launch_in_days']);

  const rendered = run(['render', ...files, '--out', 'out/brief.md']);
  expect(rendered.code).toBe(0);
  expect(rendered.value).toMatchObject({ status: 'rendered', out: 'out/brief.md', ready: true });
  const brief = fs.readFileSync(path.join(project, 'out/brief.md'), 'utf8');
  expect(brief.startsWith('# Shop brief\n<!-- owned by bmad-plus intake shop-brief;')).toBe(true);
  expect(brief).toContain('Answer:\n    Soy candles\n');
  expect(brief).toContain('Answer (proposed default, not confirmed by the user):\n    mid\n');
  expect(brief).toContain(
    '- markets (must-have): unknown — risk: Taxes and currencies cannot be chosen.'
  );
  expect(brief).toContain('- launch_in_days: not asked yet');
});

test('a value the question cannot hold is refused and the answers file is left as it was', () => {
  const ok = run(['record', ...files, '--set', 'launch_in_days=30']);
  expect(ok.code).toBe(0);
  const before = fs.readFileSync(path.join(project, 'out/answers.json'), 'utf8');
  const refused = run([
    'record',
    ...files,
    '--set',
    'launch_in_days=400',
    '--set',
    'product_kind=x',
  ]);
  expect(refused.code).toBe(1);
  expect(refused.value).toMatchObject({ status: 'error' });
  expect(refused.value.error).toMatch(/launch_in_days: value must be at most 365/);
  expect(fs.readFileSync(path.join(project, 'out/answers.json'), 'utf8')).toBe(before);
  const malformed = run(['record', ...files, '--set', 'nothing']);
  expect(malformed.code).toBe(1);
  expect(malformed.value.error).toMatch(/--set expects id=VALUE/);
  const empty = run(['record', ...files]);
  expect(empty.code).toBe(1);
  expect(empty.value.error).toMatch(/nothing to record/);
});

test('files outside the project, missing options and unknown actions are refused', () => {
  const outside = run(['check', path.join(tempParent, 'elsewhere.yaml')]);
  expect(outside.code).toBe(1);
  expect(outside.value.error).toMatch(/outside the project directory/);
  const missing = run(['plan', '--intake', 'pack/intake.yaml']);
  expect(missing.code).toBe(1);
  expect(missing.value.error).toMatch(/--answers is required/);
  const unknown = run(['guess', ...files], { json: false });
  expect(unknown.code).toBe(1);
  expect(unknown.stderr).toContain('Intake: Use intake check FILE, plan, record or render.');
});

test('render and record overwrite only files they own, never a reserved tree', () => {
  run(['record', ...files, '--set', 'product_kind=Soy candles', '--set', 'markets=UNKNOWN']);
  const intakeBefore = fs.readFileSync(path.join(project, 'pack/intake.yaml'), 'utf8');
  const overIntake = run(['render', ...files, '--out', 'pack/intake.yaml']);
  expect(overIntake.code).toBe(1);
  expect(overIntake.value.error).toMatch(
    /pack\/intake.yaml: exists and is not a brief of intake "shop-brief"/
  );
  expect(fs.readFileSync(path.join(project, 'pack/intake.yaml'), 'utf8')).toBe(intakeBefore);

  write('notes/plan.md', '# My plan\n\nKeep this.\n');
  const overNotes = run(['render', ...files, '--out', 'notes/plan.md']);
  expect(overNotes.code).toBe(1);
  expect(fs.readFileSync(path.join(project, 'notes/plan.md'), 'utf8')).toBe(
    '# My plan\n\nKeep this.\n'
  );

  for (const target of [
    '.git/config',
    '_bmad/brief.md',
    '.bmad-plus/x.md',
    'node_modules/a/b.md',
    'docs/.git/hooks',
  ]) {
    const refused = run(['render', ...files, '--out', target]);
    expect(refused.code).toBe(1);
    expect(refused.value.error).toMatch(
      /the intake never writes under (\.git|_bmad|\.bmad-plus|node_modules)\//
    );
    expect(fs.existsSync(path.join(project, target))).toBe(false);
  }
  const answersReserved = run([
    'record',
    '--intake',
    'pack/intake.yaml',
    '--answers',
    '.git/answers.json',
    '--set',
    'product_kind=x',
  ]);
  expect(answersReserved.code).toBe(1);
  expect(fs.existsSync(path.join(project, '.git'))).toBe(false);

  const first = run(['render', ...files, '--out', 'out/brief.md']);
  expect(first.code).toBe(0);
  run(['record', ...files, '--set', 'launch_in_days=12']);
  const again = run(['render', ...files, '--out', 'out/brief.md']);
  expect(again.code).toBe(0);
  expect(fs.readFileSync(path.join(project, 'out/brief.md'), 'utf8')).toContain(
    'Answer:\n    12\n'
  );

  write(
    'out/other.json',
    JSON.stringify({ schemaVersion: 1, intake: 'other-intake', answers: {} })
  );
  const foreign = run([
    'record',
    '--intake',
    'pack/intake.yaml',
    '--answers',
    'out/other.json',
    '--set',
    'product_kind=x',
  ]);
  expect(foreign.code).toBe(1);
  expect(foreign.value.error).toMatch(
    /out\/other.json: exists and belongs to "other-intake", not to intake "shop-brief"/
  );
  write('out/text.json', 'not json');
  const notJson = run(['plan', '--intake', 'pack/intake.yaml', '--answers', 'out/text.json']);
  expect(notJson.code).toBe(1);
  expect(notJson.value.error).toMatch(
    /out\/text.json: exists and is not an answers file of intake "shop-brief"/
  );
});

test('record --reset starts the answers again for the same intake only', () => {
  run(['record', ...files, '--set', 'product_kind=Soy candles', '--set', 'launch_in_days=12']);
  const stale = JSON.parse(fs.readFileSync(path.join(project, 'out/answers.json'), 'utf8'));
  stale.answers.launch_in_days = { value: 'twelve', status: 'answered' };
  write('out/answers.json', JSON.stringify(stale));
  const broken = run(['plan', ...files]);
  expect(broken.code).toBe(1);
  expect(broken.value.error).toMatch(/does not answer this intake[\s\S]*--reset/);
  const reset = run(['record', ...files, '--reset', '--set', 'markets=UNKNOWN']);
  expect(reset.code).toBe(0);
  expect(reset.value).toMatchObject({ status: 'recorded', reset: true, recorded: ['markets'] });
  expect(JSON.parse(fs.readFileSync(path.join(project, 'out/answers.json'), 'utf8'))).toEqual({
    schemaVersion: 1,
    intake: 'shop-brief',
    answers: { markets: { status: 'unknown', risk: 'Taxes and currencies cannot be chosen.' } },
  });
  const empty = run(['record', ...files, '--reset'], { json: false });
  expect(empty.code).toBe(0);
  expect(empty.value).toContain('Reset out/answers.json.');
  expect(
    JSON.parse(fs.readFileSync(path.join(project, 'out/answers.json'), 'utf8')).answers
  ).toEqual({});
  write(
    'out/other.json',
    JSON.stringify({ schemaVersion: 1, intake: 'other-intake', answers: {} })
  );
  const foreign = run([
    'record',
    '--intake',
    'pack/intake.yaml',
    '--answers',
    'out/other.json',
    '--reset',
  ]);
  expect(foreign.code).toBe(1);
  expect(foreign.value.error).toMatch(/belongs to "other-intake"/);
  expect(JSON.parse(fs.readFileSync(path.join(project, 'out/other.json'), 'utf8')).intake).toBe(
    'other-intake'
  );
});

test('traversal and symlinked paths are refused before anything is written', () => {
  const traversal = run(['render', ...files, '--out', '../x.md']);
  expect(traversal.code).toBe(1);
  expect(traversal.value.error).toMatch(/\.\.\/x\.md: outside the project directory/);
  expect(fs.existsSync(path.join(path.dirname(project), 'x.md'))).toBe(false);
  const intakeTraversal = run([
    'plan',
    '--intake',
    'pack/../../intake.yaml',
    '--answers',
    'out/answers.json',
  ]);
  expect(intakeTraversal.code).toBe(1);
  expect(intakeTraversal.value.error).toMatch(/outside the project directory/);

  let linked = true;
  const outside = fs.mkdtempSync(path.join(tempParent, 'bmad-intake-outside-'));
  fs.mkdirSync(path.join(project, 'out'));
  try {
    try {
      fs.symlinkSync(outside, path.join(project, 'linked'), 'junction');
      fs.writeFileSync(
        path.join(outside, 'answers.json'),
        JSON.stringify({ schemaVersion: 1, intake: 'shop-brief', answers: {} })
      );
      fs.symlinkSync(
        path.join(outside, 'answers.json'),
        path.join(project, 'out', 'linked-answers.json'),
        'file'
      );
    } catch {
      linked = false;
    }
    if (linked) {
      const viaDir = run(['render', ...files, '--out', 'linked/brief.md']);
      expect(viaDir.code).toBe(1);
      expect(viaDir.value.error).toMatch(/symlink or junction/);
      expect(fs.existsSync(path.join(outside, 'brief.md'))).toBe(false);
      const viaFile = run([
        'record',
        '--intake',
        'pack/intake.yaml',
        '--answers',
        'out/linked-answers.json',
        '--set',
        'product_kind=x',
      ]);
      expect(viaFile.code).toBe(1);
      expect(viaFile.value.error).toMatch(/symlink or junction/);
      expect(
        JSON.parse(fs.readFileSync(path.join(outside, 'answers.json'), 'utf8')).answers
      ).toEqual({});
    }
  } finally {
    removeTree(outside, { force: true });
  }
});
