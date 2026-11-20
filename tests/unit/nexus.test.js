const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const nexus = require('../../tools/cli/lib/nexus');
const { SPAWN_BUDGET_MS, spawnTimeout, removeTree } = require('../helpers/process-budget');

// Verification runs real check processes; concurrency cases add operation
// children and git. Budget six processes per case.
jest.setTimeout(spawnTimeout(6, { floor: 15000 }));

const MODULE = require.resolve('../../tools/cli/lib/nexus');
const backend = { kind: 'host', id: 'fixture-worker', sessionId: 'session-one' };
let temporary, project;

function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function read(file) {
  return fs.readFileSync(path.join(project, file), 'utf8');
}
function last(run, taskId = 'task') {
  return run.tasks.find((task) => task.id === taskId).attempts.at(-1);
}
function task(options = {}) {
  return {
    id: 'task',
    objective: 'Produce the required result',
    scope: ['work'],
    artifacts: ['work/result.txt'],
    resources: ['checks/accept.cjs'],
    checks: [
      { id: 'result', command: 'node', args: ['checks/accept.cjs'], cwd: '.', timeoutMs: 2000 },
    ],
    maxAttempts: 2,
    idempotent: true,
    ...options,
  };
}
function create(options = {}) {
  return nexus.createRun(project, { id: 'run', tasks: [task()], ...options });
}
function start() {
  return nexus.startTask(project, 'run', 'task', { backend });
}
function complete(extra = {}) {
  const attempt = last(nexus.inspectRun(project, 'run'));
  return nexus.recordAttempt(project, 'run', 'task', {
    attemptId: attempt.id,
    backend,
    outcome: 'completed',
    exitCode: 0,
    summary: 'The host reports that work is complete.',
    ...extra,
  });
}
function reconcile(extra = {}) {
  const attempt = last(nexus.inspectRun(project, 'run'));
  return nexus.reconcileAttempt(project, 'run', 'task', {
    attemptId: attempt.id,
    backend,
    outcome: 'failed',
    ownerStopped: true,
    summary: 'Inspected the exact stopped host; no operation remains in flight.',
    ...extra,
  });
}
function spawnOperation(operation, args) {
  const child = spawn(
    process.execPath,
    [
      '-e',
      'Promise.resolve(require(process.argv[1])[process.argv[2]](...JSON.parse(process.argv[3]))).then(value => process.stdout.write(JSON.stringify(value))).catch(error => { process.stderr.write(error.message); process.exitCode = 1; });',
      MODULE,
      operation,
      JSON.stringify(args),
    ],
    { windowsHide: true }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const finished = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  return { child, finished };
}
async function waitFor(file) {
  const deadline = Date.now() + 5000 + SPAWN_BUDGET_MS;
  while (!fs.existsSync(path.join(project, file))) {
    if (Date.now() > deadline) throw new Error('Fixture did not reach ' + file);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-nexus-'));
  project = path.join(temporary, 'project with spaces');
  fs.mkdirSync(project);
  write('work/result.txt', 'ready');
  write(
    'checks/accept.cjs',
    "const fs = require('node:fs'); process.exit(fs.readFileSync('work/result.txt', 'utf8') === 'ready' ? 0 : 7);\n"
  );
  write('personal.txt', 'Preserve this unrelated dirty/untracked file.');
});

afterEach(() => {
  jest.restoreAllMocks();
  const actual = fs.realpathSync.native(temporary);
  const tempRoot = fs.realpathSync.native(os.tmpdir());
  if (path.dirname(actual) !== tempRoot || !path.basename(actual).startsWith('bmad-nexus-'))
    throw new Error('Unsafe fixture cleanup');
  removeTree(actual, { force: true });
});

test('case 1: duplicate IDs, dependency cycles and exclusive overlaps fail before a run is written', () => {
  expect(() => create({ tasks: [task(), task()] })).toThrow(/Duplicate task IDs/);
  expect(() =>
    create({
      tasks: [
        task({ dependsOn: ['other'] }),
        task({ id: 'other', dependsOn: ['task'], scope: ['other'], artifacts: ['other/out'] }),
      ],
    })
  ).toThrow(/cycle/);
  expect(() =>
    create({
      tasks: [
        task(),
        task({ id: 'other', scope: ['work/nested'], artifacts: ['work/nested/out'] }),
      ],
    })
  ).toThrow(/Overlapping/);
  expect(() =>
    create({ tasks: [task(), task({ id: 'other', scope: ['WORK'], artifacts: ['WORK/out'] })] })
  ).toThrow(/Overlapping/);
  expect(fs.existsSync(path.join(project, nexus.BASE))).toBe(false);
});

test('case 2: zero worker exit plus failed actual test leaves execution complete and integration rejected', async () => {
  create();
  start();
  write('work/result.txt', 'wrong');
  complete();
  const result = await nexus.verifyTask(project, 'run', 'task');
  expect(last(result)).toMatchObject({
    execution: 'completed',
    verification: { status: 'failed', checks: [{ exitCode: 7, evidenceClass: 'runtime-command' }] },
  });
  expect(result.tasks[0].integration).toBe('rejected');
  expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(/no eligible/);
  expect(read('personal.txt')).toBe('Preserve this unrelated dirty/untracked file.');
});

test('passing current checks, protected inputs and serialized acceptance produce a separate integration receipt', async () => {
  create({ config: { language: 'English' } });
  const initial = start();
  complete();
  expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(/no eligible/);
  const verified = await nexus.verifyTask(project, 'run', 'task');
  expect(verified.tasks[0].integration).toBe('pending');
  expect(last(verified).verification).toMatchObject({
    status: 'passed',
    attemptId: last(initial).id,
    artifactHashes: { 'work/result.txt': expect.stringMatching(/^[a-f0-9]{64}$/) },
    checks: [{ command: process.execPath, args: ['checks/accept.cjs'], exitCode: 0 }],
  });
  const accepted = nexus.acceptTask(project, 'run', 'task');
  expect(accepted.tasks[0]).toMatchObject({
    integration: 'accepted',
    integrationReceipt: { attemptId: last(initial).id, gitOperation: null },
  });
  expect(last(accepted).baseline.config).toEqual({ language: 'English' });
  expect(last(accepted).baseline.framework).toMatchObject({
    version: require('../../package.json').version,
    runtimeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    nodeVersion: process.version,
    platform: process.platform,
  });
  expect(last(accepted).observations[0].independentlyVerified).toBe(false);
  expect(fs.existsSync(path.join(project, '.git'))).toBe(false);
});

test('case 3: passing evidence becomes stale after later edits, including non-artifact scope files', async () => {
  create();
  start();
  complete();
  await nexus.verifyTask(project, 'run', 'task');
  write('work/later.txt', 'A later unchecked implementation change');
  expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(/Stale evidence/);
  const observed = nexus.inspectRun(project, 'run');
  expect(observed.tasks[0].integration).toBe('pending');
  expect(observed.observations[0]).toMatchObject({
    stale: true,
    evidenceEligible: false,
    hint: expect.stringContaining('historical'),
  });
});

test('case 3: a retry cannot reuse earlier attempt results or evidence', async () => {
  create();
  const first = start();
  write('work/result.txt', 'wrong');
  complete();
  await nexus.verifyTask(project, 'run', 'task');
  const retried = nexus.retryTask(project, 'run', 'task', {
    backend: { ...backend, sessionId: 'new-session' },
  });
  expect(last(retried).id).not.toBe(last(first).id);
  expect(last(retried).parentAttemptId).toBe(last(first).id);
  expect(last(retried).verification.status).toBe('pending');
  expect(() =>
    nexus.recordAttempt(project, 'run', 'task', {
      attemptId: last(first).id,
      backend,
      outcome: 'completed',
      summary: 'Late result',
    })
  ).toThrow(/Stale/);
  expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(/no eligible/);
});

test('case 4: restart and lost acknowledgement preserve the existing attempt until explicit reconciliation', () => {
  create();
  const first = start();
  const restarted = nexus.inspectRun(project, 'run');
  expect(last(restarted).id).toBe(last(first).id);
  expect(restarted.observations[0].hint).toMatch(/Reconcile/);
  expect(() => start()).toThrow(/already has an attempt/);
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/reconciled/);
  complete({
    outcome: 'ambiguous',
    summary: 'The host connection was lost before its acknowledgement.',
  });
  expect(() => complete()).toThrow(/reconciliation/);
  expect(() => reconcile({ ownerStopped: false })).toThrow(/ownerStopped/);
  reconcile();
  expect(last(nexus.retryTask(project, 'run', 'task', { backend })).id).not.toBe(last(first).id);
});

test('case 5: a reused terminal/backend handle with a new session cannot acknowledge the old attempt', () => {
  create();
  start();
  expect(() => complete({ backend: { ...backend, sessionId: 'replacement-occupant' } })).toThrow(
    /Backend handle\/session/
  );
  expect(() => reconcile({ backend: { ...backend, id: 'another-worker' } })).toThrow(
    /Backend handle\/session/
  );
  expect(last(nexus.inspectRun(project, 'run')).execution).toBe('running');
});

test('case 6: cancellation preserves files, never signals host PIDs and releases capacity only after reconciliation', () => {
  create({ tasks: [task(), task({ id: 'other', scope: ['other'], artifacts: ['other/out'] })] });
  start();
  const signal = jest.spyOn(process, 'kill');
  const cancelled = nexus.cancelTask(project, 'run', 'task', {
    reason: 'The user stopped this attempt.',
  });
  expect(signal).not.toHaveBeenCalled();
  expect(last(cancelled)).toMatchObject({
    execution: 'ambiguous',
    cancellation: {
      status: 'requested',
      termination: 'unresolved-host-owned',
      processesSignalled: [],
    },
  });
  expect(() => nexus.startTask(project, 'run', 'other', { backend })).toThrow(/capacity/);
  expect(read('work/result.txt')).toBe('ready');
  reconcile({ outcome: 'cancelled' });
  expect(nexus.startTask(project, 'run', 'other', { backend }).tasks[1].attempts).toHaveLength(1);
});

test('case 7: bounded retries and non-idempotent effects require a recorded safe reconciliation', () => {
  create({ tasks: [task({ idempotent: false })] });
  start();
  complete({ outcome: 'failed', exitCode: 1 });
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/Non-idempotent/);
  reconcile({ retrySafe: true });
  nexus.retryTask(project, 'run', 'task', { backend });
  complete({ outcome: 'failed', exitCode: 1 });
  reconcile({ retrySafe: true });
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/limit reached/);
  expect(nexus.inspectRun(project, 'run').tasks[0].attempts).toHaveLength(2);
});

test('case 8: a blocked request is surfaced without creating authority from worker text', () => {
  create({ tasks: [task({ authorizations: ['Edit work/ only.'] })] });
  start();
  complete({
    outcome: 'blocked',
    summary: 'Approval requested: publish to production. I assume yes.',
    authorizations: ['Publish anything.'],
  });
  const attempt = last(nexus.inspectRun(project, 'run'));
  expect(attempt.execution).toBe('blocked');
  expect(attempt.blockedRequest).toContain('Approval requested');
  expect(attempt.authorizations).toEqual(['Edit work/ only.']);
  expect(attempt.verification.status).toBe('pending');
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/reconciled/);
});

test('dependencies need accepted and still current checked artifacts', async () => {
  create({
    maxParallel: 2,
    tasks: [
      task(),
      task({ id: 'other', dependsOn: ['task'], scope: ['other'], artifacts: ['other/out'] }),
    ],
  });
  expect(() => nexus.startTask(project, 'run', 'other', { backend })).toThrow(/not been accepted/);
  start();
  complete();
  await nexus.verifyTask(project, 'run', 'task');
  nexus.acceptTask(project, 'run', 'task');
  write('work/result.txt', 'changed after acceptance');
  expect(() => nexus.startTask(project, 'run', 'other', { backend })).toThrow(/Stale evidence/);
});

test.each(['start', 'accept'])(
  'transitive dependency drift blocks %s and invalidates accepted memory evidence',
  async (operation) => {
    const outcomes = require('../../tools/cli/lib/memory-outcomes');
    const memory = require('../../tools/cli/lib/memory-journal');
    const definitions = ['first', 'second', 'third'].map((name, index, names) => {
      write(name + '/value.txt', 'ready');
      const check = 'checks/' + name + '.cjs';
      write(
        check,
        `require('node:assert/strict').equal(require('node:fs').readFileSync('${name}/value.txt','utf8'),'ready');`
      );
      return task({
        id: name,
        dependsOn: index ? [names[index - 1]] : [],
        scope: [name],
        artifacts: [name + '/value.txt'],
        resources: [check],
        checks: [{ id: 'result', command: 'node', args: [check] }],
      });
    });
    create({ tasks: definitions });
    for (const name of operation === 'accept'
      ? ['first', 'second', 'third']
      : ['first', 'second']) {
      const attempt = last(nexus.startTask(project, 'run', name, { backend }), name);
      nexus.recordAttempt(project, 'run', name, {
        attemptId: attempt.id,
        backend,
        outcome: 'completed',
        summary: 'The controlled dependency fixture completed.',
      });
      await nexus.verifyTask(project, 'run', name);
      if (name !== 'third') nexus.acceptTask(project, 'run', name);
    }
    const source = '.agents/memory/patterns.md';
    write(source, '### Dependent cache lesson\nUse the verified upstream cache values.\n');
    outcomes.observeOutcome(
      project,
      {
        runId: 'run',
        taskId: 'second',
        memory: { file: source, heading: 'Dependent cache lesson' },
        scope: ['second'],
        interpretation: 'Controlled dependency fixture; no causal quality claim.',
      },
      { now: '2026-09-11T12:00:00.000Z' }
    );
    expect(outcomes.inspectOutcomes(project)[0].eligible).toBe(true);
    write('first/value.txt', 'changed after acceptance');
    const observation = nexus
      .inspectRun(project, 'run')
      .observations.find((item) => item.taskId === 'second');
    expect(observation).toMatchObject({ stale: true, evidenceEligible: false });
    expect(outcomes.inspectOutcomes(project)[0].eligible).toBe(false);
    expect(
      memory.recall('cache values', {
        baseDir: project,
        ranking: 'evidence',
        contextScope: ['second'],
      })
    ).toEqual([]);
    expect(() =>
      operation === 'start'
        ? nexus.startTask(project, 'run', 'third', { backend })
        : nexus.acceptTask(project, 'run', 'third')
    ).toThrow(/Stale evidence/);
  },
  30000
);

test('protected verifier mutation after plan creation fails without launching its changed command', async () => {
  create();
  start();
  complete();
  write(
    'checks/accept.cjs',
    "require('node:fs').writeFileSync('forged-check-ran', 'bad'); process.exit(0);"
  );
  await expect(nexus.verifyTask(project, 'run', 'task')).rejects.toThrow(/resource changed/);
  expect(fs.existsSync(path.join(project, 'forged-check-ran'))).toBe(false);
  expect(last(nexus.inspectRun(project, 'run')).verification.status).toBe('pending');
  expect(nexus.inspectRun(project, 'run').observations[0]).toMatchObject({
    resourcesCurrent: false,
    stale: true,
  });
});

test('unprotected scripts and verifiers inside any worker scope are rejected before launch', () => {
  expect(() => create({ tasks: [task({ resources: [] })] })).toThrow(/protected resource/);
  expect(() => create({ tasks: [task({ scope: ['checks', 'work'] })] })).toThrow(
    /Verifier\/resource/
  );
  expect(() =>
    create({
      tasks: [
        task({
          checks: [
            { id: 'absolute', command: 'node', args: [path.join(project, 'checks/accept.cjs')] },
          ],
          resources: [],
        }),
      ],
    })
  ).toThrow(/protected resource/);
});

test('edits after a worker acknowledgement require a new attempt before checks', async () => {
  create();
  start();
  complete();
  write('work/result.txt', 'later change');
  await expect(nexus.verifyTask(project, 'run', 'task')).rejects.toThrow(
    /changed after the worker result/
  );
  expect(() =>
    reconcile({ outcome: 'completed', summary: 'Inspected the host and the current later change.' })
  ).toThrow(/Recorded result changed/);
  reconcile({ outcome: 'failed' });
  nexus.retryTask(project, 'run', 'task', { backend });
  complete();
  expect(last(await nexus.verifyTask(project, 'run', 'task')).verification.status).toBe('failed');
});

test('reconciliation cannot repair failed verification under the same attempt or bypass its retry limit', async () => {
  create({ tasks: [task({ maxAttempts: 1 })] });
  start();
  write('work/result.txt', 'wrong');
  complete();
  await nexus.verifyTask(project, 'run', 'task');
  expect(() => reconcile({ outcome: 'completed' })).toThrow(
    /Failed verification requires a new attempt/
  );
  write('work/result.txt', 'ready');
  expect(() => reconcile({ outcome: 'completed' })).toThrow(
    /Failed verification requires a new attempt/
  );
  reconcile({ outcome: 'failed', retrySafe: true });
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/limit reached/);
  expect(last(nexus.inspectRun(project, 'run')).verification.status).toBe('failed');
});

test('a check modifying the very bytes it claims to validate cannot pass', async () => {
  write(
    'checks/accept.cjs',
    "require('node:fs').writeFileSync('work/result.txt', 'modified by the check'); process.exit(0);"
  );
  create();
  start();
  complete();
  const attempt = last(await nexus.verifyTask(project, 'run', 'task'));
  expect(attempt.verification).toMatchObject({
    status: 'failed',
    problem: 'Checked files changed during verification.',
  });
  expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(/no eligible/);
});

test('a check changing its protected resource cannot pass', async () => {
  write(
    'checks/accept.cjs',
    "require('node:fs').appendFileSync('checks/accept.cjs', '\\n// tampered'); process.exit(0);"
  );
  create();
  start();
  complete();
  const attempt = last(await nexus.verifyTask(project, 'run', 'task'));
  expect(attempt.verification.status).toBe('failed');
  expect(attempt.verification.problem).toMatch(/resource changed/);
});

test('actual verifier timeout is bounded and remains ambiguous until inspected', async () => {
  write('checks/accept.cjs', 'setTimeout(() => {}, 10000);');
  create({
    tasks: [
      task({
        checks: [{ id: 'slow', command: 'node', args: ['checks/accept.cjs'], timeoutMs: 80 }],
      }),
    ],
  });
  start();
  complete();
  const checked = await nexus.verifyTask(project, 'run', 'task');
  expect(last(checked).verification).toMatchObject({
    status: 'ambiguous',
    checks: [{ timedOut: true, termination: expect.stringContaining('direct-child-only') }],
  });
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/reconciled/);
  reconcile({ outcome: 'failed' });
  expect(last(nexus.retryTask(project, 'run', 'task', { backend })).execution).toBe('running');
});

test('interrupted verification rounds retain their receipts and obey the configured bound', async () => {
  write('checks/accept.cjs', 'setTimeout(() => {}, 10000);');
  create({
    tasks: [
      task({
        maxAttempts: 1,
        checks: [{ id: 'slow', command: 'node', args: ['checks/accept.cjs'], timeoutMs: 80 }],
      }),
    ],
  });
  start();
  complete();
  const interrupted = last(await nexus.verifyTask(project, 'run', 'task')).verification;
  reconcile({ outcome: 'completed' });
  const reconciled = last(nexus.inspectRun(project, 'run'));
  expect(reconciled.verificationHistory).toEqual([interrupted]);
  expect(reconciled.reconciliations).toHaveLength(1);
  await expect(nexus.verifyTask(project, 'run', 'task')).rejects.toThrow(/restart limit/);
  expect(last(nexus.inspectRun(project, 'run')).verificationHistory).toEqual([interrupted]);
});

test("concurrent starts cannot duplicate attempts or lose one another's state", async () => {
  create();
  const operations = [
    spawnOperation('startTask', [project, 'run', 'task', { backend }]),
    spawnOperation('startTask', [project, 'run', 'task', { backend }]),
  ];
  const results = await Promise.all(operations.map((operation) => operation.finished));
  expect(results.filter((result) => result.code === 0)).toHaveLength(1);
  expect(results.find((result) => result.code !== 0).stderr).toMatch(
    /already has an attempt|writer.lock/
  );
  expect(nexus.inspectRun(project, 'run').tasks[0].attempts).toHaveLength(1);
});

test('verification releases the writer lock, rejects concurrent checks, and records cancellation without killing host work', async () => {
  write(
    'checks/accept.cjs',
    "require('node:fs').writeFileSync('check-started', 'started'); setTimeout(() => process.exit(0), 350);"
  );
  create();
  start();
  complete();
  const verifying = nexus.verifyTask(project, 'run', 'task');
  await waitFor('check-started');
  expect(nexus.inspectRun(project, 'run').lock).toBeNull();
  await expect(nexus.verifyTask(project, 'run', 'task')).rejects.toThrow(/already exists/);
  expect(() => reconcile({ outcome: 'completed' })).toThrow(/still alive/);
  nexus.cancelTask(project, 'run', 'task', { reason: 'Stop after the current owned verifier.' });
  expect(last(await verifying).verification.status).toBe('ambiguous');
  reconcile({ outcome: 'completed' });
  expect(last(nexus.inspectRun(project, 'run')).cancellation.status).toBe('reconciled');
});

test('a real verifier-process crash retains running state and cannot blindly relaunch on restart', async () => {
  write(
    'checks/accept.cjs',
    "const fs = require('node:fs'); fs.writeFileSync('check-started', String(process.pid)); setTimeout(() => { fs.writeFileSync('check-finished', 'done'); process.exit(0); }, 450);"
  );
  create();
  start();
  complete();
  const launched = spawnOperation('verifyTask', [project, 'run', 'task']);
  await waitFor('check-started');
  launched.child.kill('SIGKILL');
  await launched.finished;
  expect(last(nexus.inspectRun(project, 'run')).verification.status).toBe('running');
  await expect(nexus.verifyTask(project, 'run', 'task')).rejects.toThrow(/already exists/);
  // Inspect the actual child; Windows may terminate it with the owner while
  // another platform lets it finish. Neither outcome is inferred from timeout.
  const checkPid = Number(read('check-started'));
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      process.kill(checkPid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') break;
      throw error;
    }
    if (Date.now() > deadline) throw new Error('Owned fixture check did not stop.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  reconcile({
    outcome: 'completed',
    summary:
      'Inspected the recorded owner and child PIDs; both exact fixture processes have stopped.',
  });
  expect(last(nexus.inspectRun(project, 'run')).verification.status).toBe('pending');
  expect(last(await nexus.verifyTask(project, 'run', 'task')).verification.status).toBe('passed');
});

test('active scope ownership is enforced across runs until cancellation is reconciled', () => {
  create();
  nexus.createRun(project, { id: 'another', tasks: [task()] });
  start();
  expect(() => nexus.startTask(project, 'another', 'task', { backend })).toThrow(/owned by active/);
  nexus.cancelTask(project, 'run', 'task', { reason: 'Cancel the former owner.' });
  expect(() => nexus.startTask(project, 'another', 'task', { backend })).toThrow(/owned by active/);
  reconcile({ outcome: 'cancelled' });
  expect(last(nexus.startTask(project, 'another', 'task', { backend })).execution).toBe('running');
});

test.each([
  '../outside',
  'C:/outside',
  'C:\\outside',
  '//server/share',
  'work\\child',
  'work/../other',
  'nul',
  'work/trailing.',
  'work/alternate:stream',
  '.bmad-plus',
  '.git',
])('unsafe or reserved write scope %s is rejected', (scope) => {
  expect(() =>
    create({ tasks: [task({ scope: [scope], artifacts: [scope + '/file'] })] })
  ).toThrow();
  expect(fs.existsSync(path.join(project, nexus.BASE))).toBe(false);
});

test('file scopes and Windows project paths containing spaces are supported', async () => {
  create({ tasks: [task({ scope: ['work/result.txt'] })] });
  start();
  complete();
  await nexus.verifyTask(project, 'run', 'task');
  expect(nexus.acceptTask(project, 'run', 'task').tasks[0].integration).toBe('accepted');
});

test.each(['work', '.bmad-plus', 'checks'])(
  'junctions or symlinks at %s preserve the external target and refuse work',
  (linked) => {
    const outside = path.join(temporary, 'external');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'keep'), 'outside');
    const target = path.join(project, linked);
    if (fs.existsSync(target))
      fs.renameSync(target, path.join(project, 'original-' + linked.replace('.', '')));
    fs.symlinkSync(outside, target, 'junction');
    expect(() => create()).toThrow(/symlink|junction/);
    expect(fs.readFileSync(path.join(outside, 'keep'), 'utf8')).toBe('outside');
  }
);

test('corrupt/truncated states are preserved and cannot be overwritten by a mutation', () => {
  create();
  const state = nexus.BASE + '/runs/run.json';
  const original = read(state);
  write(state, original.slice(0, -25));
  expect(() => nexus.inspectRun(project, 'run')).toThrow(/Corrupt/);
  expect(() => start()).toThrow(/Corrupt/);
  expect(read(state)).toBe(original.slice(0, -25));
  write(state, original.replace('Produce the required result', 'Forged objective'));
  expect(() => nexus.inspectRun(project, 'run')).toThrow(/Corrupt/);
});

test('an atomic state write failure keeps the prior complete state and removes only its own temporary file', () => {
  create();
  const state = nexus.BASE + '/runs/run.json';
  const before = read(state);
  const original = fs.renameSync;
  jest.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
    if (destination.endsWith(path.join('runs', 'run.json')))
      throw new Error('Injected disk failure');
    return original(source, destination);
  });
  expect(() => start()).toThrow(/disk failure/);
  expect(read(state)).toBe(before);
  expect(fs.readdirSync(path.join(project, nexus.BASE, 'runs'))).toEqual(['run.json']);
  expect(fs.existsSync(path.join(project, nexus.LOCK))).toBe(false);
});

test('foreign project state is rejected even if its checksum remains valid', () => {
  create();
  const elsewhere = path.join(temporary, 'copied-project');
  fs.mkdirSync(elsewhere);
  fs.mkdirSync(path.join(elsewhere, nexus.BASE, 'runs'), { recursive: true });
  fs.copyFileSync(
    path.join(project, nexus.BASE, 'runs/run.json'),
    path.join(elsewhere, nexus.BASE, 'runs/run.json')
  );
  expect(() => nexus.inspectRun(elsewhere, 'run')).toThrow(/foreign/);
});

test('a nested project does not falsely inherit an ancestor repository revision', () => {
  const git = (args) => {
    const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
    return result.stdout.trim();
  };
  git(['init', temporary]);
  git([
    '-C',
    temporary,
    '-c',
    'user.name=Laurent Rochetta',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--allow-empty',
    '-m',
    'Nexus fixture baseline',
  ]);
  create();
  expect(last(start()).baseline.revision).toBeNull();
});

test('declared agent resources are captured and a deadline observation never authorizes retry', () => {
  write('.agents/skills/agent-orchestrator/SKILL.md', 'The exact host instruction fixture.');
  create({
    tasks: [
      task({
        resources: ['checks/accept.cjs', '.agents/skills/agent-orchestrator/SKILL.md'],
        deadlineMs: 100,
      }),
    ],
  });
  const begun = start();
  expect(last(begun).baseline.resourceHashes['.agents/skills/agent-orchestrator/SKILL.md']).toMatch(
    /^[a-f0-9]{64}$/
  );
  const future = Date.now() + 1000;
  jest.spyOn(Date, 'now').mockReturnValue(future);
  expect(nexus.inspectRun(project, 'run').observations[0].overdue).toBe(true);
  expect(() => nexus.retryTask(project, 'run', 'task', { backend })).toThrow(/reconciled/);
  expect(last(nexus.inspectRun(project, 'run')).execution).toBe('running');
});

test('dead/corrupt writer locks require exact observed hashes and leave a recovery receipt', () => {
  create();
  write(nexus.LOCK, '{interrupted');
  const lock = nexus.inspectRun(project, 'run').lock;
  expect(() => start()).toThrow(/writer.lock/);
  expect(() =>
    nexus.recoverLock(project, {
      expectedHash: 'wrong',
      ownerStopped: true,
      note: 'Inspected the crashed CLI.',
    })
  ).toThrow(/Exact lock/);
  const recovery = nexus.recoverLock(project, {
    expectedHash: lock.hash,
    ownerStopped: true,
    note: 'The interrupted writer process has exited; its lock was truncated.',
  });
  expect(recovery.evidenceClass).toBe('operator-observation');
  expect(fs.existsSync(path.join(project, nexus.LOCK))).toBe(false);
  expect(fs.readdirSync(path.join(project, nexus.BASE, 'lock-recovery'))).toHaveLength(1);
  expect(last(start()).execution).toBe('running');
});

test('project inspection exposes a writer crash before the first run save without creating files', () => {
  const before = fs.readdirSync(project).sort();
  expect(nexus.inspectRun(project)).toMatchObject({ runIds: [], lock: null });
  expect(fs.readdirSync(project).sort()).toEqual(before);
  write(nexus.LOCK, '{interrupted-first-create');
  const inventory = nexus.inspectRun(project);
  expect(inventory.runIds).toEqual([]);
  expect(inventory.lock.hash).toMatch(/^[a-f0-9]{64}$/);
  nexus.recoverLock(project, {
    expectedHash: inventory.lock.hash,
    note: 'Inspected the stopped initial writer before any run was saved.',
    ownerStopped: true,
  });
  create();
  expect(nexus.inspectRun(project).runIds).toEqual(['run']);
});

test('a second recovery cannot replace a writer between the first recovery hash check and unlink', () => {
  create();
  write(nexus.LOCK, '{stopped-writer');
  const expectedHash = nexus.inspectRun(project).lock.hash;
  const observation = {
    expectedHash,
    ownerStopped: true,
    note: 'Observed the exact stopped writer.',
  };
  const originalRead = fs.readFileSync;
  const writer = path.join(project, nexus.LOCK);
  let writerReads = 0;
  let intervened = false;
  jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
    const bytes = originalRead(file, ...args);
    if (file === writer && ++writerReads === 2) {
      // This is the last comparison before unlink. A concurrent recovery must
      // not remove the old lock and let a fresh owner replace it in this gap.
      try {
        nexus.recoverLock(project, observation);
        intervened = true;
        fs.writeFileSync(
          writer,
          JSON.stringify({ token: 'fresh-owner', pid: process.pid, hostname: os.hostname() })
        );
      } catch (error) {
        expect(error.message).toMatch(/recovery.lock/);
      }
      expect(() => start()).toThrow(/recovery is active/);
    }
    return bytes;
  });
  nexus.recoverLock(project, observation);
  expect(intervened).toBe(false);
  expect(fs.existsSync(writer)).toBe(false);
  expect(fs.existsSync(path.join(project, nexus.RECOVERY_LOCK))).toBe(false);
});

test('recovery cleanup never unlinks a replacement writer installed after the old lock removal', () => {
  create();
  write(nexus.LOCK, '{stopped-writer');
  const expectedHash = nexus.inspectRun(project).lock.hash;
  const originalUnlink = fs.unlinkSync;
  const writer = path.join(project, nexus.LOCK);
  const replacement = JSON.stringify({
    token: 'replacement-owner',
    pid: process.pid,
    hostname: os.hostname(),
  });
  jest.spyOn(fs, 'unlinkSync').mockImplementation((file) => {
    originalUnlink(file);
    if (file === writer) fs.writeFileSync(writer, replacement);
  });
  nexus.recoverLock(project, {
    expectedHash,
    ownerStopped: true,
    note: 'Stopped owner inspected.',
  });
  expect(read(nexus.LOCK)).toBe(replacement);
  expect(fs.existsSync(path.join(project, nexus.RECOVERY_LOCK))).toBe(false);
});

test('real concurrent recovery processes serialize and never both claim the same lock', async () => {
  create();
  write(nexus.LOCK, '{stopped-writer');
  const expectedHash = nexus.inspectRun(project).lock.hash;
  const input = { expectedHash, ownerStopped: true, note: 'Inspected the stopped fixture writer.' };
  const results = await Promise.all([
    spawnOperation('recoverLock', [project, input]).finished,
    spawnOperation('recoverLock', [project, input]).finished,
  ]);
  expect(results.filter((result) => result.code === 0)).toHaveLength(1);
  expect(results.find((result) => result.code !== 0).stderr).toMatch(
    /recovery.lock|Exact lock hash/
  );
  expect(nexus.inspectRun(project)).toMatchObject({ lock: null, recoveryLock: null });
});

test('an interrupted exceptional recovery stays inspectable and blocks writers without automatic removal', () => {
  create();
  write(nexus.RECOVERY_LOCK, '{interrupted-recovery');
  const before = read(nexus.RECOVERY_LOCK);
  expect(nexus.inspectRun(project).recoveryLock).toMatchObject({
    hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    owner: null,
  });
  expect(() => start()).toThrow(/recovery is active/);
  expect(() =>
    nexus.recoverLock(project, {
      expectedHash: 'unknown',
      ownerStopped: true,
      note: 'Another recovery already owns the marker.',
    })
  ).toThrow(/recovery.lock/);
  expect(read(nexus.RECOVERY_LOCK)).toBe(before);
});

test('a live writer process cannot be cleared using an operator assertion', () => {
  create();
  write(nexus.LOCK, JSON.stringify({ token: 'live', hostname: os.hostname(), pid: process.pid }));
  const lock = nexus.inspectRun(project, 'run').lock;
  expect(() =>
    nexus.recoverLock(project, {
      expectedHash: lock.hash,
      ownerStopped: true,
      note: 'Attempted stale-lock recovery.',
    })
  ).toThrow(/still alive/);
  expect(fs.existsSync(path.join(project, nexus.LOCK))).toBe(true);
});

test('secret-bearing configuration is refused and check output is bounded with a receipt hash', async () => {
  expect(() => create({ config: { apiKey: 'do-not-store' } })).toThrow(/non-secret/);
  write('checks/accept.cjs', "process.stdout.write('x'.repeat(100000));");
  create();
  start();
  complete();
  const receipt = last(await nexus.verifyTask(project, 'run', 'task')).verification.checks[0];
  expect(Buffer.byteLength(receipt.stdout)).toBe(65536);
  expect(receipt.outputTruncated).toBe(true);
  expect(receipt.outputHash).toMatch(/^[a-f0-9]{64}$/);
});

test.each(['NODE_OPTIONS', 'node_options'])(
  'a real preload in %s cannot skip the protected checker and falsely accept wrong artifacts',
  async (variable) => {
    write(
      'checks/skip.cjs',
      "require('node:fs').writeFileSync('preload-ran', 'injected'); process.exit(0);"
    );
    write('work/result.txt', 'wrong');
    const options =
      '--require ' +
      JSON.stringify(path.join(project, 'checks/skip.cjs').split(path.sep).join('/'));
    const reproduced = spawnSync(process.execPath, ['checks/accept.cjs'], {
      cwd: project,
      env: { ...process.env, NODE_OPTIONS: options },
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(reproduced.status).toBe(0);
    expect(read('preload-ran')).toBe('injected');
    fs.unlinkSync(path.join(project, 'preload-ran'));
    create();
    start();
    complete();
    const previous = process.env[variable];
    process.env[variable] = options;
    let checked;
    try {
      checked = await nexus.verifyTask(project, 'run', 'task');
    } finally {
      if (previous === undefined) delete process.env[variable];
      else process.env[variable] = previous;
    }
    expect(last(checked).verification).toMatchObject({
      status: 'failed',
      checks: [{ exitCode: 7 }],
    });
    expect(last(checked).verification.environment.policy).toBe('minimal-local-v1');
    expect(
      Object.keys(last(checked).verification.environment.values).some(
        (key) => key.toUpperCase() === 'NODE_OPTIONS'
      )
    ).toBe(false);
    expect(fs.existsSync(path.join(project, 'preload-ran'))).toBe(false);
    expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(/no eligible/);
  }
);

test('verification records its restricted effective environment and omits interpreter hooks and credentials', async () => {
  const overrides = {
    NODE_PATH: '/untrusted/modules',
    NODE_V8_COVERAGE: '/untrusted/coverage',
    PYTHONHOME: '/untrusted/python',
    PYTHONPATH: '/untrusted/modules',
    PYTHONSTARTUP: '/untrusted/startup.py',
    PYTHONUSERBASE: '/untrusted/user-site',
    PYTHONINSPECT: '1',
    RUBYOPT: '-runtrusted',
    JAVA_TOOL_OPTIONS: '-agentlib:untrusted',
    DOTNET_STARTUP_HOOKS: '/untrusted/startup.dll',
    NEXUS_TEST_SECRET: 'sensitive-fixture-value',
  };
  write('checks/accept.cjs', 'process.stdout.write(JSON.stringify(process.env));');
  create();
  start();
  complete();
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  let checked;
  try {
    checked = await nexus.verifyTask(project, 'run', 'task');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const verification = last(checked).verification;
  expect(verification.status).toBe('passed');
  const effective = JSON.parse(verification.checks[0].stdout);
  for (const key of Object.keys(overrides).filter((key) => key !== 'NODE_V8_COVERAGE'))
    expect(Object.keys(effective).some((actual) => actual.toUpperCase() === key)).toBe(false);
  expect(effective).toMatchObject({
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    PYTHONNOUSERSITE: '1',
    PYTHONSAFEPATH: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    NODE_V8_COVERAGE: '',
  });
  expect(verification.environment.values).toEqual(effective);
  expect(verification.checks[0].environment).toEqual(verification.environment);
  expect(verification.environment.sha256).toBe(
    crypto
      .createHash('sha256')
      .update(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(effective).sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0
            )
          )
        )
      )
      .digest('hex')
  );
  expect(JSON.stringify(checked)).not.toContain('sensitive-fixture-value');
});

test('older passed receipts without a restricted execution environment cannot satisfy acceptance', async () => {
  create();
  start();
  complete();
  await nexus.verifyTask(project, 'run', 'task');
  const state = nexus.BASE + '/runs/run.json';
  const envelope = JSON.parse(read(state));
  const verification = last(envelope.run).verification;
  delete verification.environment;
  for (const receipt of verification.checks) delete receipt.environment;
  // Reproduce the previously emitted envelope format, whose checksum was valid
  // but whose inherited environment did not establish actual checker execution.
  envelope.sha256 = crypto.createHash('sha256').update(JSON.stringify(envelope.run)).digest('hex');
  write(state, JSON.stringify(envelope));
  expect(() => nexus.acceptTask(project, 'run', 'task')).toThrow(
    /environment is missing or obsolete/
  );
  expect(nexus.inspectRun(project, 'run').observations[0]).toMatchObject({
    stale: true,
    evidenceEligible: false,
  });
});
