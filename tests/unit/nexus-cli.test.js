/** Actual separate-process CLI recovery, not mocked lifecycle messages. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawnTimeout, removeTree } = require('../helpers/process-budget');

// The longest case runs ten CLI processes after the one in beforeEach.
jest.setTimeout(spawnTimeout(11));

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;

function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  return target;
}

function command(action, { input, json = true } = {}) {
  const args = [cli, 'nexus', ...action, '--directory', project];
  if (json) args.push('--json');
  if (input) args.push('--input', write('input.json', input));
  const child = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });
  expect(child.error).toBeUndefined();
  return {
    code: child.status,
    value: json ? JSON.parse(child.stdout) : child.stdout,
    stderr: child.stderr,
  };
}

function current(run) {
  return run.tasks[0].attempts.at(-1);
}

function start() {
  const backend = { kind: 'host', id: 'cli-test', sessionId: 'first-session' };
  const result = command(['start', 'cli-smoke', 'value'], { input: { backend } });
  expect(result.code).toBe(0);
  return { backend, attemptId: current(result.value).id };
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(tempParent, 'bmad-nexus-cli-é space-'));
  write('src/value.json', { value: 0 });
  write(
    'checks/value.cjs',
    "const fs=require('node:fs');const assert=require('node:assert/strict');assert.equal(JSON.parse(fs.readFileSync('src/value.json','utf8')).value,7);\n"
  );
  const plan = write('plan.json', {
    id: 'cli-smoke',
    tasks: [
      {
        id: 'value',
        objective: 'Write the verified value',
        scope: ['src/value.json'],
        artifacts: ['src/value.json'],
        resources: ['checks/value.cjs'],
        checks: [{ id: 'value', command: 'node', args: ['checks/value.cjs'] }],
        maxAttempts: 2,
        idempotent: true,
      },
    ],
  });
  const child = spawnSync(
    process.execPath,
    [cli, 'nexus', 'create', '--directory', project, '--plan', plan, '--json'],
    {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    }
  );
  expect(child.status).toBe(0);
  expect(JSON.parse(child.stdout).id).toBe('cli-smoke');
});

afterEach(() => {
  const resolved = fs.realpathSync.native(project);
  expect(path.dirname(resolved)).toBe(tempParent);
  expect(path.basename(resolved)).toMatch(/^bmad-nexus-cli-é space-/);
  removeTree(resolved);
});

test('zero worker exit cannot pass a real failing check; retry consumes a fresh attempt', () => {
  const identity = start();
  expect(
    command(['record', 'cli-smoke', 'value'], {
      input: {
        ...identity,
        outcome: 'completed',
        summary: 'Worker claims completion',
        exitCode: 0,
      },
    }).code
  ).toBe(0);
  const failed = command(['verify', 'cli-smoke', 'value']);
  expect(failed.code).toBe(1);
  expect(current(failed.value).verification.status).toBe('failed');
  expect(command(['accept', 'cli-smoke', 'value']).code).toBe(1);
  const backend = { kind: 'host', id: 'cli-test', sessionId: 'second-session' };
  const retry = command(['retry', 'cli-smoke', 'value'], { input: { backend } });
  expect(retry.code).toBe(0);
  expect(current(retry.value).id).not.toBe(identity.attemptId);
  expect(retry.value.tasks[0].attempts).toHaveLength(2);
  write('src/value.json', { value: 7 });
  expect(
    command(['record', 'cli-smoke', 'value'], {
      input: {
        backend,
        attemptId: current(retry.value).id,
        outcome: 'completed',
        summary: 'Repaired current artifact',
        exitCode: 0,
      },
    }).code
  ).toBe(0);
  expect(command(['verify', 'cli-smoke', 'value']).code).toBe(0);
  const accepted = command(['accept', 'cli-smoke', 'value']);
  expect(accepted.code).toBe(0);
  expect(accepted.value.tasks[0].integration).toBe('accepted');
  expect(accepted.value.tasks[0].integrationReceipt.gitOperation).toBeNull();
});

test('a new CLI process observes interrupted work and cannot blindly retry it', () => {
  const identity = start();
  write('src/value.json', { value: 7 });
  const observed = command(['inspect', 'cli-smoke']);
  expect(current(observed.value).id).toBe(identity.attemptId);
  expect(current(observed.value).execution).toBe('running');
  expect(
    command(['retry', 'cli-smoke', 'value'], { input: { backend: identity.backend } }).code
  ).toBe(1);
  expect(
    command(['reconcile', 'cli-smoke', 'value'], {
      input: {
        ...identity,
        ownerStopped: true,
        outcome: 'completed',
        summary: 'Operator inspected stopped host and retained artifact',
      },
    }).code
  ).toBe(0);
  expect(command(['verify', 'cli-smoke', 'value']).code).toBe(0);
  expect(command(['accept', 'cli-smoke', 'value']).code).toBe(0);
  expect(JSON.parse(fs.readFileSync(path.join(project, 'src/value.json'), 'utf8'))).toEqual({
    value: 7,
  });
});

test('cancellation retains partial files and needs explicit reconciliation', () => {
  const identity = start();
  write('src/value.json', { value: 3 });
  const cancelled = command(['cancel', 'cli-smoke', 'value'], {
    input: { reason: 'Task interrupted by operator' },
  });
  expect(cancelled.code).toBe(0);
  expect(current(cancelled.value).cancellation.status).toBe('requested');
  expect(
    command(['retry', 'cli-smoke', 'value'], { input: { backend: identity.backend } }).code
  ).toBe(1);
  expect(
    command(['reconcile', 'cli-smoke', 'value'], {
      input: {
        ...identity,
        ownerStopped: true,
        outcome: 'cancelled',
        summary: 'Stopped owner inspected; no external effects',
        retrySafe: true,
      },
    }).code
  ).toBe(0);
  expect(JSON.parse(fs.readFileSync(path.join(project, 'src/value.json'), 'utf8'))).toEqual({
    value: 3,
  });
});

test('later edits make JSON and human inspection explicitly stale', () => {
  const identity = start();
  write('src/value.json', { value: 7 });
  expect(
    command(['record', 'cli-smoke', 'value'], {
      input: { ...identity, outcome: 'completed', summary: 'Current result ready' },
    }).code
  ).toBe(0);
  expect(command(['verify', 'cli-smoke', 'value']).code).toBe(0);
  expect(command(['accept', 'cli-smoke', 'value']).code).toBe(0);
  write('src/value.json', { value: 8 });
  const inspected = command(['inspect', 'cli-smoke']);
  expect(inspected.value.observations[0].stale).toBe(true);
  expect(inspected.value.observations[0].evidenceEligible).toBe(false);
  expect(command(['inspect', 'cli-smoke'], { json: false }).value).toContain('STALE');
});

test('a mismatched session cannot record the original attempt or hide an invalid action', () => {
  const identity = start();
  expect(
    command(['record', 'cli-smoke', 'value'], {
      input: {
        ...identity,
        backend: { ...identity.backend, sessionId: 'replacement' },
        outcome: 'completed',
        summary: 'Unrelated host',
      },
    }).code
  ).toBe(1);
  expect(command(['unknown', 'cli-smoke', 'value']).code).toBe(1);
  expect(command(['inspect', 'cli-smoke'], { input: {} }).code).toBe(1);
});
