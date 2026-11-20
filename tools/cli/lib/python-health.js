/** Opt-in verification of an existing pack environment. Never installs a runtime. */
const fs = require('node:fs');
const path = require('node:path');
const { MIN_PYTHON, venvPython, defaultRunner } = require('./python-provision');

const TIMEOUT_MS = 15_000;
const MAX_BUFFER = 64 * 1024;
const MODULE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;

// -I excludes project/PYTHONPATH imports; -B avoids bytecode writes. Importing
// installed dependencies still executes their code, so callers must opt in.
const PROBE = [
  'import contextlib, importlib, json, os, sys',
  'expected, minimum, names = sys.argv[1], json.loads(sys.argv[2]), json.loads(sys.argv[3])',
  'normalize = lambda value: os.path.normcase(os.path.realpath(value))',
  'prefix, base = normalize(sys.prefix), normalize(sys.base_prefix)',
  'version = list(sys.version_info[:3])',
  'checks = [{"name": name, "status": "not-verified"} for name in names]',
  'if prefix == normalize(expected) and prefix != base and version >= minimum:',
  '    with open(os.devnull, "w", encoding="utf-8") as sink:',
  '        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):',
  '            for check in checks:',
  '                try:',
  '                    importlib.import_module(check["name"])',
  '                    check["status"] = "verified"',
  '                except BaseException:',
  '                    check["status"] = "failed"',
  'print(json.dumps({"schemaVersion": 1, "prefix": prefix, "basePrefix": base, "version": version, "modules": checks}))',
].join('\n');

function minimumParts(minimum) {
  if (typeof minimum !== 'string' || !/^\d+\.\d+(?:\.\d+)?$/.test(minimum)) return null;
  const parts = minimum.split('.').map(Number);
  if (parts.length === 2) parts.push(0);
  return parts[0] > 0 && parts.every((part) => Number.isSafeInteger(part) && part >= 0)
    ? parts
    : null;
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function environmentPaths(projectDir, packId) {
  const directory = path.join(projectDir, '.bmad', 'venv', packId);
  const executable = venvPython(directory);
  const parent = path.dirname(executable);
  let cursor = path.parse(parent).root;
  for (const component of parent.slice(cursor.length).split(path.sep)) {
    cursor = path.join(cursor, component);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return null;
  }
  const config = fs.lstatSync(path.join(directory, 'pyvenv.cfg'));
  if (config.isSymbolicLink() || !config.isFile()) return null;
  const binary = fs.lstatSync(executable);
  if (binary.isSymbolicLink()) {
    // A Unix venv normally links bin/python to its base interpreter. Keep that
    // executable path: resolving it before invocation would lose the venv.
    if (process.platform === 'win32' || !fs.statSync(executable).isFile()) return null;
  } else if (!binary.isFile()) return null;
  return { directory, executable };
}

/**
 * Verify the actual prefix, version and declared imports in .bmad/venv/<packId>.
 * One bounded interpreter invocation; no PATH fallback, repair or provisioning.
 */
function probePythonRuntime({
  projectDir,
  packId,
  minimum = `${MIN_PYTHON.major}.${MIN_PYTHON.minor}`,
  verifyModules = [],
  runner = defaultRunner,
} = {}) {
  const started = Date.now();
  const floor = minimumParts(minimum);
  const validNames =
    Array.isArray(verifyModules) &&
    verifyModules.length <= 64 &&
    [...verifyModules].every(
      (name) => typeof name === 'string' && name.length <= 200 && MODULE_NAME.test(name)
    );
  const names = validNames ? [...new Set(verifyModules)] : [];
  const finish = (
    status,
    message,
    version = null,
    modules = names.map((name) => ({ name, status: 'not-verified' }))
  ) => ({
    status,
    version,
    imports: modules.some((entry) => entry.status === 'failed')
      ? 'failed'
      : modules.length > 0 && modules.every((entry) => entry.status === 'verified')
        ? 'verified'
        : 'not-verified',
    modules,
    message,
  });
  if (
    typeof projectDir !== 'string' ||
    !projectDir ||
    projectDir.includes('\0') ||
    typeof packId !== 'string' ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(packId) ||
    !floor ||
    !validNames ||
    typeof runner !== 'function'
  ) {
    return finish('invalid', 'Python verification options are invalid.');
  }

  projectDir = path.resolve(projectDir);
  let environment;
  try {
    environment = environmentPaths(projectDir, packId);
  } catch (error) {
    return finish(
      error.code === 'ENOENT' ? 'missing' : 'unavailable',
      error.code === 'ENOENT'
        ? 'The pack Python environment is missing or incomplete.'
        : 'The pack Python environment cannot be inspected.'
    );
  }
  if (!environment)
    return finish(
      'invalid',
      'The pack Python environment contains an unsafe path or invalid file.'
    );

  const timeout = TIMEOUT_MS - (Date.now() - started);
  if (timeout <= 0) return finish('unavailable', 'Python verification exceeded its time limit.');
  let result;
  try {
    result = runner(
      environment.executable,
      [
        '-I',
        '-B',
        '-c',
        PROBE,
        environment.directory,
        JSON.stringify(floor),
        JSON.stringify(names),
      ],
      {
        cwd: projectDir,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        timeout,
        killSignal: 'SIGKILL',
        maxBuffer: MAX_BUFFER,
      }
    );
  } catch {
    return finish('unavailable', 'The pack Python interpreter could not complete verification.');
  }
  if (Date.now() - started >= TIMEOUT_MS || !result || result.error || result.status !== 0) {
    return finish(
      'unavailable',
      'The pack Python interpreter could not complete verification within its limits.'
    );
  }
  let evidence;
  try {
    if (typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout, 'utf8') > MAX_BUFFER)
      throw new Error();
    evidence = JSON.parse(result.stdout);
  } catch {
    return finish('invalid', 'The Python interpreter returned invalid verification evidence.');
  }
  if (
    !evidence ||
    evidence.schemaVersion !== 1 ||
    typeof evidence.prefix !== 'string' ||
    !path.isAbsolute(evidence.prefix) ||
    typeof evidence.basePrefix !== 'string' ||
    !path.isAbsolute(evidence.basePrefix) ||
    !Array.isArray(evidence.version) ||
    evidence.version.length !== 3 ||
    evidence.version.some((part) => !Number.isSafeInteger(part) || part < 0) ||
    evidence.version[0] === 0 ||
    !Array.isArray(evidence.modules) ||
    evidence.modules.length !== names.length ||
    evidence.modules.some(
      (entry, index) =>
        !entry ||
        entry.name !== names[index] ||
        !['verified', 'failed', 'not-verified'].includes(entry.status)
    )
  ) {
    return finish('invalid', 'The Python interpreter returned invalid verification evidence.');
  }
  if (
    normalizedPath(evidence.prefix) !== normalizedPath(environment.directory) ||
    normalizedPath(evidence.prefix) === normalizedPath(evidence.basePrefix)
  ) {
    return finish(
      'invalid',
      'The interpreter is not running from the expected pack virtual environment.'
    );
  }
  const version = evidence.version.join('.');
  const difference = evidence.version.findIndex((part, index) => part !== floor[index]);
  if (difference >= 0 && evidence.version[difference] < floor[difference]) {
    return finish('unsupported', 'The pack Python version is below the required minimum.', version);
  }
  if (evidence.modules.some((entry) => entry.status === 'not-verified')) {
    return finish('invalid', 'The interpreter did not verify every declared module.', version);
  }
  const modules = evidence.modules.map(({ name, status }) => ({ name, status }));
  if (modules.some((entry) => entry.status === 'failed')) {
    return finish(
      'unavailable',
      'One or more declared modules could not be imported in the pack environment.',
      version,
      modules
    );
  }
  return finish(
    'verified',
    modules.length
      ? 'The pack Python version and declared imports are verified.'
      : 'The pack Python version is verified; no import checks were requested.',
    version,
    modules
  );
}

module.exports = { probePythonRuntime };
