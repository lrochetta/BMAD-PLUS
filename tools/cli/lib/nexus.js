/** Durable host-managed coordination. Worker claims never constitute check evidence. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { safeTarget } = require('../../build/generate-adapters');
const processBackend = require('./nexus-process');
const FRAMEWORK_VERSION = require('../../../package.json').version;

const BASE = '.bmad-plus/nexus';
const LOCK = BASE + '/writer.lock';
const RECOVERY_LOCK = BASE + '/recovery.lock';
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_STATE_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const CHECK_ENVIRONMENT_KEYS = ['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR'];
const WINDOWS_ENVIRONMENT_KEYS = [
  'HOMEDRIVE',
  'HOMEPATH',
  'LOGONSERVER',
  'SYSTEMDRIVE',
  'USERDOMAIN',
  'USERNAME',
  'USERPROFILE',
];
const CHECK_ENVIRONMENT_POLICY = 'minimal-local-v1';
const now = () => new Date().toISOString();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const clone = (value) => JSON.parse(JSON.stringify(value));
const fail = (message) => {
  throw new Error('Nexus: ' + message);
};
const inScope = (file, scope) =>
  file.toLowerCase() === scope.toLowerCase() ||
  file.toLowerCase().startsWith(scope.toLowerCase() + '/');
const overlap = (a, b) => inScope(a, b) || inScope(b, a);

function checkEnvironment() {
  const values = {};
  const inherited = Object.keys(process.env).sort();
  // libuv supplies these Windows identity variables even when env omits them.
  // Capture their explicit non-secret values so receipts match the child.
  const keys = [
    ...CHECK_ENVIRONMENT_KEYS,
    ...(process.platform === 'win32' ? WINDOWS_ENVIRONMENT_KEYS : []),
  ];
  for (const key of keys) {
    // Normalize key spelling ourselves: Windows variables are case-insensitive,
    // and an injection must not survive by changing NODE_OPTIONS's casing.
    const source =
      inherited.find((name) => name === key) ??
      inherited.find((name) => name.toUpperCase() === key);
    if (source !== undefined) values[key] = process.env[source];
  }
  Object.assign(values, {
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    PYTHONNOUSERSITE: '1',
    PYTHONSAFEPATH: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    // Node otherwise propagates this variable even with an explicit env object.
    NODE_V8_COVERAGE: '',
  });
  const sorted = Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  );
  return { policy: CHECK_ENVIRONMENT_POLICY, values: sorted, sha256: hash(JSON.stringify(sorted)) };
}

function id(value, label = 'ID') {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value))
    fail(label + ' must use 1-64 lowercase letters, numbers, _ or -.');
  return value;
}

function text(value, label, limit = 8000) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0'))
    fail(label + ' must be a nonempty bounded string.');
  return value;
}

function relative(value, allowDot = false) {
  if (allowDot && value === '.') return value;
  text(value, 'Relative path', 500);
  if (
    /[\\:<>"|?*]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32) ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === '..' ||
    value.startsWith('../')
  )
    fail('Unsafe relative path: ' + value);
  if (
    value
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
      )
  )
    fail('Nonportable path: ' + value);
  return value;
}

function rootOf(directory) {
  const root = path.resolve(directory);
  // safeTarget checks every existing ancestor, including the project itself.
  safeTarget(root, BASE + '/.probe');
  if (!fs.statSync(root).isDirectory()) fail('Project directory is not a directory.');
  return fs.realpathSync.native(root);
}

function directoryAt(root, file) {
  relative(file, true);
  const target = file === '.' ? root : path.join(root, file);
  safeTarget(root, (file === '.' ? '' : file + '/') + '.nexus-directory-probe');
  if (!fs.statSync(target).isDirectory()) fail('Check cwd is not a directory: ' + file);
  return target;
}

function fileHash(root, file, required = true) {
  relative(file);
  const target = safeTarget(root, file);
  if (!fs.existsSync(target)) {
    if (required) fail('Required file is missing: ' + file);
    return null;
  }
  if (fs.statSync(target).size > MAX_FILE_BYTES)
    fail('File exceeds the 16 MiB snapshot limit: ' + file);
  return hash(fs.readFileSync(target));
}

function filesSnapshot(root, files, required = true) {
  return Object.fromEntries(
    [...new Set(files)].sort().map((file) => [file, fileHash(root, file, required)])
  );
}

function scopeSnapshot(root, scopes) {
  const files = [];
  function walk(file) {
    const target = path.join(root, file);
    let stat;
    try {
      stat = fs.lstatSync(target);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) fail('Scope contains a symlink or junction: ' + file);
    if (stat.isDirectory()) {
      directoryAt(root, file);
      for (const name of fs.readdirSync(target).sort()) walk(file + '/' + name);
    } else if (stat.isFile()) {
      files.push(file);
      if (files.length > 10000) fail('Scope exceeds the 10000 file snapshot limit.');
    } else fail('Scope contains a non-regular file: ' + file);
  }
  for (const scope of scopes) {
    const target = path.join(root, scope);
    if (fs.existsSync(target) && fs.lstatSync(target).isFile()) {
      safeTarget(root, scope);
      files.push(scope);
    } else {
      safeTarget(root, scope + '/.nexus-scope-probe');
      walk(scope);
    }
  }
  return filesSnapshot(root, files);
}

function revision(root) {
  const env = checkEnvironment().values;
  const top = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
    maxBuffer: 4096,
  });
  if (top.status !== 0) return null;
  const repository = fs.realpathSync.native(top.stdout.trim());
  if (
    process.platform === 'win32'
      ? repository.toLowerCase() !== root.toLowerCase()
      : repository !== root
  )
    return null;
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
    maxBuffer: 4096,
  });
  return result.status === 0 && /^[a-f0-9]{40,64}$/.test(result.stdout.trim())
    ? result.stdout.trim()
    : null;
}

function atomicWrite(root, file, value) {
  const target = safeTarget(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporaryFile = file + '.' + crypto.randomUUID() + '.tmp';
  const temporary = safeTarget(root, temporaryFile);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, value);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    safeTarget(root, file);
    fs.renameSync(temporary, target);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(safeTarget(root, temporaryFile))) fs.unlinkSync(temporary);
  }
}

function lockSnapshot(root, file = LOCK) {
  const target = safeTarget(root, file);
  if (!fs.existsSync(target)) return null;
  const bytes = fs.readFileSync(target);
  let owner = null;
  try {
    owner = JSON.parse(bytes.toString('utf8'));
  } catch {
    /* Interrupted lock creation remains explicit. */
  }
  return {
    hash: hash(bytes),
    owner,
    recovery: 'Inspect the owner; recover only after its process has stopped.',
  };
}

function withLock(root, operation, file = LOCK) {
  const assertRecoveryIdle = () => {
    if (file === LOCK && fs.existsSync(safeTarget(root, RECOVERY_LOCK)))
      fail(
        'Lock recovery is active or interrupted; inspect recovery.lock and its owner before proceeding.'
      );
  };
  assertRecoveryIdle();
  const target = safeTarget(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  safeTarget(root, file);
  let fd;
  try {
    fd = fs.openSync(target, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST')
      fail(
        file === RECOVERY_LOCK
          ? 'Another recovery owns recovery.lock; inspect its owner and effects before any manual recovery.'
          : 'Another mutation owns writer.lock; inspect before explicit recovery.'
      );
    throw error;
  }
  const owner = {
    token: crypto.randomUUID(),
    pid: process.pid,
    hostname: os.hostname(),
    createdAt: now(),
  };
  try {
    fs.writeFileSync(fd, JSON.stringify(owner));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // A recovery may begin after the first check. Publish our live ownership
    // before this second check so that it cannot be mistaken for a stale writer.
    assertRecoveryIdle();
    return operation();
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    const current = lockSnapshot(root, file);
    if (current?.owner?.token === owner.token) fs.unlinkSync(safeTarget(root, file));
  }
}

function recoverLock(directory, { expectedHash, note, ownerStopped } = {}) {
  const root = rootOf(directory);
  text(note, 'Recovery observation');
  return withLock(
    root,
    () => {
      const observed = lockSnapshot(root);
      if (!observed || observed.hash !== expectedHash || ownerStopped !== true)
        fail('Exact lock hash and an explicit stopped-owner observation are required.');
      if (
        observed.owner?.hostname === os.hostname() &&
        Number.isInteger(observed.owner.pid) &&
        observed.owner.pid > 0
      ) {
        try {
          process.kill(observed.owner.pid, 0);
          fail('Lock owner process is still alive; no lock was removed.');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
      }
      // Keep the exact previous lock and observation as a receipt before removing it.
      const receipt = {
        schemaVersion: 1,
        observed,
        note,
        ownerStopped: true,
        recoveredAt: now(),
        evidenceClass: 'operator-observation',
      };
      atomicWrite(
        root,
        BASE + '/lock-recovery/' + crypto.randomUUID() + '.json',
        JSON.stringify(receipt, null, 2) + '\n'
      );
      if (lockSnapshot(root)?.hash !== expectedHash) fail('Lock changed during recovery.');
      fs.unlinkSync(safeTarget(root, LOCK));
      return receipt;
    },
    RECOVERY_LOCK
  );
}

function runFile(runId) {
  return BASE + '/runs/' + id(runId, 'Run ID') + '.json';
}

function saveRun(root, run) {
  run.updatedAt = now();
  run.sequence += 1;
  const payload = JSON.stringify(run);
  if (Buffer.byteLength(payload) > MAX_STATE_BYTES) fail('Run exceeds the 16 MiB state limit.');
  atomicWrite(
    root,
    runFile(run.id),
    JSON.stringify({ schemaVersion: 1, sha256: hash(payload), run }, null, 2) + '\n'
  );
  return clone(run);
}

function loadRun(root, runId) {
  const target = safeTarget(root, runFile(runId));
  if (fs.statSync(target).size > MAX_STATE_BYTES * 2) fail('Run state exceeds the size limit.');
  let envelope;
  try {
    envelope = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    fail('Corrupt run state; original bytes were preserved.');
  }
  const run = envelope?.run;
  if (
    envelope.schemaVersion !== 1 ||
    !run ||
    envelope.sha256 !== hash(JSON.stringify(run)) ||
    run.schemaVersion !== 1 ||
    run.id !== runId ||
    run.project !== root ||
    !Number.isInteger(run.sequence) ||
    !Array.isArray(run.tasks)
  )
    fail('Corrupt or foreign run state; original bytes were preserved.');
  // Recheck the immutable plan's shape, and reject malformed lifecycle records.
  if (
    run.planHash !== hash(JSON.stringify(run.plan)) ||
    !same(
      run.tasks.map((task) => task.id),
      run.plan.tasks.map((task) => task.id)
    )
  )
    fail('Run plan integrity mismatch.');
  const attempts = new Set();
  for (const task of run.tasks) {
    if (
      !Array.isArray(task.attempts) ||
      !['pending', 'accepted', 'rejected'].includes(task.integration)
    )
      fail('Invalid task lifecycle record.');
    for (const attempt of task.attempts) {
      if (
        typeof attempt.id !== 'string' ||
        attempts.has(attempt.id) ||
        attempt.taskId !== task.id ||
        attempt.runId !== run.id ||
        !Number.isInteger(attempt.verificationRounds) ||
        attempt.verificationRounds < 0 ||
        !Array.isArray(attempt.verificationHistory) ||
        !Array.isArray(attempt.reconciliations) ||
        !['running', 'blocked', 'ambiguous', 'completed', 'failed', 'cancelled'].includes(
          attempt.execution
        ) ||
        !['pending', 'running', 'passed', 'failed', 'ambiguous'].includes(
          attempt.verification.status
        )
      )
        fail('Invalid attempt lifecycle record.');
      attempts.add(attempt.id);
    }
  }
  return run;
}

function stringList(value, label, { paths = false, empty = true } = {}) {
  if (!Array.isArray(value) || (!empty && !value.length) || value.length > 1000)
    fail(label + ' must be a bounded array.');
  const values = value.map((item) => (paths ? relative(item) : text(item, label)));
  if (new Set(values.map((item) => item.toLowerCase())).size !== values.length)
    fail('Duplicate ' + label + '.');
  return values;
}

function executable(command) {
  if (command === 'node') command = process.execPath;
  if (typeof command !== 'string' || !path.isAbsolute(command))
    fail('Check command must be node or an absolute executable path.');
  const real = fs.realpathSync.native(command);
  if (!fs.statSync(real).isFile()) fail('Check command is not a regular executable.');
  return { command: real, commandHash: hash(fs.readFileSync(real)) };
}

function normalizePlan(root, plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan))
    fail('A JSON plan object is required.');
  id(plan.id, 'Run ID');
  if (!Array.isArray(plan.tasks) || !plan.tasks.length || plan.tasks.length > 200)
    fail('A plan needs 1-200 tasks.');
  const maxParallel = plan.maxParallel ?? 1;
  if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 32)
    fail('maxParallel must be between 1 and 32.');
  const config = plan.config ?? {};
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    Object.entries(config).some(
      ([key, value]) =>
        /password|secret|token|credential|api.?key/i.test(key) ||
        !['string', 'number', 'boolean'].includes(typeof value)
    )
  )
    fail('config accepts non-secret primitive settings only.');
  const tasks = plan.tasks.map((task) => {
    id(task.id, 'Task ID');
    const scope = stringList(task.scope, 'write scope', { paths: true, empty: false });
    for (const item of scope) {
      if (overlap(item, BASE) || overlap(item, '.git'))
        fail('Runtime state and .git cannot be a worker write scope.');
      // Inspect a scope through a child only when it is a directory or absent.
      const target = path.join(root, item);
      if (fs.existsSync(target) && fs.lstatSync(target).isFile()) safeTarget(root, item);
      else safeTarget(root, item + '/.nexus-scope-probe');
    }
    const artifacts = stringList(task.artifacts, 'artifacts', { paths: true, empty: false });
    for (const file of artifacts)
      if (!scope.some((item) => inScope(file, item)))
        fail('Artifact is outside its task write scope: ' + file);
    const resources = stringList(task.resources ?? [], 'resources', { paths: true });
    const execution = processBackend.normalizeExecution(root, task.execution, {
      fail,
      relative,
      directoryAt,
      executable,
      stringList,
    });
    if (execution)
      resources.push(...execution.resources.filter((file) => !resources.includes(file)));
    if (!Array.isArray(task.checks) || !task.checks.length || task.checks.length > 30)
      fail('Each task needs 1-30 explicit verification checks.');
    const checks = task.checks.map((check) => {
      id(check.id, 'Check ID');
      if (
        !Array.isArray(check.args) ||
        check.args.length > 100 ||
        check.args.some((arg) => typeof arg !== 'string' || arg.length > 8000 || arg.includes('\0'))
      )
        fail('Check args must be a bounded literal argument array.');
      const cwd = check.cwd ?? '.';
      directoryAt(root, cwd);
      const checkResources = stringList(check.resources ?? [], 'check resources', { paths: true });
      const allowed = [...resources, ...checkResources];
      for (const argument of check.args) {
        if (!argument || argument.startsWith('-')) continue;
        const absolute = path.resolve(root, cwd, argument);
        const candidate = path.relative(root, absolute).split(path.sep).join('/');
        if (
          fs.existsSync(absolute) &&
          fs.statSync(absolute).isFile() &&
          !allowed.includes(candidate)
        )
          fail('File argument must be declared as a protected resource: ' + candidate);
      }
      const timeoutMs = check.timeoutMs ?? 30000;
      if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 300000)
        fail('Check timeoutMs must be between 10 and 300000.');
      return {
        id: check.id,
        ...executable(check.command),
        args: [...check.args],
        cwd,
        timeoutMs,
        resources: checkResources,
      };
    });
    if (new Set(checks.map((check) => check.id)).size !== checks.length)
      fail('Duplicate check IDs.');
    const maxAttempts = task.maxAttempts ?? 2;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
      fail('maxAttempts must be between 1 and 10.');
    if (task.idempotent !== undefined && typeof task.idempotent !== 'boolean')
      fail('idempotent must be boolean.');
    const deadlineMs = task.deadlineMs ?? 3600000;
    if (!Number.isInteger(deadlineMs) || deadlineMs < 100 || deadlineMs > 86400000)
      fail('deadlineMs must be between 100 and 86400000.');
    const acceptance =
      task.acceptance === undefined
        ? checks.map((check) => 'Check ' + check.id + ' passes on the current artifacts.')
        : stringList(
            Array.isArray(task.acceptance) ? task.acceptance : [task.acceptance],
            'acceptance criteria',
            { empty: false }
          );
    return {
      id: task.id,
      objective: text(task.objective, 'Objective'),
      dependsOn: stringList(task.dependsOn ?? [], 'dependencies').map((item) => id(item)),
      scope,
      artifacts,
      resources,
      checks,
      maxAttempts,
      idempotent: task.idempotent === true,
      deadlineMs,
      acceptance,
      authorizations: stringList(task.authorizations ?? [], 'existing authorizations'),
      ...(execution ? { execution } : {}),
    };
  });
  const ids = new Set(tasks.map((task) => task.id));
  if (ids.size !== tasks.length) fail('Duplicate task IDs.');
  const visited = new Set();
  const visiting = new Set();
  function visit(task) {
    if (visiting.has(task.id)) fail('Dependency cycle at ' + task.id);
    if (visited.has(task.id)) return;
    visiting.add(task.id);
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) fail('Unknown dependency: ' + dep);
      visit(tasks.find((item) => item.id === dep));
    }
    visiting.delete(task.id);
    visited.add(task.id);
  }
  for (const task of tasks) visit(task);
  for (let i = 0; i < tasks.length; i++)
    for (let j = i + 1; j < tasks.length; j++)
      if (tasks[i].scope.some((a) => tasks[j].scope.some((b) => overlap(a, b))))
        fail('Overlapping exclusive write scopes: ' + tasks[i].id + ' and ' + tasks[j].id);
  const allScopes = tasks.flatMap((task) => task.scope);
  for (const task of tasks) {
    const resources = [...task.resources, ...task.checks.flatMap((check) => check.resources)];
    for (const file of resources)
      if (allScopes.some((scope) => inScope(file, scope)))
        fail('Verifier/resource lies in a worker write scope: ' + file);
    for (const check of task.checks) {
      const relativeCommand = path.relative(root, check.command).split(path.sep).join('/');
      if (allScopes.some((scope) => inScope(relativeCommand, scope)))
        fail('Verifier executable lies in a worker write scope.');
    }
    if (task.execution) {
      const execution = task.execution;
      const relativeCommand = path.relative(root, execution.command).split(path.sep).join('/');
      if (allScopes.some((scope) => inScope(relativeCommand, scope)))
        fail('Worker executable lies in a worker write scope.');
      for (const argument of execution.args) {
        if (!argument || argument.startsWith('-')) continue;
        const absolute = path.resolve(root, execution.cwd, argument);
        const candidate = path.relative(root, absolute).split(path.sep).join('/');
        if (
          fs.existsSync(absolute) &&
          fs.statSync(absolute).isFile() &&
          !resources.includes(candidate)
        )
          fail('Execution file argument must be a protected resource: ' + candidate);
      }
      processBackend.inputBytes(root, execution, safeTarget);
    }
    task.resourceHashes = filesSnapshot(root, resources);
    scopeSnapshot(root, task.scope);
  }
  return { id: plan.id, maxParallel, config: clone(config), tasks };
}

function createRun(directory, plan) {
  const root = rootOf(directory);
  const normalized = normalizePlan(root, plan);
  return withLock(root, () => {
    if (fs.existsSync(safeTarget(root, runFile(normalized.id))))
      fail('Run already exists; inspect it instead.');
    return saveRun(root, {
      schemaVersion: 1,
      id: normalized.id,
      project: root,
      frameworkVersion: FRAMEWORK_VERSION,
      createdAt: now(),
      updatedAt: now(),
      sequence: 0,
      planHash: hash(JSON.stringify(normalized)),
      plan: normalized,
      tasks: normalized.tasks.map((task) => ({
        id: task.id,
        integration: 'pending',
        attempts: [],
      })),
    });
  });
}

function current(task) {
  return task.attempts.at(-1);
}
function active(task) {
  const attempt = current(task);
  return Boolean(
    attempt &&
    (['running', 'blocked', 'ambiguous'].includes(attempt.execution) ||
      attempt.verification.status === 'running' ||
      attempt.verification.status === 'ambiguous' ||
      attempt.cancellation.status === 'requested')
  );
}
function taskOf(run, taskId) {
  id(taskId, 'Task ID');
  const task = run.tasks.find((item) => item.id === taskId);
  if (!task) fail('Unknown task: ' + taskId);
  return task;
}
function definition(run, taskId) {
  return run.plan.tasks.find((item) => item.id === taskId);
}

function inspectRun(directory, runId) {
  const root = rootOf(directory);
  if (runId === undefined) {
    const directory = path.join(root, BASE, 'runs');
    safeTarget(root, BASE + '/runs/.inventory-probe');
    const runIds = fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter((file) => /^[a-z0-9][a-z0-9_-]{0,63}\.json$/.test(file))
          .map((file) => file.slice(0, -5))
          .sort()
      : [];
    return {
      schemaVersion: 1,
      project: root,
      frameworkVersion: FRAMEWORK_VERSION,
      runIds,
      lock: lockSnapshot(root),
      recoveryLock: lockSnapshot(root, RECOVERY_LOCK),
      hint: 'Run IDs are an inventory, not validated outcomes; inspect an individual run for current evidence.',
    };
  }
  const run = loadRun(root, runId);
  const verifiedDependencies = new Set();
  const observations = run.tasks.map((task) => {
    const attempt = current(task);
    let hint =
      task.integration === 'accepted'
        ? 'Accepted; no git operation was performed.'
        : 'Start when dependencies have current accepted evidence.';
    if (attempt) {
      if (active(task))
        hint =
          'Inspect this exact backend and attempt. Reconcile ambiguous or stopped work before retry; no automatic relaunch or termination.';
      else if (attempt.verification.status === 'passed')
        hint = 'Accept only after rechecking current artifacts and resources.';
      else if (attempt.execution === 'completed' && attempt.verification.status === 'pending')
        hint = 'Run the configured verification checks.';
      else hint = 'Review the terminal record and retry policy; a retry creates a new attempt.';
      if (
        attempt.backend.kind === 'process' &&
        attempt.process?.status === 'finished' &&
        !attempt.process.collectedAt
      )
        hint =
          attempt.process.receipt?.outcome === 'completed'
            ? 'An owned process receipt is ready. Collect this exact attempt, then verify its current artifacts.'
            : 'Inspect and collect the owned process receipt. Resolve blocked or ambiguous effects before a new attempt; completion is not established.';
    }
    let resourcesCurrent = true;
    let evidenceEligible = false;
    let staleReason = null;
    try {
      protectedSnapshot(root, definition(run, task.id));
    } catch (error) {
      resourcesCurrent = false;
      staleReason = error.message;
    }
    if (attempt?.verification.status === 'passed') {
      try {
        evidenceCurrent(root, run, task, verifiedDependencies);
        evidenceEligible = true;
      } catch (error) {
        staleReason = error.message;
      }
    }
    if (staleReason)
      hint = 'Recorded state is historical; current inputs/evidence are stale: ' + staleReason;
    return {
      taskId: task.id,
      attemptId: attempt?.id ?? null,
      overdue: Boolean(attempt && active(task) && Date.now() > Date.parse(attempt.deadline)),
      resourcesCurrent,
      evidenceEligible,
      stale: Boolean(staleReason),
      staleReason,
      ...(attempt?.backend.kind === 'process'
        ? {
            process: {
              status: attempt.process?.status ?? 'launch-unacknowledged',
              supervisor: attempt.process?.owner ?? null,
              lastHeartbeat: attempt.process?.heartbeatAt ?? null,
              heartbeatStale:
                !attempt.process?.heartbeatAt ||
                Date.now() - Date.parse(attempt.process.heartbeatAt) > 5000,
              childPid: attempt.process?.childPid ?? null,
              receiptReady: Boolean(attempt.process?.receipt && !attempt.process.collectedAt),
              liveIdentityEstablished: false,
              hint: 'A stored PID or fresh heartbeat is an observation, not authority to terminate or relaunch.',
            },
          }
        : {}),
      hint,
    };
  });
  return {
    ...run,
    observations,
    lock: lockSnapshot(root),
    recoveryLock: lockSnapshot(root, RECOVERY_LOCK),
  };
}

function mutate(directory, runId, operation) {
  const root = rootOf(directory);
  return withLock(root, () => {
    const run = loadRun(root, runId);
    operation(root, run);
    return saveRun(root, run);
  });
}

function backendIdentity(value) {
  if (value?.kind === 'process') {
    if (!Number.isInteger(value.ownerPid) || value.ownerPid < 1)
      fail('Process backend needs its actual supervisor PID.');
    return {
      kind: 'process',
      id: text(value.id, 'Process owner handle', 200),
      sessionId: text(value.sessionId, 'Process session', 200),
      hostname: text(value.hostname, 'Process host', 200),
      ownerPid: value.ownerPid,
      capabilities: {
        launch: true,
        terminate: 'owner-direct-child',
        inspect: 'durable-process-observation',
      },
    };
  }
  if (!value || value.kind !== 'host') fail('Only host and process backends are implemented.');
  return {
    kind: 'host',
    id: text(value.id, 'Backend handle', 200),
    sessionId: text(value.sessionId, 'Backend session', 200),
    capabilities: { launch: false, terminate: false, inspect: 'host-observation' },
  };
}

function boundAttempt(task, input) {
  const attempt = current(task);
  if (!attempt || input?.attemptId !== attempt.id) fail('Stale or missing attempt identity.');
  if (!same(attempt.backend, backendIdentity(input.backend)))
    fail('Backend handle/session does not own this attempt.');
  return attempt;
}

function protectedSnapshot(root, def) {
  const resources = filesSnapshot(root, Object.keys(def.resourceHashes));
  if (!same(resources, def.resourceHashes))
    fail('Protected verifier or agent resource changed since the plan was created.');
  for (const check of def.checks) {
    directoryAt(root, check.cwd);
    if (executable(check.command).commandHash !== check.commandHash)
      fail('Verifier executable changed since plan creation.');
  }
  if (def.execution) {
    directoryAt(root, def.execution.cwd);
    if (executable(def.execution.command).commandHash !== def.execution.commandHash)
      fail('Worker executable changed since plan creation.');
  }
  return resources;
}

function evidenceCurrent(root, run, task, verified = new Set(), ancestors = new Set()) {
  if (ancestors.has(task.id)) fail('Dependency cycle at ' + task.id);
  if (verified.has(task.id)) return;
  const attempt = current(task);
  if (
    !attempt ||
    attempt.verification.status !== 'passed' ||
    attempt.verification.attemptId !== attempt.id ||
    attempt.execution !== 'completed' ||
    attempt.cancellation.status === 'requested'
  )
    fail('Current attempt has no eligible passed verification.');
  const environment = attempt.verification.environment;
  if (
    !environment ||
    environment.policy !== CHECK_ENVIRONMENT_POLICY ||
    environment.sha256 !== hash(JSON.stringify(environment.values))
  )
    fail('Verification environment is missing or obsolete; fresh evidence is required.');
  const def = definition(run, task.id);
  protectedSnapshot(root, def);
  const observed = scopeSnapshot(root, def.scope);
  if (
    !same(observed, attempt.verification.scopeHashes) ||
    !same(filesSnapshot(root, def.artifacts), attempt.verification.artifactHashes)
  )
    fail('Stale evidence: checked artifacts or write scope changed.');
  if (
    !same(
      attempt.verification.checks.map((check) => check.id),
      def.checks.map((check) => check.id)
    ) ||
    attempt.verification.checks.some(
      (check) =>
        check.exitCode !== 0 ||
        check.error ||
        check.signal ||
        check.attemptId !== attempt.id ||
        !same(check.environment, environment)
    )
  )
    fail('Verification receipt is incomplete.');
  const dependencyAncestors = new Set(ancestors).add(task.id);
  for (const dependencyId of def.dependsOn) {
    const dependency = taskOf(run, dependencyId);
    if (dependency.integration !== 'accepted')
      fail('Dependency has not been accepted: ' + dependencyId);
    evidenceCurrent(root, run, dependency, verified, dependencyAncestors);
  }
  verified.add(task.id);
}

function assertCapacity(root, run, def) {
  if (run.tasks.filter(active).length >= run.plan.maxParallel)
    fail('Run capacity is occupied until active work is reconciled.');
  const runsDirectory = directoryAt(root, BASE + '/runs');
  for (const file of fs.readdirSync(runsDirectory).filter((file) => file.endsWith('.json'))) {
    const other = loadRun(root, file.slice(0, -5));
    for (const task of other.tasks.filter(active))
      if (definition(other, task.id).scope.some((a) => def.scope.some((b) => overlap(a, b))))
        fail('Write scope is owned by active attempt: ' + other.id + '/' + task.id);
  }
}

function begin(root, run, task, options, retry) {
  const def = definition(run, task.id);
  const previous = current(task);
  if (task.integration === 'accepted') fail('Accepted tasks cannot be restarted.');
  if (retry) {
    if (
      !previous ||
      active(task) ||
      !(
        previous.execution === 'failed' ||
        previous.execution === 'cancelled' ||
        previous.verification.status === 'failed'
      )
    )
      fail('Retry requires a reconciled failed/cancelled attempt or failed verification.');
    if (!def.idempotent && previous.reconciliation?.retrySafe !== true)
      fail('Non-idempotent retry requires an explicit retry-safe reconciliation.');
  } else if (previous) fail('Task already has an attempt; inspect or explicitly retry.');
  if (task.attempts.length >= def.maxAttempts) fail('Retry limit reached.');
  const verifiedDependencies = new Set();
  for (const dependencyId of def.dependsOn) {
    const dependency = taskOf(run, dependencyId);
    if (dependency.integration !== 'accepted')
      fail('Dependency has not been accepted: ' + dependencyId);
    evidenceCurrent(root, run, dependency, verifiedDependencies);
  }
  assertCapacity(root, run, def);
  const resources = protectedSnapshot(root, def);
  const backend = backendIdentity(options.backend);
  const startedAt = now();
  task.integration = 'pending';
  task.attempts.push({
    id: crypto.randomUUID(),
    runId: run.id,
    taskId: task.id,
    parentAttemptId: previous?.id ?? null,
    backend,
    execution: 'running',
    verification: { status: 'pending', checks: [] },
    verificationRounds: 0,
    verificationHistory: [],
    reconciliations: [],
    cancellation: { status: 'none' },
    startedAt,
    observedAt: startedAt,
    endedAt: null,
    deadline: new Date(Date.now() + def.deadlineMs).toISOString(),
    baseline: {
      repository: root,
      revision: revision(root),
      framework: {
        version: FRAMEWORK_VERSION,
        runtimeHash: hash(fs.readFileSync(__filename)),
        installManifestHash: fileHash(root, '_bmad/.bmad-plus-install.json', false),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      scopeHashes: scopeSnapshot(root, def.scope),
      artifactHashes: filesSnapshot(root, def.artifacts, false),
      resourceHashes: resources,
      config: clone(run.plan.config),
    },
    authorizations: [...def.authorizations],
    observations: [],
    uncheckedScope:
      'External effects, undeclared dependencies and files outside the declared scope are not sandboxed or independently observed.',
  });
}

function startTask(directory, runId, taskId, options = {}) {
  return mutate(directory, runId, (root, run) => {
    if (definition(run, taskId).execution || options.backend?.kind !== 'host')
      fail('Executable plans use launch; start requires a host-owned plan and host identity.');
    begin(root, run, taskOf(run, taskId), options, false);
  });
}
function retryTask(directory, runId, taskId, options = {}) {
  return mutate(directory, runId, (root, run) => {
    if (definition(run, taskId).execution || options.backend?.kind !== 'host')
      fail(
        'Executable plans retry through launch with retry: true; retry requires a host identity.'
      );
    begin(root, run, taskOf(run, taskId), options, true);
  });
}

function recordAttempt(directory, runId, taskId, input = {}) {
  return mutate(directory, runId, (root, run) => {
    const task = taskOf(run, taskId);
    const attempt = boundAttempt(task, input);
    if (attempt.backend.kind === 'process')
      fail('Process attempts collect their owned receipt; worker observations cannot replace it.');
    if (
      !['running', 'blocked'].includes(attempt.execution) ||
      attempt.cancellation.status !== 'none'
    )
      fail('This attempt requires reconciliation, not a late worker acknowledgement.');
    if (!['completed', 'failed', 'blocked', 'ambiguous'].includes(input.outcome))
      fail('Unsupported worker outcome.');
    if (input.exitCode !== undefined && !Number.isInteger(input.exitCode))
      fail('exitCode must be an integer.');
    if (input.outcome === 'completed' && input.exitCode !== undefined && input.exitCode !== 0)
      fail('Nonzero exit cannot be a completed outcome.');
    const observation = {
      at: now(),
      outcome: input.outcome,
      summary: text(input.summary, 'Worker observation'),
      exitCode: input.exitCode ?? null,
      evidenceClass: 'host-report',
      independentlyVerified: false,
    };
    attempt.observations.push(observation);
    attempt.execution = input.outcome;
    attempt.observedAt = observation.at;
    if (['completed', 'failed'].includes(input.outcome)) {
      attempt.endedAt = observation.at;
      attempt.resultHashes = scopeSnapshot(root, definition(run, taskId).scope);
    }
    if (input.outcome === 'blocked') attempt.blockedRequest = observation.summary;
  });
}

function reconcileAttempt(directory, runId, taskId, input = {}) {
  return mutate(directory, runId, (root, run) => {
    const task = taskOf(run, taskId);
    const attempt = boundAttempt(task, input);
    if (task.integration === 'accepted')
      fail('Accepted work cannot be rewritten through reconciliation.');
    if (!['completed', 'failed', 'cancelled'].includes(input.outcome))
      fail('Reconciliation must establish completed, failed or cancelled work.');
    if (input.ownerStopped !== true)
      fail(
        'Reconciliation requires an explicit ownerStopped observation; timeouts alone are insufficient.'
      );
    if (
      attempt.backend.kind === 'process' &&
      attempt.process?.status !== 'finished' &&
      attempt.backend.hostname === os.hostname()
    ) {
      try {
        // A live PID blocks an unsafe takeover even if it may have been reused.
        // Only the original spawn handle may send a termination signal.
        process.kill(attempt.backend.ownerPid, 0);
        fail(
          'Process supervisor may still be alive; request cancellation and inspect its actual operation.'
        );
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    if (
      attempt.backend.kind === 'process' &&
      attempt.backend.hostname === os.hostname() &&
      !attempt.process?.receipt?.directChildExited &&
      Number.isInteger(attempt.process?.childPid)
    ) {
      try {
        process.kill(attempt.process.childPid, 0);
        fail(
          'The original child may still be alive; inspect its effects before stopped-owner reconciliation.'
        );
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    const verifierOwner = attempt.verification.owner;
    if (attempt.verification.status === 'running' && verifierOwner?.hostname === os.hostname()) {
      try {
        process.kill(verifierOwner.pid, 0);
        fail('Verification process is still alive; request cancellation and wait for it to stop.');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    const observedHashes = scopeSnapshot(root, definition(run, taskId).scope);
    if (input.outcome === 'completed' && attempt.verification.status === 'failed')
      fail('Failed verification requires a new attempt; reconciliation cannot reset it.');
    if (
      input.outcome === 'completed' &&
      attempt.resultHashes &&
      !same(observedHashes, attempt.resultHashes)
    )
      fail('Recorded result changed; reconcile failure and retry with a new attempt.');
    const reconciliation = {
      at: now(),
      summary: text(input.summary, 'Reconciliation observation'),
      outcome: input.outcome,
      ownerStopped: true,
      retrySafe: input.retrySafe === true,
      observedHashes,
      evidenceClass: 'operator-observation',
      independentlyVerified: false,
    };
    attempt.reconciliation = reconciliation;
    attempt.reconciliations.push(clone(reconciliation));
    attempt.execution = input.outcome;
    attempt.observedAt = reconciliation.at;
    attempt.endedAt = reconciliation.at;
    if (attempt.verification.status === 'running' || attempt.verification.status === 'ambiguous')
      attempt.verification.status = 'ambiguous';
    // An interrupted verification never becomes evidence; an explicit stopped-owner
    // observation permits a fresh verify without inheriting its partial checks.
    if (attempt.verification.status === 'ambiguous') {
      attempt.verificationHistory.push(clone(attempt.verification));
      attempt.verification = {
        status: 'pending',
        checks: [],
      };
    }
    if (attempt.cancellation.status === 'requested' || input.outcome === 'cancelled')
      attempt.cancellation = {
        ...attempt.cancellation,
        status: 'reconciled',
        reconciledAt: now(),
        resolvedOutcome: input.outcome,
      };
    attempt.resultHashes ||= observedHashes;
  });
}

function cancelTask(directory, runId, taskId, input = {}) {
  return mutate(directory, runId, (_root, run) => {
    const task = taskOf(run, taskId);
    const attempt = current(task);
    if (!attempt || task.integration === 'accepted')
      fail('Only an unaccepted existing attempt can be cancelled.');
    if (attempt.cancellation.status !== 'none')
      fail('Cancellation is already recorded; inspect and reconcile it.');
    if (attempt.backend.kind === 'process') boundAttempt(task, input);
    attempt.cancellation = {
      status: 'requested',
      requestedAt: now(),
      reason: text(input.reason, 'Cancellation reason'),
      termination:
        attempt.backend.kind === 'process'
          ? 'requested-from-original-owner'
          : 'unresolved-host-owned',
      processesSignalled: [],
    };
    if (['running', 'blocked'].includes(attempt.execution)) attempt.execution = 'ambiguous';
    // A separate client never owns a spawn handle. The original supervisor polls this request.
    attempt.observedAt = now();
  });
}

async function launchTask(directory, runId, taskId, options = {}) {
  if (
    Object.keys(options).some((key) => key !== 'retry') ||
    (options.retry !== undefined && typeof options.retry !== 'boolean')
  )
    fail('launch accepts only an optional boolean retry; executable settings belong in the plan.');
  const backend = backendIdentity({
    kind: 'process',
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    hostname: os.hostname(),
    ownerPid: process.pid,
  });
  const prepared = mutate(directory, runId, (root, run) => {
    const def = definition(run, taskId);
    if (!def?.execution) fail('launch needs a plan with an explicit execution contract.');
    begin(root, run, taskOf(run, taskId), { backend }, options.retry === true);
    const attempt = current(taskOf(run, taskId));
    attempt.process = {
      status: 'starting',
      owner: clone(backend),
      childPid: null,
      heartbeatAt: now(),
      collectedAt: null,
      runtimeHash: hash(fs.readFileSync(require.resolve('./nexus-process'))),
    };
  });
  const root = rootOf(directory);
  const def = definition(prepared, taskId);
  const attempt = current(taskOf(prepared, taskId));
  const binding = { attemptId: attempt.id, backend };
  function owned(run) {
    const activeAttempt = boundAttempt(taskOf(run, taskId), binding);
    if (
      !['starting', 'running'].includes(activeAttempt.process?.status) ||
      !['running', 'ambiguous'].includes(activeAttempt.execution)
    )
      fail('Original process no longer owns the active operation.');
    return activeAttempt;
  }
  let receipt;
  try {
    protectedSnapshot(root, def);
    const input = processBackend.inputBytes(root, def.execution, safeTarget);
    const environment = processBackend.executionEnvironment(def.execution, checkEnvironment());
    receipt = await processBackend.runOwnedProcess({
      root,
      execution: def.execution,
      input,
      environment,
      deadline: Date.parse(attempt.deadline),
      callbacks: {
        spawned: (pid) =>
          mutate(root, runId, (_root, run) => {
            const activeAttempt = owned(run);
            activeAttempt.process.status = 'running';
            activeAttempt.process.childPid = pid;
            activeAttempt.process.heartbeatAt = now();
          }),
        poll: () => {
          const activeAttempt = owned(loadRun(root, runId));
          return activeAttempt.cancellation.status === 'requested'
            ? 'cancellation-requested'
            : null;
        },
        heartbeat: () =>
          mutate(root, runId, (_root, run) => {
            const activeAttempt = owned(run);
            activeAttempt.process.heartbeatAt = now();
          }),
      },
    });
    Object.assign(receipt, {
      schemaVersion: 1,
      attemptId: attempt.id,
      backend,
      planHash: prepared.planHash,
      execution: clone(def.execution),
      inputSha256: hash(input),
      inputBytes: input.length,
      environment: environment.receipt,
      evidenceClass: 'owned-process-result',
      independentlyVerified: false,
    });
    try {
      protectedSnapshot(root, def);
      receipt.resultHashes = scopeSnapshot(root, def.scope);
    } catch (error) {
      receipt.outcome = 'ambiguous';
      receipt.snapshotError = error.message;
    }
  } catch (error) {
    receipt = {
      schemaVersion: 1,
      attemptId: attempt.id,
      backend,
      planHash: prepared.planHash,
      outcome: 'ambiguous',
      error: error.message,
      endedAt: now(),
      evidenceClass: 'launch-interrupted',
      independentlyVerified: false,
    };
  }
  return mutate(root, runId, (_root, run) => {
    const activeAttempt = owned(run);
    activeAttempt.process.status = 'finished';
    activeAttempt.process.receipt = receipt;
    activeAttempt.process.receiptHash = hash(JSON.stringify(receipt));
    activeAttempt.process.heartbeatAt = now();
    activeAttempt.observedAt = now();
    if (receipt.outcome === 'ambiguous') activeAttempt.execution = 'ambiguous';
    if (activeAttempt.cancellation.status === 'requested') {
      activeAttempt.cancellation.termination = receipt.directChildExited
        ? 'direct-child-exited-descendants-unobserved'
        : 'unresolved';
      activeAttempt.cancellation.processesSignalled = receipt.directChildSignalled
        ? [activeAttempt.process.childPid]
        : [];
    }
  });
}

function collectTask(directory, runId, taskId, input = {}) {
  return mutate(directory, runId, (root, run) => {
    const task = taskOf(run, taskId);
    const attempt = boundAttempt(task, input);
    if (attempt.backend.kind !== 'process') fail('collect requires an owned process attempt.');
    const operation = attempt.process;
    const receipt = operation?.receipt;
    if (operation?.status !== 'finished' || !receipt)
      fail('Process receipt is not ready; inspect the original owner.');
    if (operation.collectedAt) fail('This process receipt was already collected.');
    if (
      operation.receiptHash !== hash(JSON.stringify(receipt)) ||
      receipt.attemptId !== attempt.id ||
      !same(receipt.backend, attempt.backend) ||
      receipt.planHash !== run.planHash
    )
      fail('Foreign or corrupt process receipt.');
    if (attempt.reconciliations.length)
      fail('A reconciled attempt cannot be overwritten by a late process receipt.');
    if (receipt.outcome === 'completed') {
      if (
        attempt.cancellation.status !== 'none' ||
        receipt.exitCode !== 0 ||
        receipt.error ||
        !receipt.directChildExited ||
        !receipt.streamsClosed
      )
        fail('Ambiguous execution cannot be collected as completed.');
      protectedSnapshot(root, definition(run, taskId));
      if (!same(scopeSnapshot(root, definition(run, taskId).scope), receipt.resultHashes))
        fail('Process result changed before collection; reconcile and create a fresh attempt.');
    }
    operation.collectedAt = now();
    attempt.execution = attempt.cancellation.status === 'requested' ? 'ambiguous' : receipt.outcome;
    attempt.observedAt = now();
    if (['completed', 'failed'].includes(attempt.execution)) attempt.endedAt = receipt.endedAt;
    if (receipt.resultHashes) attempt.resultHashes = clone(receipt.resultHashes);
    if (attempt.execution === 'blocked')
      attempt.blockedRequest =
        'Executable reported a blocked operation; inspect the receipt and existing authorization. No approval is inferred.';
    attempt.observations.push({
      at: now(),
      outcome: attempt.execution,
      evidenceClass: 'owned-process-result',
      receiptHash: operation.receiptHash,
      independentlyVerified: false,
      summary: 'Collected the exact foreground supervisor result. Verification remains separate.',
    });
  });
}

function runCheck(root, check, attemptId, environment) {
  const startedAt = now();
  return new Promise((resolve) => {
    let child;
    let timer;
    let settled = false;
    let timedOut = false;
    let outputBytes = 0;
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let spawnError = null;
    function append(kind, buffer) {
      const remaining = MAX_OUTPUT_BYTES - outputBytes;
      if (buffer.length > remaining) truncated = true;
      const selected = buffer.subarray(0, Math.max(0, remaining));
      outputBytes += selected.length;
      if (kind === 'stdout') stdout += selected.toString('utf8');
      else stderr += selected.toString('utf8');
    }
    function finish(exitCode, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        id: check.id,
        attemptId,
        command: check.command,
        commandHash: check.commandHash,
        args: check.args,
        cwd: check.cwd,
        timeoutMs: check.timeoutMs,
        environment: clone(environment),
        startedAt,
        endedAt: now(),
        exitCode,
        signal,
        error: spawnError,
        timedOut,
        stdout,
        stderr,
        outputTruncated: truncated,
        outputHash: hash(stdout + '\0' + stderr),
        evidenceClass: 'runtime-command',
        termination: timedOut
          ? 'owned-direct-child-only; descendant effects require inspection'
          : null,
      });
    }
    try {
      child = spawn(check.command, check.args, {
        cwd: directoryAt(root, check.cwd),
        env: environment.values,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => append('stdout', chunk));
      child.stderr.on('data', (chunk) => append('stderr', chunk));
      child.on('error', (error) => {
        spawnError = error.message;
        finish(null, null);
      });
      child.on('close', finish);
      timer = setTimeout(() => {
        timedOut = true;
        // Signal only the child object created here; there is no PID lookup or
        // tree-wide kill. Descendants are outside this first backend contract.
        child.kill('SIGKILL');
        child.stdout.destroy();
        child.stderr.destroy();
        finish(null, 'SIGKILL');
      }, check.timeoutMs);
    } catch (error) {
      spawnError = error.message;
      finish(null, null);
    }
  });
}

async function verifyTask(directory, runId, taskId) {
  const verificationId = crypto.randomUUID();
  const environment = checkEnvironment();
  const prepared = mutate(directory, runId, (root, run) => {
    const task = taskOf(run, taskId);
    const attempt = current(task);
    const def = definition(run, taskId);
    if (
      !attempt ||
      attempt.execution !== 'completed' ||
      attempt.cancellation.status === 'requested' ||
      task.integration === 'accepted'
    )
      fail('Verification requires completed, unaccepted, reconciled work.');
    if (attempt.verification.status !== 'pending')
      fail('Verification already exists; inspect/reconcile or retry before executing again.');
    if (attempt.verificationRounds >= def.maxAttempts)
      fail('Verification restart limit reached; reconcile and create a new attempt.');
    protectedSnapshot(root, def);
    const scopeHashes = scopeSnapshot(root, def.scope);
    if (!same(scopeHashes, attempt.resultHashes))
      fail('Artifacts changed after the worker result; reconcile the current result first.');
    attempt.verificationRounds += 1;
    attempt.verification = {
      id: verificationId,
      attemptId: attempt.id,
      status: 'running',
      startedAt: now(),
      frameworkVersion: FRAMEWORK_VERSION,
      environment: clone(environment),
      owner: { pid: process.pid, hostname: os.hostname() },
      revision: revision(root),
      scopeHashes,
      artifactHashes: filesSnapshot(root, def.artifacts),
      resourceHashes: clone(def.resourceHashes),
      checks: [],
    };
  });
  const root = rootOf(directory);
  const def = definition(prepared, taskId);
  const attemptId = current(taskOf(prepared, taskId)).id;
  for (const check of def.checks) {
    const before = loadRun(root, runId);
    const activeAttempt = current(taskOf(before, taskId));
    if (
      activeAttempt.id !== attemptId ||
      activeAttempt.verification.id !== verificationId ||
      activeAttempt.verification.status !== 'running'
    )
      fail('Verification ownership changed; no further command was launched.');
    if (activeAttempt.cancellation.status === 'requested') break;
    let receipt;
    try {
      protectedSnapshot(root, def);
      if (!same(scopeSnapshot(root, def.scope), activeAttempt.verification.scopeHashes))
        fail('Checked files changed before the next verification command.');
      receipt = await runCheck(root, check, attemptId, environment);
      receipt.artifactHashes = clone(activeAttempt.verification.artifactHashes);
      receipt.scopeSnapshotHash = hash(JSON.stringify(activeAttempt.verification.scopeHashes));
    } catch (error) {
      receipt = {
        id: check.id,
        attemptId,
        exitCode: null,
        error: error.message,
        evidenceClass: 'runtime-preflight',
        startedAt: now(),
        endedAt: now(),
      };
    }
    const saved = mutate(root, runId, (_root, run) => {
      const attempt = current(taskOf(run, taskId));
      if (
        attempt.id !== attemptId ||
        attempt.verification.id !== verificationId ||
        attempt.verification.status !== 'running'
      )
        fail('Stale verification result was rejected.');
      attempt.verification.checks.push(receipt);
    });
    if (
      receipt.exitCode !== 0 ||
      receipt.error ||
      receipt.signal ||
      current(taskOf(saved, taskId)).cancellation.status === 'requested'
    )
      break;
  }
  return mutate(root, runId, (_root, run) => {
    const task = taskOf(run, taskId);
    const attempt = current(task);
    if (
      attempt.id !== attemptId ||
      attempt.verification.id !== verificationId ||
      attempt.verification.status !== 'running'
    )
      fail('Stale verification finalization was rejected.');
    let problem = null;
    try {
      protectedSnapshot(root, def);
      if (
        !same(scopeSnapshot(root, def.scope), attempt.verification.scopeHashes) ||
        !same(filesSnapshot(root, def.artifacts), attempt.verification.artifactHashes)
      )
        problem = 'Checked files changed during verification.';
    } catch (error) {
      problem = error.message;
    }
    const checks = attempt.verification.checks;
    const uncertain =
      checks.some((check) => check.timedOut) || attempt.cancellation.status === 'requested';
    const passed =
      !problem &&
      !uncertain &&
      checks.length === def.checks.length &&
      checks.every((check) => check.exitCode === 0 && !check.error && !check.signal);
    attempt.verification.status = uncertain ? 'ambiguous' : passed ? 'passed' : 'failed';
    attempt.verification.problem = problem;
    attempt.verification.endedAt = now();
    if (!passed) task.integration = 'rejected';
  });
}

function acceptTask(directory, runId, taskId) {
  return mutate(directory, runId, (root, run) => {
    const task = taskOf(run, taskId);
    if (task.integration === 'accepted') fail('Task is already accepted.');
    evidenceCurrent(root, run, task);
    task.integration = 'accepted';
    task.acceptedAt = now();
    task.integrationReceipt = {
      attemptId: current(task).id,
      artifactHashes: clone(current(task).verification.artifactHashes),
      action: 'accept-current-workspace',
      gitOperation: null,
    };
  });
}

module.exports = {
  createRun,
  inspectRun,
  startTask,
  recordAttempt,
  reconcileAttempt,
  verifyTask,
  retryTask,
  cancelTask,
  acceptTask,
  recoverLock,
  launchTask,
  collectTask,
  BASE,
  LOCK,
  RECOVERY_LOCK,
};
