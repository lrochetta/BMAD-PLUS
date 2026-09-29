/** One foreground owner, one direct child. Never take ownership from a recorded PID. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const AUTH_PATH_KEYS = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CODEX_HOME'];

function normalizeExecution(root, value, helpers) {
  if (value === undefined) return undefined;
  const { fail, relative, directoryAt, executable, stringList } = helpers;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('execution must be a command or codex-exec object.');
  if (!['command', 'codex-exec'].includes(value.adapter)) fail('Unsupported execution adapter.');
  const allowed = [
    'adapter',
    'command',
    'input',
    'instructions',
    'resources',
    'cwd',
    'outputLimitBytes',
    ...(value.adapter === 'command' ? ['args', 'blockedExitCodes'] : ['sandbox', 'model']),
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    fail('Unknown execution field; shell, environment and arbitrary Codex flags are unsupported.');
  const input = relative(value.input);
  const instructions = stringList(value.instructions ?? [], 'execution instructions', {
    paths: true,
  });
  const resources = [
    ...new Set([
      input,
      ...instructions,
      ...stringList(value.resources ?? [], 'execution resources', { paths: true }),
    ]),
  ];
  const cwd = value.cwd ?? '.';
  directoryAt(root, cwd);
  const outputLimitBytes = value.outputLimitBytes ?? 256 * 1024;
  if (
    !Number.isInteger(outputLimitBytes) ||
    outputLimitBytes < 1024 ||
    outputLimitBytes > 2 * 1024 * 1024
  )
    fail('execution outputLimitBytes must be between 1024 and 2097152.');
  const resolved = executable(value.command);
  let args;
  let blockedExitCodes = [];
  let sandbox;
  let model;
  if (value.adapter === 'command') {
    args = value.args;
    if (
      !Array.isArray(args) ||
      args.length > 100 ||
      args.some((arg) => typeof arg !== 'string' || arg.length > 8000 || arg.includes('\0'))
    )
      fail('execution args must be a bounded literal argument array.');
    blockedExitCodes = value.blockedExitCodes ?? [];
    if (
      !Array.isArray(blockedExitCodes) ||
      blockedExitCodes.length > 10 ||
      blockedExitCodes.some((code) => !Number.isInteger(code) || code < 1 || code > 255)
    )
      fail('blockedExitCodes must contain explicit nonzero exit codes between 1 and 255.');
  } else {
    sandbox = value.sandbox ?? 'read-only';
    if (!['read-only', 'workspace-write'].includes(sandbox))
      fail('codex-exec supports read-only or workspace-write only.');
    model = value.model ?? null;
    if (
      model !== null &&
      (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/.test(model))
    )
      fail('Codex model must be an explicit bounded model identifier.');
    // stdin carries task text; it is never parsed as flags or a shell command.
    // Auth stays with the installed CLI. No user-config or bypass flag is imported.
    // Project and host rules still apply; this is not a Nexus sandbox.
    args = [
      '-a',
      'never',
      'exec',
      '--json',
      '--color',
      'never',
      '--sandbox',
      sandbox,
      '--skip-git-repo-check',
      '--ignore-user-config',
    ];
    if (model) args.push('--model', model);
    args.push('-');
  }
  return {
    adapter: value.adapter,
    ...resolved,
    args: [...args],
    input,
    instructions,
    resources,
    cwd,
    outputLimitBytes,
    blockedExitCodes: [...new Set(blockedExitCodes)],
    ...(value.adapter === 'codex-exec' ? { sandbox, model } : {}),
  };
}

function inputBytes(root, execution, safeTarget) {
  const parts = [];
  let size = 0;
  for (const file of [...execution.instructions, execution.input]) {
    const target = safeTarget(root, file);
    const stat = fs.statSync(target);
    if (!stat.isFile() || stat.size > 256 * 1024)
      throw new Error('Nexus: execution input must be a regular file no larger than 256 KiB.');
    const bytes = fs.readFileSync(target);
    // Round-trip catches invalid UTF-8; NUL has no place in an agent instruction packet.
    if (!Buffer.from(bytes.toString('utf8')).equals(bytes) || bytes.includes(0))
      throw new Error('Nexus: execution input must contain UTF-8 text without NUL bytes.');
    const prefix = execution.instructions.length
      ? Buffer.from('\n--- ' + file + ' ---\n')
      : Buffer.alloc(0);
    size += prefix.length + bytes.length;
    if (size > 1024 * 1024) throw new Error('Nexus: combined execution input exceeds 1 MiB.');
    parts.push(prefix, bytes);
  }
  return Buffer.concat(parts);
}

function executionEnvironment(execution, minimal) {
  const values = { ...minimal.values };
  if (execution.adapter === 'codex-exec') {
    for (const key of AUTH_PATH_KEYS) {
      const source = Object.keys(process.env).find((name) => name.toUpperCase() === key);
      if (source !== undefined) values[key] = process.env[source];
    }
  }
  // No values or credential hashes enter execution receipts. CLI-owned auth files
  // are not read by Nexus. Verifier environments remain the separate stricter policy.
  return {
    values,
    receipt: {
      policy: execution.adapter === 'codex-exec' ? 'local-codex-auth-paths-v1' : minimal.policy,
      inheritedKeys: Object.keys(values).sort(),
      credentialValuesRecorded: false,
    },
  };
}

function interpretOutput(execution, stdout, code) {
  if (execution.blockedExitCodes.includes(code)) return { outcome: 'blocked', provider: null };
  if (execution.adapter !== 'codex-exec')
    return { outcome: code === 0 ? 'completed' : 'failed', provider: null };
  let threadId = null;
  let completed = false;
  let failed = false;
  let approval = false;
  let usage = null;
  for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return { outcome: 'failed', provider: { problem: 'Invalid Codex JSONL.' } };
    }
    if (!event || typeof event !== 'object' || Array.isArray(event))
      return { outcome: 'failed', provider: { problem: 'Invalid Codex event object.' } };
    if (event.type === 'thread.started' && typeof event.thread_id === 'string')
      threadId = event.thread_id;
    if (event.type === 'turn.completed') {
      completed = true;
      if (event.usage && typeof event.usage === 'object') {
        usage = Object.fromEntries(
          Object.entries(event.usage).filter(
            ([key, value]) =>
              ['input_tokens', 'cached_input_tokens', 'output_tokens'].includes(key) &&
              Number.isSafeInteger(value) &&
              value >= 0
          )
        );
      }
    }
    if (event.type === 'turn.failed' || event.type === 'error') {
      failed = true;
      if (event.error?.code === 'approval_required' || event.code === 'approval_required')
        approval = true;
    }
  }
  return {
    outcome: approval
      ? 'blocked'
      : code === 0 && completed && threadId && !failed
        ? 'completed'
        : 'failed',
    provider: { threadId, completed, failed, usage, concreteModel: null, monetaryCost: null },
  };
}

function runOwnedProcess({ root, execution, input, environment, deadline, callbacks }) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const buffers = { stdout: [], stderr: [] };
    const observed = { stdout: 0, stderr: 0 };
    let captured = 0;
    let child;
    let exitCode = null;
    let signal = null;
    let error = null;
    let reason = null;
    let childExited = false;
    let closed = false;
    let done = false;
    let stopTimer;
    let closeTimer;
    let pollTimer;
    let heartbeatAt = 0;
    let signalled = false;

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(stopTimer);
      clearTimeout(closeTimer);
      clearInterval(pollTimer);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      child?.stdin?.destroy();
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      if (!childExited) child?.unref();
      const stdout = Buffer.concat(buffers.stdout);
      const stderr = Buffer.concat(buffers.stderr);
      const interpreted = interpretOutput(execution, stdout.toString('utf8'), exitCode);
      resolve({
        startedAt,
        endedAt: new Date().toISOString(),
        exitCode,
        signal,
        error,
        reason,
        spawned: Boolean(child?.pid),
        directChildExited: Boolean(child?.pid) && childExited,
        streamsClosed: closed,
        directChildSignalled: signalled,
        descendantState: 'unobserved',
        outcome:
          reason || !childExited || !closed
            ? 'ambiguous'
            : error || signal
              ? 'failed'
              : interpreted.outcome,
        provider: interpreted.provider,
        output: Object.fromEntries(
          [
            ['stdout', stdout],
            ['stderr', stderr],
          ].map(([name, bytes]) => [
            name,
            {
              text: bytes.toString('utf8'),
              base64: bytes.toString('base64'),
              sha256: sha256(bytes),
              capturedBytes: bytes.length,
              observedBytes: observed[name],
              complete: closed && !reason && observed[name] === bytes.length,
              hashScope: 'captured-bytes',
            },
          ])
        ),
      });
    }
    function stop(why) {
      reason ||= why;
      if (child && !childExited && !signalled) {
        // This object was returned by this spawn call. Never signal a saved PID.
        try {
          signalled = child.kill('SIGTERM');
        } catch (caught) {
          error ||= caught.message;
        }
      }
      if (!stopTimer) stopTimer = setTimeout(finish, 1000);
    }
    function interrupt() {
      stop('supervisor-interrupted');
    }
    function capture(name, bytes) {
      observed[name] += bytes.length;
      const keep = Math.min(bytes.length, execution.outputLimitBytes - captured);
      if (keep > 0) {
        buffers[name].push(bytes.subarray(0, keep));
        captured += keep;
      }
      if (keep < bytes.length) stop('output-limit');
    }
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    try {
      const pending = callbacks.poll();
      if (pending || Date.now() >= deadline) {
        reason = pending || 'deadline';
        childExited = true;
        closed = true;
        finish();
        return;
      }
      child = spawn(execution.command, execution.args, {
        cwd: path.join(root, execution.cwd),
        env: environment.values,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (bytes) => capture('stdout', bytes));
      child.stderr.on('data', (bytes) => capture('stderr', bytes));
      child.stdin.on('error', (caught) => {
        if (caught.code !== 'EPIPE') error ||= caught.message;
      });
      child.on('error', (caught) => {
        error = caught.message;
        // Spawn failure creates no child; close follows on supported Node versions.
        if (!child.pid) {
          childExited = true;
          exitCode = null;
        }
      });
      child.on('exit', (code, receivedSignal) => {
        childExited = true;
        exitCode = code;
        signal = receivedSignal;
        closeTimer = setTimeout(() => {
          reason ||= 'retained-pipes';
          finish();
        }, 250);
      });
      child.on('close', (code, receivedSignal) => {
        closed = true;
        exitCode = code;
        signal = receivedSignal;
        finish();
      });
      callbacks.spawned(child.pid ?? null);
      child.stdin.end(input);
      pollTimer = setInterval(() => {
        try {
          const requested = callbacks.poll();
          if (requested) stop(requested);
          if (Date.now() >= deadline) stop('deadline');
          if (Date.now() - heartbeatAt >= 1000) {
            callbacks.heartbeat();
            heartbeatAt = Date.now();
          }
        } catch (caught) {
          error ||= caught.message;
          stop('owner-state-unavailable');
        }
      }, 100);
    } catch (caught) {
      error = caught.message;
      if (!child) {
        childExited = true;
        closed = true;
        finish();
      } else stop('launch-observation-failed');
    }
  });
}

module.exports = {
  normalizeExecution,
  inputBytes,
  executionEnvironment,
  interpretOutput,
  runOwnedProcess,
};
