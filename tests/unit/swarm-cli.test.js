/** The swarm command end to end in separate processes, and a plan Nexus accepts and verifies. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawnTimeout, removeTree } = require('../helpers/process-budget');

// The longest case runs thirteen CLI processes.
jest.setTimeout(spawnTimeout(13));

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const FIXTURES = path.resolve(__dirname, '../fixtures/swarm');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;

function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  return target;
}

function run(command, args, { json = true } = {}) {
  const child = spawnSync(
    process.execPath,
    [cli, command, ...args, '--directory', project, ...(json ? ['--json'] : [])],
    { encoding: 'utf8', timeout: 20000, windowsHide: true }
  );
  expect(child.error).toBeUndefined();
  return {
    code: child.status,
    value: json ? JSON.parse(child.stdout) : child.stdout,
    stderr: child.stderr,
  };
}

const swarm = (...args) => run('swarm', args);

beforeEach(() => {
  project = fs.mkdtempSync(path.join(tempParent, 'bmad-swarm-cli-é space-'));
  fs.cpSync(FIXTURES, path.join(project, 'swarm'), { recursive: true });
  write('_bmad/config.yaml', 'user_name: "laurent"\nswarm:\n  budget: 4\n  wave: 2\n');
});

afterEach(() => {
  removeTree(project);
});

test('init, briefs, check, save and tally run a panel end to end', () => {
  const refused = swarm(
    'init',
    '--definition',
    'swarm/buyer-panel.json',
    '--profile',
    'swarm/profile.json',
    '--context',
    'pitch=swarm/pitch.md',
    '--n',
    '5',
    '--seed',
    '3'
  );
  expect(refused.code).toBe(2);
  expect(refused.value).toMatchObject({
    schemaVersion: 1,
    status: 'needs-approval',
    n: 5,
    budget: 4,
    seed: 3,
  });
  const approved = swarm(
    'init',
    '--definition',
    'swarm/buyer-panel.json',
    '--profile',
    'swarm/profile.json',
    '--context',
    'pitch=swarm/pitch.md',
    '--n',
    '5',
    '--seed',
    '3',
    '--approved'
  );
  expect(approved.code).toBe(0);
  expect(approved.value).toMatchObject({ status: 'ready', approval: 'user', n: 5, seed: 3 });
  const cardsOf = (id) =>
    fs.readFileSync(path.join(project, '.bmad-plus/swarm/runs', id, 'cards.json'), 'utf8');
  expect(cardsOf(approved.value.run)).toBe(cardsOf(refused.value.run));

  const init = swarm(
    'init',
    '--definition',
    'swarm/buyer-panel.json',
    '--profile',
    'swarm/profile.json',
    '--context',
    'pitch=swarm/pitch.md',
    '--n',
    '3',
    '--seed',
    '3'
  );
  expect(init.code).toBe(0);
  expect(init.value).toMatchObject({
    status: 'ready',
    approval: 'not-needed',
    units: ['B001', 'B002', 'B003'],
  });
  const runId = init.value.run;

  const briefs = swarm('briefs', runId);
  expect(briefs.code).toBe(0);
  expect(briefs.value.waves.map((wave) => wave.units.map((unit) => unit.id))).toEqual([
    ['B001', 'B002'],
    ['B003'],
  ]);
  const first = briefs.value.waves[0].units[0];
  expect(fs.readFileSync(first.brief, 'utf8')).toContain('unit B001 of run ' + runId);

  expect(swarm('check', runId).code).toBe(1);
  fs.writeFileSync(
    first.answer,
    JSON.stringify({
      id: 'B001',
      buys: true,
      reason_code: 'habit',
      reason: 'Same street.',
      price_floor: 4,
    })
  );
  fs.writeFileSync(briefs.value.waves[0].units[1].answer, '{"id": "B002", "buys": "maybe"}');
  const incomplete = swarm('check', runId);
  expect(incomplete.code).toBe(1);
  expect(incomplete.value.pending.map((unit) => [unit.id, unit.state])).toEqual([
    ['B002', 'invalid'],
    ['B003', 'missing'],
  ]);

  write(
    'swarm/inbox/B003.txt',
    'As B003 I would say:\n{"id": "B003", "buys": false, "reason_code": "price", "reason": "Too steep for a drink."}\n'
  );
  const saved = swarm('save', runId, 'B003', '--input', 'swarm/inbox/B003.txt');
  expect(saved.code).toBe(0);
  expect(saved.value.status).toBe('saved');
  const wrong = swarm('save', runId, 'B002', '--input', 'swarm/inbox/B003.txt');
  expect(wrong.code).toBe(1);
  expect(wrong.value.error).toContain('id is "B003", expected "B002"');

  fs.writeFileSync(
    briefs.value.waves[0].units[1].answer,
    JSON.stringify({ id: 'B002', buys: true, reason_code: 'need', reason: 'Coffee.' })
  );
  expect(swarm('check', runId).code).toBe(0);

  const tally = swarm('tally', runId);
  expect(tally.code).toBe(0);
  expect(tally.value.tally.units).toEqual({ total: 3, valid: 3, skipped: [] });
  expect(tally.value.tally.rate.all).toEqual({ yes: 2, of: 3, rate: 0.6667 });
  expect(fs.readFileSync(tally.value.files.markdown, 'utf8')).toMatch(
    /^> Simulated units are not people\./
  );

  const inspect = run('swarm', ['inspect', runId], { json: false });
  expect(inspect.code).toBe(0);
  expect(inspect.value).toContain(runId + ': tallied (panel, within budget)');
  expect(inspect.value).toContain('valid 3');
  expect(swarm('unknown', runId).code).toBe(1);
});

test('a fanout plan round-trips through nexus create and its verifier passes on a valid answer', () => {
  const init = swarm(
    'init',
    '--definition',
    'swarm/page-fanout.json',
    '--units',
    'swarm/units.json'
  );
  expect(init.code).toBe(0);
  const runId = init.value.run;
  const planned = swarm('plan', runId);
  expect(planned.code).toBe(0);
  expect(planned.value).toMatchObject({ status: 'planned', tasks: 3, maxParallel: 2 });

  const created = run('nexus', ['create', '--plan', planned.value.plan]);
  expect(created.code).toBe(0);
  expect(created.value.id).toBe(runId);
  expect(created.value.tasks.map((task) => task.id)).toEqual(['about', 'pricing', 'contact']);

  const backend = { kind: 'host', id: 'swarm-test', sessionId: 'session-1' };
  const started = run('nexus', [
    'start',
    runId,
    'about',
    '--input',
    write('host.json', { backend }),
  ]);
  expect(started.code).toBe(0);
  const attemptId = started.value.tasks[0].attempts.at(-1).id;
  write('site/about/index.md', '# About us\n\nWarm words.\n');
  const answer = '.bmad-plus/swarm/runs/' + runId + '/answers/about.json';
  const record = (identity) =>
    run('nexus', [
      'record',
      runId,
      'about',
      '--input',
      write('result.json', {
        ...identity,
        outcome: 'completed',
        exitCode: 0,
        summary: 'Page written',
      }),
    ]);
  write(answer, { id: 'about', done: 'yes' });
  expect(record({ attemptId, backend }).code).toBe(0);
  const failed = run('nexus', ['verify', runId, 'about']);
  expect(failed.code).toBe(1);
  const refusal = failed.value.tasks[0].attempts.at(-1).verification.checks[0];
  expect(refusal.exitCode).toBe(1);
  expect(refusal.stderr).toContain('field "done" must be true or false');

  const next = { kind: 'host', id: 'swarm-test', sessionId: 'session-2' };
  const retried = run('nexus', [
    'retry',
    runId,
    'about',
    '--input',
    write('host.json', { backend: next }),
  ]);
  expect(retried.code).toBe(0);
  write(answer, { id: 'about', done: true, words: 4 });
  expect(record({ attemptId: retried.value.tasks[0].attempts.at(-1).id, backend: next }).code).toBe(
    0
  );
  const verified = run('nexus', ['verify', runId, 'about']);
  expect(verified.code).toBe(0);
  const attempt = verified.value.tasks[0].attempts.at(-1);
  expect(attempt.verification.status).toBe('passed');
  expect(attempt.verification.checks[0].stdout).toContain('about is valid');
});
