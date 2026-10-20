/**
 * Security assurance cases bound to executed checks. A case states claims, argues each one
 * and supports it with evidence. The only admissible evidence is a check this module ran and
 * recorded in a hash-chained ledger: the command, its exit code, a digest of its output and
 * the digests of the artifacts it left. `verifyCase` refuses a claim whose evidence is
 * missing, failed or stale, and a case never admits evidence that is only asserted.
 *
 * The chain shows an accidental or careless edit. Against someone who can write the ledger
 * it needs two things from outside the file: a key (BMAD_PLUS_ASSURANCE_KEY) that
 * authenticates every record, and the head digest `run` reports, which verify checks is
 * still in the chain so that removed runs are noticed.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { parseControls } = require('./control-refs');
const { redact } = require('./redact');

const CASE_SCHEMA = 'bmad-plus/assurance-case/1';
const RUN_SCHEMA = 'bmad-plus/assurance-run/1';
const VERDICT_SCHEMA = 'bmad-plus/assurance-verdict/1';
const CHECK_SCHEMA = 'bmad-plus/assurance-check/1';
const DEFAULT_DIR = '_bmad-output/assurance';
const LEDGER = 'runs.jsonl';
const KEY_VARIABLE = 'BMAD_PLUS_ASSURANCE_KEY';
const MIN_KEY_LENGTH = 32;
const TEMPLATE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'bmad-plus',
  'packs',
  'pack-shield',
  'shared',
  'assurance-case-template.yaml'
);

const ID = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const CLAIM_ID = /^[A-Za-z0-9][A-Za-z0-9.-]{0,31}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const CASE_KEYS = ['schema', 'id', 'title', 'scope', 'freshness', 'checks', 'claims'];
const FRESHNESS_KEYS = ['maxAgeDays', 'sameCommit'];
const CHECK_KEYS = ['id', 'run', 'cwd', 'env', 'timeoutSeconds', 'expect', 'artifacts'];
const CLAIM_KEYS = ['id', 'claim', 'parent', 'argument', 'controls', 'evidence'];
const EVIDENCE_KEYS = ['check', 'shows'];

const MAX_CASE_BYTES = 256 * 1024;
const MAX_LEDGER_BYTES = 16 * 1024 * 1024;
const MAX_TEXT = 4000;
const EXCERPT_BYTES = 2048;
const DEFAULT_TIMEOUT_SECONDS = 600;
const MAX_TIMEOUT_SECONDS = 6 * 3600;
const DEFAULT_MAX_AGE_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const EXIT = { supported: 0, unsupported: 1 };
const BOM = String.fromCharCode(0xfeff);

/**
 * What a check inherits from the caller: enough to find programs and a temporary folder.
 * Anything else, credentials included, reaches it only when the case names the variable.
 */
const ENVIRONMENT_KEYS = [
  'PATH',
  'HOME',
  'TEMP',
  'TMP',
  'TMPDIR',
  'SYSTEMROOT',
  'WINDIR',
  'SYSTEMDRIVE',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'PATHEXT',
  'COMSPEC',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest('hex');

function fail(message) {
  throw new Error(message);
}

function only(value, keys, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${where}: must be a mapping`);
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length) fail(`${where}: unknown key(s) ${unknown.join(', ')}`);
  return value;
}

function text(value, where) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT || value.includes('\0'))
    fail(`${where}: expected text of 1 to ${MAX_TEXT} characters`);
  return value.trim();
}

/** A project-relative path written with `/` that cannot leave the project. */
function relativePath(value, where) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.split('/').some((part) => part === '..' || part === '')
  )
    fail(`${where}: "${value}" must be a relative path inside the project, written with /`);
  return value;
}

/** The absolute path of a project-relative one; no component may be a symbolic link. */
function resolveInside(projectDir, relative, where) {
  const root = fs.realpathSync(projectDir);
  const target = path.resolve(root, relative);
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat = null;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (stat && stat.isSymbolicLink()) fail(`${where}: ${relative} passes through a symbolic link`);
  }
  return target;
}

function readBounded(file, maxBytes, where) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) fail(`${where}: ${file} is not a regular file`);
  if (stat.size > maxBytes) fail(`${where}: ${file} exceeds ${maxBytes} bytes`);
  const content = fs.readFileSync(file, 'utf8');
  return content.startsWith(BOM) ? content.slice(1) : content;
}

/** SHA-256 of a file read in chunks, or null when it is absent or not a regular file. */
function fileDigest(file) {
  let fd;
  try {
    if (!fs.lstatSync(file).isFile()) return null;
    fd = fs.openSync(file, 'r');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.alloc(1024 * 1024);
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0)
      hash.update(buffer.subarray(0, read));
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function parseCheck(raw, index, where) {
  const at = `${where}: check ${raw?.id ?? index + 1}`;
  only(raw, CHECK_KEYS, at);
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) fail(`${at}: invalid id`);
  if (
    !Array.isArray(raw.run) ||
    !raw.run.length ||
    !raw.run[0] ||
    !raw.run.every(
      (arg) => typeof arg === 'string' && arg.length <= MAX_TEXT && !arg.includes('\0')
    )
  )
    fail(`${at}: run must be the command as a list of arguments; no shell is involved`);
  const cwd = relativePath(raw.cwd ?? '.', `${at}: cwd`);
  const env = raw.env ?? [];
  if (!Array.isArray(env) || !env.every((name) => typeof name === 'string' && ENV_NAME.test(name)))
    fail(`${at}: env must list environment variable names`);
  // A check that could read the key could write records the key authenticates.
  if (env.some((name) => name.toUpperCase() === KEY_VARIABLE))
    fail(`${at}: ${KEY_VARIABLE} is never passed to a check`);
  const timeoutSeconds = raw.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > MAX_TIMEOUT_SECONDS
  )
    fail(`${at}: timeoutSeconds must be a whole number from 1 to ${MAX_TIMEOUT_SECONDS}`);
  const expected = only(raw.expect ?? {}, ['exitCode'], `${at}: expect`);
  const exitCode = expected.exitCode ?? 0;
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255)
    fail(`${at}: expect.exitCode must be a whole number from 0 to 255`);
  const artifacts = raw.artifacts ?? [];
  if (!Array.isArray(artifacts)) fail(`${at}: artifacts must be a list of paths`);
  for (const file of artifacts) relativePath(file, `${at}: artifact`);
  if (new Set(artifacts).size !== artifacts.length) fail(`${at}: an artifact is listed twice`);
  // What was executed: a different command, folder or inherited variable is another check.
  const command = { run: [...raw.run], cwd, env: [...new Set(env)].sort() };
  return {
    id: raw.id,
    ...command,
    timeoutSeconds,
    exitCode,
    artifacts: [...artifacts],
    commandSha256: sha256(JSON.stringify(command)),
  };
}

function parseClaim(raw, index, where, checks, claims) {
  const at = `${where}: claim ${raw?.id ?? index + 1}`;
  only(raw, CLAIM_KEYS, at);
  if (typeof raw.id !== 'string' || !CLAIM_ID.test(raw.id)) fail(`${at}: invalid id`);
  if (claims.has(raw.id)) fail(`${at}: duplicate id`);
  if (raw.parent !== undefined && !claims.has(raw.parent))
    fail(`${at}: parent ${raw.parent} must be a claim declared before it`);
  const evidence = raw.evidence ?? [];
  if (!Array.isArray(evidence)) fail(`${at}: evidence must be a list`);
  return {
    id: raw.id,
    parent: raw.parent ?? null,
    claim: text(raw.claim, `${at}: claim`),
    argument: text(raw.argument, `${at}: argument`),
    controls: raw.controls === undefined ? [] : parseControls(raw.controls, at),
    evidence: evidence.map((item, i) => {
      const where2 = `${at}: evidence ${i + 1}`;
      if (!item || typeof item !== 'object' || typeof item.check !== 'string')
        fail(
          `${where2}: evidence must name a check that runs (check: <id>); a statement, document or link is only asserted`
        );
      only(item, EVIDENCE_KEYS, where2);
      if (!checks.has(item.check)) fail(`${where2}: check ${item.check} is not declared`);
      return { check: item.check, shows: text(item.shows, `${where2}: shows`) };
    }),
  };
}

/** Validate a parsed case document. Throws on the first defect, with where it is. */
function parseCase(doc, where = 'assurance case') {
  only(doc, CASE_KEYS, where);
  if (doc.schema !== CASE_SCHEMA) fail(`${where}: schema must be "${CASE_SCHEMA}"`);
  if (typeof doc.id !== 'string' || !ID.test(doc.id))
    fail(`${where}: id must use lowercase letters, digits, dots and dashes`);
  const freshness = only(doc.freshness ?? {}, FRESHNESS_KEYS, `${where}: freshness`);
  const maxAgeDays = freshness.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 366)
    fail(`${where}: freshness.maxAgeDays must be a whole number of days from 1 to 366`);
  const sameCommit = freshness.sameCommit ?? true;
  if (typeof sameCommit !== 'boolean') fail(`${where}: freshness.sameCommit must be true or false`);
  if (!Array.isArray(doc.checks) || !doc.checks.length)
    fail(`${where}: checks must list the commands that produce the evidence`);
  const checks = new Map();
  doc.checks.forEach((raw, index) => {
    const check = parseCheck(raw, index, where);
    if (checks.has(check.id)) fail(`${where}: check ${check.id}: duplicate id`);
    checks.set(check.id, check);
  });
  if (!Array.isArray(doc.claims) || !doc.claims.length)
    fail(`${where}: claims must list at least one claim`);
  const claims = new Map();
  doc.claims.forEach((raw, index) => {
    const claim = parseClaim(raw, index, where, checks, claims);
    claims.set(claim.id, claim);
  });
  const parents = new Set([...claims.values()].map((claim) => claim.parent).filter(Boolean));
  for (const claim of claims.values())
    if (!claim.evidence.length && !parents.has(claim.id))
      fail(
        `${where}: claim ${claim.id} is only asserted; support it with evidence from a check or with sub-claims`
      );
  return {
    id: doc.id,
    title: text(doc.title, `${where}: title`),
    scope: text(doc.scope, `${where}: scope`),
    freshness: { maxAgeDays, sameCommit },
    checks,
    claims,
  };
}

/** Read and validate a case file inside the project. */
function loadCase(projectDir, file) {
  const relative = relativePath(String(file).split(path.sep).join('/'), 'case file');
  const absolute = resolveInside(projectDir, relative, 'case file');
  if (!fs.existsSync(absolute)) fail(`no assurance case at ${relative}`);
  const source = readBounded(absolute, MAX_CASE_BYTES, relative);
  let doc;
  try {
    doc = yaml.load(source);
  } catch (error) {
    fail(`${relative}: ${error.message}`);
  }
  return { ...parseCase(doc, relative), file: relative, sha256: sha256(source) };
}

/**
 * Start a case from the Shield template at a new `<id>.yaml` path, the id taken from the
 * file name. Never overwrites; the result is checked to load before it is written.
 */
function initCase(projectDir, file) {
  const relative = relativePath(String(file).split(path.sep).join('/'), 'case file');
  const id = path.posix.basename(relative).replace(/\.ya?ml$/i, '');
  if (id === path.posix.basename(relative) || !ID.test(id))
    fail(`case file: name it <id>.yaml with an id of lowercase letters, digits, dots and dashes`);
  const absolute = resolveInside(projectDir, relative, 'case file');
  const source = readBounded(TEMPLATE, MAX_CASE_BYTES, 'template').replace(
    /^id: .*$/m,
    `id: ${id}`
  );
  parseCase(yaml.load(source), 'template');
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  try {
    fs.writeFileSync(absolute, source, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') fail(`${relative} already exists`);
    throw error;
  }
  return { file: relative, id };
}

function ledgerFile(projectDir, dir, caseId) {
  relativePath(dir, '--dir');
  return resolveInside(projectDir, `${dir}/${caseId}/${LEDGER}`, 'ledger');
}

/** The ledger key from the option, else the environment; null when neither sets one. */
function ledgerKey(key = process.env[KEY_VARIABLE]) {
  if (key === null || key === undefined || key === '') return null;
  if (typeof key !== 'string' || key.length < MIN_KEY_LENGTH)
    fail(`${KEY_VARIABLE} must hold at least ${MIN_KEY_LENGTH} characters`);
  return key;
}

/**
 * The recorded runs, in order. Each record names the digest of the one before it and carries
 * its own digest, so an edited or reordered record, or one removed before the last, breaks
 * the chain. Removing the last records leaves a valid chain: only a head kept outside the
 * file (verify --ledger-head) shows it. The digests are unkeyed, so whoever can write the
 * file can also write a valid record; with a key, every record must carry its HMAC. Reading
 * stops at the first break; everything after it is unusable.
 */
function readLedger(file, { key = null } = {}) {
  if (!fs.existsSync(file)) return { records: [], errors: [] };
  const lines = readBounded(file, MAX_LEDGER_BYTES, 'ledger').split('\n');
  const records = [];
  let previous = null;
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const at = `record ${records.length + 1} (line ${index + 1})`;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      return { records, errors: [`${at} is not JSON`] };
    }
    const { sha256: recorded, hmac: mac, ...body } = record || {};
    if (body.schema !== RUN_SCHEMA) return { records, errors: [`${at} is not ${RUN_SCHEMA}`] };
    if (body.sequence !== records.length + 1)
      return { records, errors: [`${at} is out of sequence`] };
    if (body.previous !== previous)
      return { records, errors: [`${at} does not follow the record before it`] };
    if (sha256(JSON.stringify(body)) !== recorded)
      return { records, errors: [`${at} was altered after it was written`] };
    if (
      key &&
      !(
        typeof mac === 'string' &&
        DIGEST.test(mac) &&
        crypto.timingSafeEqual(
          Buffer.from(mac, 'hex'),
          Buffer.from(hmac(key, JSON.stringify(body)), 'hex')
        )
      )
    )
      return { records, errors: [`${at} is not authenticated by ${KEY_VARIABLE}`] };
    records.push(record);
    previous = recorded;
  }
  return { records, errors: [] };
}

function git(projectDir, args) {
  const result = spawnSync('git', args, {
    cwd: projectDir,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: 10000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.status === 0 && !result.error ? result.stdout : null;
}

/** What a case writes, relative to the project: its ledger folder and declared artifacts. */
function outputsOf(kase, dir) {
  return [
    `${path.posix.join(dir, kase.id)}/`,
    ...[...kase.checks.values()].flatMap((check) => check.artifacts),
  ];
}

/**
 * The commit checked out and whether the working tree differs from it: a tracked file
 * changed, or an untracked file git does not ignore, since that can decide a check as
 * surely as a committed one. The case's own outputs do not count. Nulls outside git.
 */
function revisionOf(projectDir, outputs = []) {
  const head = git(projectDir, ['rev-parse', '--verify', 'HEAD']);
  if (!head || !/^[0-9a-f]{40,64}$/.test(head.trim())) return { revision: null, dirty: null };
  const tracked = git(projectDir, ['status', '--porcelain', '--untracked-files=no']);
  const untracked = git(projectDir, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (tracked === null || untracked === null) return { revision: head.trim(), dirty: null };
  const isOutput = (file) =>
    outputs.some((output) => (output.endsWith('/') ? file.startsWith(output) : file === output));
  return {
    revision: head.trim(),
    dirty: tracked.trim() !== '' || untracked.split('\0').some((file) => file && !isOutput(file)),
  };
}

function checkEnvironment(names) {
  const inherited = Object.keys(process.env);
  const values = {};
  for (const key of [...ENVIRONMENT_KEYS, ...names]) {
    // Windows variable names are case-insensitive; elsewhere only the exact name counts.
    const source =
      inherited.find((name) => name === key) ??
      (process.platform === 'win32'
        ? inherited.find((name) => name.toUpperCase() === key.toUpperCase())
        : undefined);
    if (source !== undefined) values[key] = process.env[source];
  }
  return values;
}

/**
 * Run one check without a shell. The whole output is hashed as it arrives; only its last
 * bytes are kept, passed through the redaction floor, as a reading aid.
 */
function execute(projectDir, check, now) {
  const cwd = resolveInside(projectDir, check.cwd, `check ${check.id}: cwd`);
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory())
    fail(`check ${check.id}: cwd ${check.cwd} is not a folder`);
  const startedAt = now();
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    let tail = Buffer.alloc(0);
    let timedOut = false;
    let settled = false;
    let error = null;
    let timer = null;
    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const endedAt = now();
      resolve({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt - startedAt,
        exitCode: timedOut || error ? null : exitCode,
        signal: signal || null,
        timedOut,
        error,
        output: {
          bytes,
          sha256: hash.digest('hex'),
          excerpt: redact(tail.toString('utf8'), { maxLength: EXCERPT_BYTES }).text,
          truncated: bytes > tail.length,
        },
      });
    };
    const collect = (chunk) => {
      hash.update(chunk);
      bytes += chunk.length;
      tail = Buffer.concat([tail, chunk]);
      if (tail.length > EXCERPT_BYTES) tail = tail.subarray(tail.length - EXCERPT_BYTES);
    };
    let child;
    try {
      child = spawn(check.run[0], check.run.slice(1), {
        cwd,
        env: checkEnvironment(check.env),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (spawnError) {
      error = spawnError.message;
      finish(null, null);
      return;
    }
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (spawnError) => {
      error = spawnError.message;
      finish(null, null);
    });
    child.on('close', finish);
    timer = setTimeout(() => {
      timedOut = true;
      // Only the child started here is signalled; a descendant holding the pipes open must
      // not keep the run waiting, so the streams are closed and the run settles now.
      child.kill('SIGKILL');
      child.stdout.destroy();
      child.stderr.destroy();
      finish(null, 'SIGKILL');
    }, check.timeoutSeconds * 1000);
  });
}

/** Each declared artifact's digest and modification time, or null when it is absent. */
function artifactStates(projectDir, check) {
  return Object.fromEntries(
    check.artifacts.map((file) => {
      const absolute = resolveInside(projectDir, file, `check ${check.id}: artifact`);
      const digest = fileDigest(absolute);
      return [file, digest && { digest, mtime: fs.lstatSync(absolute, { bigint: true }).mtimeNs }];
    })
  );
}

/**
 * The digest of each artifact the run wrote. A file left as it was before the run, same
 * bytes and same modification time, was not produced by it and is recorded as null.
 */
function producedArtifacts(projectDir, check, before) {
  const after = artifactStates(projectDir, check);
  return Object.fromEntries(
    check.artifacts.map((file) => {
      const was = before[file];
      const is = after[file];
      const untouched = was && is && was.digest === is.digest && was.mtime === is.mtime;
      return [file, is && !untouched ? is.digest : null];
    })
  );
}

/** Whether a recorded run did what its check expects, before any question of freshness. */
function runFailures(check, run) {
  const failures = [];
  if (run.error) failures.push(`it did not start: ${run.error}`);
  else if (run.timedOut) failures.push(`it timed out after ${check.timeoutSeconds} s`);
  else if (run.exitCode !== check.exitCode)
    failures.push(`exit code ${run.exitCode ?? 'none'}, expected ${check.exitCode}`);
  for (const file of check.artifacts)
    if (run.artifacts?.[file] === null)
      failures.push(`artifact ${file} was not produced by the run`);
  return failures;
}

/**
 * Execute the case's checks (or the named ones) and append one record per check to the
 * ledger, authenticated when a key is set. A lock file keeps two runs from interleaving
 * their records. Returns the new head, to be kept outside the ledger.
 */
async function runChecks(projectDir, kase, { dir = DEFAULT_DIR, only: ids = [], now, key } = {}) {
  const clock = now || (() => new Date());
  const secret = ledgerKey(key);
  const outputs = outputsOf(kase, dir);
  const selected = ids.length
    ? ids.map((id) => kase.checks.get(id) || fail(`check ${id} is not declared in ${kase.id}`))
    : [...kase.checks.values()];
  const file = ledgerFile(projectDir, dir, kase.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let handle;
  try {
    handle = fs.openSync(lock, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      fail(`another run holds ${lock}; delete it only if no run is in progress`);
    throw error;
  }
  try {
    const ledger = readLedger(file, { key: secret });
    if (ledger.errors.length)
      fail(
        `the ledger ${file} is not intact (${ledger.errors[0]}); keep it for inspection and record into another --dir`
      );
    let previous = ledger.records.length ? ledger.records.at(-1).sha256 : null;
    let sequence = ledger.records.length;
    const results = [];
    for (const check of selected) {
      const { revision, dirty } = revisionOf(projectDir, outputs);
      const before = artifactStates(projectDir, check);
      const outcome = await execute(projectDir, check, clock);
      const body = {
        schema: RUN_SCHEMA,
        case: kase.id,
        check: check.id,
        sequence: ++sequence,
        commandSha256: check.commandSha256,
        run: check.run,
        cwd: check.cwd,
        env: check.env,
        revision,
        dirty,
        ...outcome,
        artifacts: producedArtifacts(projectDir, check, before),
        previous,
      };
      const serialized = JSON.stringify(body);
      const record = {
        ...body,
        ...(secret ? { hmac: hmac(secret, serialized) } : {}),
        sha256: sha256(serialized),
      };
      const fd = fs.openSync(file, 'a');
      try {
        fs.writeSync(fd, `${JSON.stringify(record)}\n`);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      previous = record.sha256;
      results.push({ check: check.id, failures: runFailures(check, record), record });
    }
    return { file, results, head: previous, authenticated: Boolean(secret) };
  } finally {
    fs.closeSync(handle);
    fs.rmSync(lock, { force: true });
  }
}

/** passed, failed, stale or missing — with every reason, for one check's latest run. */
function judgeCheck(projectDir, kase, check, run, state, now) {
  if (!run) return { status: 'missing', reasons: ['it never ran'], run: null };
  const stale = [];
  if (run.commandSha256 !== check.commandSha256) stale.push('its command changed since it ran');
  if (kase.freshness.sameCommit) {
    if (run.dirty !== false)
      stale.push('it ran on uncommitted changes, untracked files or outside git');
    else if (run.revision !== state.revision)
      stale.push(
        `it ran at ${String(run.revision).slice(0, 12)}, not at ${String(state.revision).slice(0, 12)}`
      );
  }
  const ended = Date.parse(run.endedAt);
  if (!Number.isFinite(ended) || ended > now.getTime() + CLOCK_SKEW_MS)
    stale.push('its end time is missing or in the future');
  else if (now.getTime() - ended > kase.freshness.maxAgeDays * DAY_MS)
    stale.push(
      `it ran ${Math.floor((now.getTime() - ended) / DAY_MS)} days ago; the case accepts ${kase.freshness.maxAgeDays}`
    );
  for (const file of check.artifacts) {
    const recorded = run.artifacts?.[file];
    if (recorded === undefined) stale.push(`artifact ${file} was not recorded by that run`);
    else if (
      recorded !== null &&
      fileDigest(resolveInside(projectDir, file, `check ${check.id}: artifact`)) !== recorded
    )
      stale.push(`artifact ${file} changed since the run`);
  }
  const failures = runFailures(check, run);
  return {
    status: failures.length ? 'failed' : stale.length ? 'stale' : 'passed',
    reasons: [...failures, ...stale],
    run: {
      sequence: run.sequence,
      sha256: run.sha256,
      endedAt: run.endedAt,
      exitCode: run.exitCode,
      revision: run.revision,
    },
  };
}

/**
 * The verdict on a case: every check judged on its latest run, every claim supported only
 * when all its evidence passed and all its sub-claims are supported. `head` is a record
 * digest kept from an earlier `run`: the ledger must still contain it.
 */
function verifyCase(projectDir, kase, { dir = DEFAULT_DIR, now, key, head: anchor = null } = {}) {
  const at = (now || (() => new Date()))();
  if (anchor !== null && !(typeof anchor === 'string' && DIGEST.test(anchor)))
    fail('the ledger head must be a record digest of 64 lowercase hexadecimal characters');
  const secret = ledgerKey(key);
  const file = ledgerFile(projectDir, dir, kase.id);
  const ledger = readLedger(file, { key: secret });
  const state = revisionOf(projectDir, outputsOf(kase, dir));
  const reasons = [];
  if (ledger.errors.length) reasons.push(`the ledger is not intact: ${ledger.errors[0]}`);
  else if (anchor && !ledger.records.some((record) => record.sha256 === anchor))
    reasons.push(
      `the ledger no longer holds the head ${anchor.slice(0, 12)} it was anchored to: runs were removed or the ledger replaced`
    );
  if (kase.freshness.sameCommit) {
    if (!state.revision)
      reasons.push(
        'there is no commit to bind the evidence to (freshness.sameCommit: false for a project outside git)'
      );
    else if (state.dirty)
      reasons.push(
        'the working tree has uncommitted changes or untracked files: the evidence describes the commit, not this working tree'
      );
  }
  const latest = new Map();
  if (!ledger.errors.length)
    for (const record of ledger.records)
      if (record.case === kase.id) latest.set(record.check, record);
  const checks = {};
  for (const check of kase.checks.values())
    checks[check.id] = judgeCheck(projectDir, kase, check, latest.get(check.id), state, at);

  const judged = new Map();
  const declared = [...kase.claims.values()];
  // Sub-claims are declared after their parent, so the reverse order judges children first.
  for (const claim of [...declared].reverse()) {
    const why = [
      ...claim.evidence
        .filter(({ check }) => checks[check].status !== 'passed')
        .map(({ check }) => `evidence ${check} is ${checks[check].status}`),
      ...declared
        .filter((child) => child.parent === claim.id && judged.get(child.id).status !== 'supported')
        .map((child) => `sub-claim ${child.id} is unsupported`),
    ];
    judged.set(claim.id, {
      id: claim.id,
      parent: claim.parent,
      claim: claim.claim,
      status: why.length ? 'unsupported' : 'supported',
      controls: claim.controls,
      evidence: claim.evidence.map((item) => ({ ...item, status: checks[item.check].status })),
      reasons: why,
    });
  }
  const claims = declared.map((claim) => judged.get(claim.id));
  const status =
    !reasons.length && claims.every((claim) => claim.status === 'supported')
      ? 'supported'
      : 'unsupported';
  const controlsOf = (wanted) => [
    ...new Set(claims.filter((c) => c.status === wanted).flatMap((c) => c.controls)),
  ];
  return {
    schema: VERDICT_SCHEMA,
    case: kase.id,
    caseSha256: kase.sha256 || null,
    revision: state.revision,
    status,
    exitCode: EXIT[status],
    reasons,
    ledger: {
      file: path.relative(fs.realpathSync(projectDir), file).split(path.sep).join('/'),
      runs: ledger.records.length,
      head: ledger.records.length ? ledger.records.at(-1).sha256 : null,
      anchor,
      authenticated: Boolean(secret),
    },
    checks,
    claims,
    controls: { supported: controlsOf('supported'), unsupported: controlsOf('unsupported') },
  };
}

/** The verdict as a CI check result; like the review check, it holds no timestamp. */
function checkResult(verdict) {
  const lines = [
    `Assurance case \`${verdict.case}\`: **${verdict.status}** at \`${String(verdict.revision).slice(0, 12)}\`.`,
    `Ledger: ${verdict.ledger.runs} run(s), ${verdict.ledger.authenticated ? 'authenticated by key' : 'not keyed'}, ${verdict.ledger.anchor ? `anchored at \`${verdict.ledger.anchor.slice(0, 12)}\`` : 'not anchored'}.`,
    '',
    ...verdict.reasons.map((reason) => `- ${reason}`),
    ...(verdict.reasons.length ? [''] : []),
    '| Claim | Status | Why |',
    '| --- | --- | --- |',
    ...verdict.claims.map(
      (claim) =>
        `| ${claim.id} | ${claim.status} | ${claim.reasons.join('; ').replace(/\|/g, '/') || '—'} |`
    ),
  ];
  return {
    schema: CHECK_SCHEMA,
    case: verdict.case,
    caseSha256: verdict.caseSha256,
    revision: verdict.revision,
    status: verdict.status,
    exitCode: verdict.exitCode,
    reasons: verdict.reasons,
    ledger: {
      runs: verdict.ledger.runs,
      head: verdict.ledger.head,
      anchor: verdict.ledger.anchor,
      authenticated: verdict.ledger.authenticated,
    },
    claims: verdict.claims.map(({ id, status, reasons }) => ({ id, status, reasons })),
    controls: verdict.controls,
    github: {
      name: `bmad-plus assurance ${verdict.case}`,
      conclusion: verdict.status === 'supported' ? 'success' : 'failure',
      output: {
        title: `${verdict.claims.filter((c) => c.status === 'supported').length}/${verdict.claims.length} claims supported`,
        summary: lines.join('\n'),
      },
    },
  };
}

module.exports = {
  CASE_SCHEMA,
  RUN_SCHEMA,
  VERDICT_SCHEMA,
  CHECK_SCHEMA,
  DEFAULT_DIR,
  KEY_VARIABLE,
  parseCase,
  loadCase,
  initCase,
  readLedger,
  ledgerFile,
  runChecks,
  verifyCase,
  checkResult,
};
