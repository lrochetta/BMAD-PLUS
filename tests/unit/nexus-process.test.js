/** Real foreground process ownership, with independent CLI observers and verifiers. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const nexus = require('../../tools/cli/lib/nexus');
const { interpretOutput, runOwnedProcess } = require('../../tools/cli/lib/nexus-process');

const { SPAWN_BUDGET_MS, spawnTimeout, removeTree } = require('../helpers/process-budget');

// Worker, verifier, observer CLIs and descendants: budget ten processes per case.
jest.setTimeout(spawnTimeout(10, { floor: 25000 }));
const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;
let children;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const current = (run) => run.tasks[0].attempts.at(-1);
const identity = (run) => ({ attemptId: current(run).id, backend: current(run).backend });
function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  return target;
}
function plan(input = {}, options = {}) {
  write('inputs/task.json', input);
  return {
    id: 'process-test',
    tasks: [
      {
        id: 'work',
        objective: 'Write a verified value using the protected worker.',
        scope: ['work'],
        artifacts: ['work/value.json'],
        resources: ['checks/value.cjs'],
        checks: [{ id: 'value', command: 'node', args: ['checks/value.cjs'] }],
        idempotent: true,
        maxAttempts: 2,
        deadlineMs: 10000,
        execution: {
          adapter: 'command',
          command: 'node',
          args: ['workers/worker.cjs'],
          resources: ['workers/worker.cjs'],
          input: 'inputs/task.json',
          blockedExitCodes: [75],
        },
        ...options,
      },
    ],
  };
}
function cliSync(action, input) {
  const args = [cli, 'nexus', ...action, '--directory', project, '--json'];
  if (input) args.push('--input', write('client-input.json', input));
  const child = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });
  expect(child.error).toBeUndefined();
  return { code: child.status, value: JSON.parse(child.stdout), stderr: child.stderr };
}
function launchCli() {
  const child = spawn(
    process.execPath,
    [cli, 'nexus', 'launch', 'process-test', 'work', '--directory', project, '--json'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  children.push(child);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (bytes) => {
    stdout += bytes;
  });
  child.stderr.on('data', (bytes) => {
    stderr += bytes;
  });
  const finished = new Promise((resolve) =>
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  );
  return { child, finished };
}
// Waiting for a real child to reach a state costs at least one process start-up.
async function waitUntil(check, timeout = 7000 + SPAWN_BUDGET_MS) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await delay(30);
  }
  throw new Error('Timed out waiting for real process state.');
}
async function whenWriterAvailable(operation) {
  const result = await waitUntil(() => {
    try {
      return { value: operation() };
    } catch (error) {
      if (
        error.message ===
        'Nexus: Another mutation owns writer.lock; inspect before explicit recovery.'
      )
        return false;
      return { error };
    }
  });
  if (result.error) throw result.error;
  return result.value;
}
async function waitReady() {
  await waitUntil(() => fs.existsSync(path.join(project, 'work/ready')));
  return nexus.inspectRun(project, 'process-test');
}
function pidAbsent(pid) {
  if (!Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

beforeEach(() => {
  children = [];
  project = fs.mkdtempSync(path.join(tempParent, 'nexus-process-é space-'));
  write('work/value.json', { value: 0 });
  write(
    'checks/value.cjs',
    `const fs=require('node:fs');const assert=require('node:assert/strict');
assert.equal(JSON.parse(fs.readFileSync('work/value.json')).value,7);`
  );
  write(
    'workers/worker.cjs',
    `const fs=require('node:fs');const {spawn}=require('node:child_process');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
fs.writeFileSync('work/ready','ready');
if(input.descendant){const child=spawn(process.execPath,['-e',"setTimeout(()=>require('node:fs').writeFileSync('work/descendant-finished','done'),700)"],{stdio:'inherit',windowsHide:true});fs.writeFileSync('work/descendant.json',JSON.stringify({pid:child.pid}));}
if(input.blocked){console.error('Approval required by the fixture contract.');process.exit(75);}
if(input.noisy){process.stdout.write(Buffer.alloc(3*1024*1024,65));setTimeout(()=>{},1500);}
else setTimeout(()=>{fs.writeFileSync('work/value.json',JSON.stringify({value:input.wrong?0:7}));
fs.writeFileSync('work/environment.json',JSON.stringify({nodeOptions:process.env.NODE_OPTIONS??null,nodePath:process.env.NODE_PATH??null,secret:process.env.FIXTURE_SECRET??null}));
console.log(input.message??'fixture complete');},input.delay??0);`
  );
});

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  // Fixtures never create unbounded descendants; let an already cancelled fixture drain.
  if (fs.existsSync(path.join(project, 'work/ready'))) await delay(30);
  const resolved = fs.realpathSync.native(project);
  expect(path.dirname(resolved)).toBe(tempParent);
  expect(path.basename(resolved)).toMatch(/^nexus-process-é space-/);
  removeTree(resolved);
});

test('launch, collect, real verify and acceptance remain separate', async () => {
  nexus.createRun(project, plan());
  const launched = await nexus.launchTask(project, 'process-test', 'work');
  const attempt = current(launched);
  expect(attempt.execution).toBe('running');
  expect(attempt.process.receipt.outcome).toBe('completed');
  expect(attempt.process.receipt.inputSha256).toBe(
    crypto.createHash('sha256').update('{}').digest('hex')
  );
  expect(attempt.process.receipt.environment.credentialValuesRecorded).toBe(false);
  await expect(nexus.verifyTask(project, 'process-test', 'work')).rejects.toThrow();
});

test('independent CLI collection can accept only a fresh real verifier pass', async () => {
  nexus.createRun(project, plan({ delay: 550 }));
  const launched = launchCli();
  const running = await waitReady();
  const otherClient = cliSync(['inspect', 'process-test']);
  expect(otherClient.value.observations[0].process.liveIdentityEstablished).toBe(false);
  expect(current(otherClient.value).backend).toEqual(current(running).backend);
  expect((await launched.finished).code).toBe(0);
  const collected = cliSync(['collect', 'process-test', 'work'], identity(running));
  expect(collected.code).toBe(0);
  expect(current(collected.value).execution).toBe('completed');
  expect(cliSync(['accept', 'process-test', 'work']).code).toBe(1);
  expect(cliSync(['verify', 'process-test', 'work']).code).toBe(0);
  expect(cliSync(['accept', 'process-test', 'work']).code).toBe(0);
  expect(cliSync(['collect', 'process-test', 'work'], identity(running)).code).toBe(1);
});

test('a zero-exit wrong worker fails independent verification and exhausts retries', async () => {
  nexus.createRun(project, plan({ wrong: true }));
  for (const retry of [false, true]) {
    const result = await nexus.launchTask(project, 'process-test', 'work', { retry });
    nexus.collectTask(project, 'process-test', 'work', identity(result));
    const checked = await nexus.verifyTask(project, 'process-test', 'work');
    expect(current(checked).verification.status).toBe('failed');
    expect(() => nexus.acceptTask(project, 'process-test', 'work')).toThrow();
  }
  await expect(nexus.launchTask(project, 'process-test', 'work', { retry: true })).rejects.toThrow(
    'Retry limit'
  );
  expect(nexus.inspectRun(project, 'process-test').tasks[0].attempts).toHaveLength(2);
});

test('real cancellation is bound to an exact attempt and signals only the original child', async () => {
  nexus.createRun(project, plan({ delay: 1600, descendant: true }));
  const launched = launchCli();
  const running = await waitReady();
  await expect(
    whenWriterAvailable(() => nexus.cancelTask(project, 'process-test', 'work', { reason: 'stop' }))
  ).rejects.toThrow('identity');
  await expect(
    whenWriterAvailable(() =>
      nexus.cancelTask(project, 'process-test', 'work', {
        ...identity(running),
        backend: { ...current(running).backend, sessionId: 'replacement' },
        reason: 'stop',
      })
    )
  ).rejects.toThrow('does not own');
  const requested = await whenWriterAvailable(() =>
    nexus.cancelTask(project, 'process-test', 'work', {
      ...identity(running),
      reason: 'Stop the owned fixture.',
    })
  );
  expect(current(requested).cancellation.processesSignalled).toEqual([]);
  const completed = await launched.finished;
  expect(completed.code).toBe(1);
  const stopped = nexus.inspectRun(project, 'process-test');
  expect(current(stopped).process.receipt.outcome).toBe('ambiguous');
  expect(current(stopped).process.receipt.directChildSignalled).toBe(true);
  expect(current(stopped).process.receipt.descendantState).toBe('unobserved');
  await expect(nexus.launchTask(project, 'process-test', 'work', { retry: true })).rejects.toThrow(
    'reconciled'
  );
  await waitUntil(
    () =>
      fs.existsSync(path.join(project, 'work/descendant-finished')) ||
      (fs.existsSync(path.join(project, 'work/descendant.json')) &&
        pidAbsent(JSON.parse(fs.readFileSync(path.join(project, 'work/descendant.json'))).pid))
  );
  nexus.reconcileAttempt(project, 'process-test', 'work', {
    ...identity(stopped),
    ownerStopped: true,
    outcome: 'cancelled',
    retrySafe: true,
    summary:
      'Inspected the bounded descendant: final marker or observed process absence established that the fixture stopped.',
  });
  expect(current(nexus.inspectRun(project, 'process-test')).execution).toBe('cancelled');
});

test('lost supervisor is not relaunched; an explicit stopped-owner observation can reconcile it', async () => {
  nexus.createRun(project, plan({ delay: 900 }));
  const launched = launchCli();
  const running = await waitReady();
  expect(() =>
    nexus.reconcileAttempt(project, 'process-test', 'work', {
      ...identity(running),
      ownerStopped: true,
      outcome: 'completed',
      summary: 'Unsupported claim.',
    })
  ).toThrow('may still be alive');
  launched.child.kill('SIGKILL');
  await launched.finished;
  const observed = nexus.inspectRun(project, 'process-test');
  if (observed.lock)
    nexus.recoverLock(project, {
      expectedHash: observed.lock.hash,
      ownerStopped: true,
      note: 'The test owns and observed the exited launcher handle.',
    });
  await expect(nexus.launchTask(project, 'process-test', 'work')).rejects.toThrow(
    'already has an attempt'
  );
  expect(() => nexus.collectTask(project, 'process-test', 'work', identity(running))).toThrow(
    'not ready'
  );
  await waitUntil(() => pidAbsent(current(running).process.childPid));
  const completed = JSON.parse(fs.readFileSync(path.join(project, 'work/value.json'))).value === 7;
  nexus.reconcileAttempt(project, 'process-test', 'work', {
    ...identity(running),
    ownerStopped: true,
    outcome: completed ? 'completed' : 'failed',
    summary:
      'Observed that the bounded fixture worker stopped, then inspected its actual output after launcher interruption.',
  });
  if (completed)
    expect(
      current(await nexus.verifyTask(project, 'process-test', 'work')).verification.status
    ).toBe('passed');
  else await expect(nexus.verifyTask(project, 'process-test', 'work')).rejects.toThrow();
});

test.each(['starting', 'running'])(
  'a lost %s supervisor cannot reconcile while its recorded direct child may be alive',
  async (status) => {
    nexus.createRun(project, plan());
    await nexus.launchTask(project, 'process-test', 'work');
    const stopped = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true });
    expect(stopped.status).toBe(0);
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    children.push(child);
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    try {
      // Windows may stop a real supervisor's descendants with it. Model the valid
      // missing-receipt crash snapshot explicitly, using an actual live child.
      const file = path.join(project, '.bmad-plus/nexus/runs/process-test.json');
      const envelope = JSON.parse(fs.readFileSync(file));
      const attempt = current(envelope.run);
      attempt.backend.ownerPid = stopped.pid;
      attempt.process.owner = { ...attempt.backend };
      attempt.process.status = status;
      attempt.process.childPid = child.pid;
      delete attempt.process.receipt;
      delete attempt.process.receiptHash;
      envelope.sha256 = crypto
        .createHash('sha256')
        .update(JSON.stringify(envelope.run))
        .digest('hex');
      fs.writeFileSync(file, JSON.stringify(envelope));
      expect(pidAbsent(child.pid)).toBe(false);
      expect(() =>
        nexus.reconcileAttempt(project, 'process-test', 'work', {
          ...identity(envelope.run),
          ownerStopped: true,
          outcome: 'completed',
          summary: 'The supervisor stopped; its direct child remains active.',
        })
      ).toThrow('original child may still be alive');
      expect(pidAbsent(child.pid)).toBe(false);
      expect(nexus.inspectRun(project, 'process-test').sequence).toBe(envelope.run.sequence);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill('SIGKILL');
        await exited;
      }
    }
  }
);

test('deadline and excessive output stop with ambiguous evidence and bounded capture', async () => {
  nexus.createRun(
    project,
    plan(
      { noisy: true },
      {
        execution: {
          adapter: 'command',
          command: 'node',
          args: ['workers/worker.cjs'],
          input: 'inputs/task.json',
          resources: ['workers/worker.cjs'],
          outputLimitBytes: 1024,
        },
      }
    )
  );
  const result = await nexus.launchTask(project, 'process-test', 'work');
  const receipt = current(result).process.receipt;
  expect(receipt.reason).toBe('output-limit');
  expect(receipt.outcome).toBe('ambiguous');
  expect(
    receipt.output.stdout.capturedBytes + receipt.output.stderr.capturedBytes
  ).toBeLessThanOrEqual(1024);
  expect(receipt.output.stdout.complete).toBe(false);
});

test('deadline alone never establishes stopped descendant ownership', async () => {
  nexus.createRun(project, plan({ delay: 1700 }, { deadlineMs: 250 }));
  const result = await nexus.launchTask(project, 'process-test', 'work');
  const receipt = current(result).process.receipt;
  // Resource hashing/lock I/O precedes and follows supervision; measure the
  // owned operation's actual interval rather than machine-wide disk contention.
  expect(Date.parse(receipt.endedAt) - Date.parse(receipt.startedAt)).toBeLessThan(3000);
  expect(receipt.reason).toBe('deadline');
  expect(current(result).execution).toBe('ambiguous');
});

test('declared approval-blocked exits stay blocked and cannot approve or retry themselves', async () => {
  nexus.createRun(project, plan({ blocked: true }));
  const launched = await nexus.launchTask(project, 'process-test', 'work');
  const collected = nexus.collectTask(project, 'process-test', 'work', identity(launched));
  expect(current(collected).execution).toBe('blocked');
  expect(current(collected).blockedRequest).toContain('No approval is inferred');
  await expect(nexus.launchTask(project, 'process-test', 'work', { retry: true })).rejects.toThrow(
    'reconciled'
  );
  await expect(nexus.verifyTask(project, 'process-test', 'work')).rejects.toThrow();
});

test('foreign collection, worker acknowledgement, changed input and changed output are refused', async () => {
  nexus.createRun(project, plan());
  const launched = await nexus.launchTask(project, 'process-test', 'work');
  expect(() =>
    nexus.collectTask(project, 'process-test', 'work', {
      ...identity(launched),
      backend: { ...current(launched).backend, ownerPid: 999999 },
    })
  ).toThrow('does not own');
  expect(() =>
    nexus.recordAttempt(project, 'process-test', 'work', {
      ...identity(launched),
      outcome: 'completed',
      summary: 'Trust me.',
    })
  ).toThrow('owned receipt');
  write('work/value.json', { value: 8 });
  expect(() => nexus.collectTask(project, 'process-test', 'work', identity(launched))).toThrow(
    'changed before collection'
  );
  write('inputs/task.json', { changed: true });
  expect(nexus.inspectRun(project, 'process-test').observations[0].stale).toBe(true);
});

test('replaced process ownership never accepts a late receipt or signals the replacement PID', async () => {
  nexus.createRun(project, plan({ delay: 1200 }));
  const launched = launchCli();
  await waitReady();
  const file = path.join(project, '.bmad-plus/nexus/runs/process-test.json');
  const envelope = JSON.parse(fs.readFileSync(file));
  current(envelope.run).backend.ownerPid = process.pid;
  current(envelope.run).backend.sessionId = 'replacement-owner';
  envelope.sha256 = crypto.createHash('sha256').update(JSON.stringify(envelope.run)).digest('hex');
  fs.writeFileSync(file, JSON.stringify(envelope));
  const ended = await launched.finished;
  expect(ended.code).toBe(1);
  expect(JSON.parse(ended.stdout).error).toContain('does not own');
  expect(current(nexus.inspectRun(project, 'process-test')).backend.ownerPid).toBe(process.pid);
  await expect(nexus.launchTask(project, 'process-test', 'work', { retry: true })).rejects.toThrow(
    'reconciled'
  );
});

test('literal argv, protected UTF-8 stdin and minimal environment reach the actual child', async () => {
  const previous = {
    NODE_OPTIONS: process.env.NODE_OPTIONS,
    NODE_PATH: process.env.NODE_PATH,
    FIXTURE_SECRET: process.env.FIXTURE_SECRET,
  };
  try {
    write('checks/preload.cjs', 'process.exit(0)');
    process.env.NODE_OPTIONS = '--require=' + path.join(project, 'checks/preload.cjs');
    process.env.NODE_PATH = project;
    process.env.FIXTURE_SECRET = 'fixture-do-not-forward';
    nexus.createRun(project, plan({ message: 'literal $(echo unsafe) `quoted` — 東京' }));
    const launched = await nexus.launchTask(project, 'process-test', 'work');
    expect(current(launched).process.receipt.output.stdout.text).toContain('$(echo unsafe)');
    expect(JSON.parse(fs.readFileSync(path.join(project, 'work/environment.json')))).toEqual({
      nodeOptions: null,
      nodePath: null,
      secret: null,
    });
    expect(JSON.stringify(launched)).not.toContain('fixture-do-not-forward');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test.each([
  { input: '../foreign' },
  { input: 'work/value.json' },
  { shell: true },
  { env: { API_KEY: 'secret' } },
  { args: 'node worker' },
  { resources: [] },
])('unsafe or undeclared executable inputs fail before a launch: %j', (override) => {
  const original = plan();
  Object.assign(original.tasks[0].execution, override);
  expect(() => nexus.createRun(project, original)).toThrow();
});

test('Codex adapter binds installed executable and fixed non-interactive flags with no bypass', () => {
  const value = plan();
  write('inputs/agent.md', 'Follow the narrow task contract.');
  value.tasks[0].execution = {
    adapter: 'codex-exec',
    command: process.execPath,
    input: 'inputs/task.json',
    instructions: ['inputs/agent.md'],
    sandbox: 'workspace-write',
    model: 'explicit-model',
  };
  const run = nexus.createRun(project, value);
  const execution = run.plan.tasks[0].execution;
  expect(execution.args).toEqual([
    '-a',
    'never',
    'exec',
    '--json',
    '--color',
    'never',
    '--sandbox',
    'workspace-write',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--model',
    'explicit-model',
    '-',
  ]);
  expect(run.plan.tasks[0].resourceHashes['inputs/agent.md']).toMatch(/^[a-f0-9]{64}$/);
  expect(execution.args.join(' ')).not.toContain('dangerously');
});

test('Codex completion must include its actual structured terminal event and thread identity', () => {
  const execution = { adapter: 'codex-exec', blockedExitCodes: [] };
  expect(
    interpretOutput(execution, '{"type":"thread.started","thread_id":"exact-thread"}\n', 0).outcome
  ).toBe('failed');
  const result = interpretOutput(
    execution,
    '{"type":"thread.started","thread_id":"exact-thread"}\n{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":3}}\n',
    0
  );
  expect(result.outcome).toBe('completed');
  expect(result.provider.usage).toEqual({ input_tokens: 12, output_tokens: 3 });
  expect(result.provider.concreteModel).toBeNull();
  expect(interpretOutput(execution, 'null\n', 0).outcome).toBe('failed');
  expect(
    interpretOutput(execution, '{"type":"error","error":{"code":"approval_required"}}\n', 1).outcome
  ).toBe('blocked');
});

test.each(['deadline', 'cancellation-requested'])(
  'a pre-launch %s does not spawn a child',
  async (reason) => {
    const receipt = await runOwnedProcess({
      root: project,
      execution: {
        adapter: 'command',
        command: process.execPath,
        args: ['workers/worker.cjs'],
        cwd: '.',
        outputLimitBytes: 1024,
        blockedExitCodes: [],
      },
      input: Buffer.from('{}'),
      environment: { values: {} },
      deadline: reason === 'deadline' ? Date.now() - 1 : Date.now() + 1000,
      callbacks: {
        poll: () => (reason === 'cancellation-requested' ? reason : null),
        spawned: () => {
          throw new Error('A cancelled/expired task must not be started.');
        },
        heartbeat: () => {},
      },
    });
    expect(receipt.reason).toBe(reason);
    expect(receipt.outcome).toBe('ambiguous');
    expect(receipt.spawned).toBe(false);
    expect(receipt.directChildExited).toBe(false);
    expect(fs.existsSync(path.join(project, 'work/ready'))).toBe(false);
  }
);
