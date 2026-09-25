const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { probePythonRuntime } = require('../../tools/cli/lib/python-health');
const { venvPython } = require('../../tools/cli/lib/python-provision');

let root;
let projectDir;
let envDir;
let executable;

function fixture() {
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(path.join(envDir, 'pyvenv.cfg'), 'include-system-site-packages = false\n');
  fs.writeFileSync(executable, 'fake interpreter; tests inject the runner\n');
}

function response(overrides = {}) {
  return {
    status: 0,
    error: null,
    stderr: '',
    stdout: JSON.stringify({
      schemaVersion: 1,
      prefix: envDir,
      basePrefix: path.join(root, 'base-python'),
      version: [3, 11, 9],
      modules: [
        { name: 'json', status: 'verified' },
        { name: 'email.message', status: 'verified' },
      ],
      ...overrides,
    }),
  };
}

function probe(runner, options = {}) {
  return probePythonRuntime({
    projectDir,
    packId: 'seo',
    minimum: '3.11',
    verifyModules: ['json', 'email.message'],
    runner,
    ...options,
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bmad-python-health-'));
  projectDir = path.join(root, 'project with spaces');
  fs.mkdirSync(projectDir);
  envDir = path.join(projectDir, '.bmad', 'venv', 'seo');
  executable = venvPython(envDir);
});

afterEach(() => {
  jest.restoreAllMocks();
  // Only remove the exact temporary test directory created above.
  if (
    path.dirname(root) !== fs.realpathSync(os.tmpdir()) ||
    !path.basename(root).startsWith('bmad-python-health-')
  ) {
    throw new Error('Unexpected test cleanup target');
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('verifies the pack interpreter and every import with one bounded isolated invocation', () => {
  fixture();
  const runner = jest.fn(() => response());
  expect(probe(runner)).toEqual({
    status: 'verified',
    version: '3.11.9',
    imports: 'verified',
    modules: [
      { name: 'json', status: 'verified' },
      { name: 'email.message', status: 'verified' },
    ],
    message: 'The pack Python version and declared imports are verified.',
  });
  expect(runner).toHaveBeenCalledTimes(1);
  const [command, args, options] = runner.mock.calls[0];
  expect(command).toBe(executable);
  expect(args.slice(0, 3)).toEqual(['-I', '-B', '-c']);
  expect(args.slice(4)).toEqual([envDir, '[3,11,0]', '["json","email.message"]']);
  expect(options).toMatchObject({
    cwd: projectDir,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    killSignal: 'SIGKILL',
    maxBuffer: 65536,
  });
  expect(options.timeout).toBeGreaterThan(0);
  expect(options.timeout).toBeLessThanOrEqual(15000);
});

test('reports a missing environment without attempting a PATH interpreter', () => {
  const runner = jest.fn();
  expect(probe(runner)).toMatchObject({
    status: 'missing',
    version: null,
    imports: 'not-verified',
  });
  expect(runner).not.toHaveBeenCalled();
});

test.each(['pyvenv.cfg', 'interpreter'])('reports an incomplete environment missing %s', (file) => {
  fixture();
  fs.unlinkSync(file === 'interpreter' ? executable : path.join(envDir, file));
  const runner = jest.fn();
  expect(probe(runner).status).toBe('missing');
  expect(runner).not.toHaveBeenCalled();
});

test.each([
  { packId: '../outside' },
  { packId: 'seo/other' },
  { packId: 'C:outside' },
  { projectDir: '' },
  { minimum: '3.11; exit()' },
  { minimum: 3.11 },
  { minimum: '0.0' },
  { minimum: '99999999999999999999.0' },
  { verifyModules: ['json; import os'] },
  { verifyModules: ['../json'] },
  { verifyModules: ['json..decoder'] },
  { verifyModules: [null] },
  { verifyModules: 'json' },
  { verifyModules: Array(65).fill('json') },
  { verifyModules: ['x'.repeat(201)] },
])('refuses invalid probe options before execution: %j', (options) => {
  fixture();
  const runner = jest.fn();
  expect(probe(runner, options).status).toBe('invalid');
  expect(runner).not.toHaveBeenCalled();
});

test('deduplicates module names without discarding requested verification', () => {
  fixture();
  const runner = jest.fn(() => response({ modules: [{ name: 'json', status: 'verified' }] }));
  expect(probe(runner, { verifyModules: ['json', 'json'] }).modules).toEqual([
    { name: 'json', status: 'verified' },
  ]);
  expect(JSON.parse(runner.mock.calls[0][1].at(-1))).toEqual(['json']);
});

test('reports import verification as absent when no modules were requested', () => {
  fixture();
  expect(probe(() => response({ modules: [] }), { verifyModules: [] })).toMatchObject({
    status: 'verified',
    version: '3.11.9',
    imports: 'not-verified',
    modules: [],
  });
});

test.each(['wrong-prefix', 'base-interpreter'])('refuses a fake venv: %s', (kind) => {
  fixture();
  const fields =
    kind === 'wrong-prefix' ? { prefix: path.join(root, 'other') } : { basePrefix: envDir };
  expect(probe(() => response(fields))).toMatchObject({
    status: 'invalid',
    version: null,
    imports: 'not-verified',
  });
});

test.each([
  ['3.11', [3, 10, 12]],
  ['3.11.10', [3, 11, 9]],
  ['4.0', [3, 14, 0]],
])('reports an interpreter below minimum %s', (minimum, version) => {
  fixture();
  expect(probe(() => response({ version }), { minimum })).toMatchObject({
    status: 'unsupported',
    version: version.join('.'),
    imports: 'not-verified',
  });
});

test.each([[[3, 11, 0]], [[3, 12, 0]], [[4, 0, 0]]])('accepts supported Python %j', (version) => {
  fixture();
  expect(probe(() => response({ version })).status).toBe('verified');
});

test('returns per-module failures without exposing exception output', () => {
  fixture();
  const result = probe(() => ({
    ...response({
      modules: [
        { name: 'json', status: 'verified' },
        { name: 'email.message', status: 'failed' },
      ],
    }),
    stderr: 'private-token-value and exception traceback',
  }));
  expect(result).toMatchObject({
    status: 'unavailable',
    version: '3.11.9',
    imports: 'failed',
    modules: [
      { name: 'json', status: 'verified' },
      { name: 'email.message', status: 'failed' },
    ],
  });
  expect(JSON.stringify(result)).not.toContain('private-token');
});

test.each([
  null,
  { schemaVersion: 2 },
  { prefix: '.' },
  { basePrefix: null },
  { version: '3.11.9' },
  { version: [3, 11] },
  { version: [3, 11, -1] },
  { version: [0, 0, 0] },
  { version: [3, 11, 0.1] },
  { modules: [] },
  { modules: [{ name: 'json', status: 'verified' }] },
  {
    modules: [
      { name: 'wrong-module', status: 'verified' },
      { name: 'email.message', status: 'verified' },
    ],
  },
  {
    modules: [
      { name: 'json', status: 'not-verified' },
      { name: 'email.message', status: 'verified' },
    ],
  },
  {
    modules: [
      { name: 'json', status: 'unknown' },
      { name: 'email.message', status: 'verified' },
    ],
  },
])('refuses malformed or incomplete interpreter evidence: %j', (fields) => {
  fixture();
  const result = fields === null ? { ...response(), stdout: 'null' } : response(fields);
  expect(probe(() => result)).toMatchObject({ status: 'invalid', imports: 'not-verified' });
});

test.each([
  ['non-JSON', 'not JSON private-token-value'],
  ['truncated JSON', '{"version":'],
  ['excessive', 'x'.repeat(65537)],
])('rejects %s output without including it', (_label, stdout) => {
  fixture();
  const result = probe(() => ({ ...response(), stdout }));
  expect(result.status).toBe('invalid');
  expect(JSON.stringify(result)).not.toContain('private-token');
  expect(result.message.length).toBeLessThan(150);
});

test.each([
  null,
  { status: null, error: 'spawn ETIMEDOUT private-token-value' },
  { status: 1, error: null, stdout: 'private-token-value', stderr: 'private-token-value' },
])('handles unavailable, timed out and failed runners: %j', (result) => {
  fixture();
  const actual = probe(() => result);
  expect(actual).toMatchObject({ status: 'unavailable', version: null, imports: 'not-verified' });
  expect(JSON.stringify(actual)).not.toContain('private-token');
});

test('handles a runner exception without exposing its text', () => {
  fixture();
  const result = probe(() => {
    throw new Error('private-token-value');
  });
  expect(result.status).toBe('unavailable');
  expect(result.message).not.toContain('private-token');
});

test('includes preflight in the shared time limit and rejects late evidence', () => {
  fixture();
  jest
    .spyOn(Date, 'now')
    .mockReturnValueOnce(1000)
    .mockReturnValueOnce(3000)
    .mockReturnValueOnce(16001);
  const runner = jest.fn(() => response());
  expect(probe(runner).status).toBe('unavailable');
  expect(runner.mock.calls[0][2].timeout).toBe(13000);
});

test('does not invoke Python after preflight exhausts the time limit', () => {
  fixture();
  jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(16001);
  const runner = jest.fn();
  expect(probe(runner).status).toBe('unavailable');
  expect(runner).not.toHaveBeenCalled();
});

test.each(['project', '.bmad', 'venv', 'pack', 'binary-parent'])(
  'rejects a symlink or junction at %s before execution',
  (location) => {
    fixture();
    const alias = path.join(root, 'alias');
    const actual = {
      project: projectDir,
      '.bmad': path.join(projectDir, '.bmad'),
      venv: path.join(projectDir, '.bmad', 'venv'),
      pack: envDir,
      'binary-parent': path.dirname(executable),
    }[location];
    fs.renameSync(actual, alias);
    fs.symlinkSync(alias, actual, process.platform === 'win32' ? 'junction' : 'dir');
    const runner = jest.fn();
    expect(probe(runner).status).toBe('invalid');
    expect(runner).not.toHaveBeenCalled();
  }
);

test('rejects a directory in place of the executable', () => {
  fixture();
  fs.unlinkSync(executable);
  fs.mkdirSync(executable);
  const runner = jest.fn();
  expect(probe(runner).status).toBe('invalid');
  expect(runner).not.toHaveBeenCalled();
});

test('reports unreadable environment metadata without exposing filesystem errors', () => {
  fixture();
  const original = fs.lstatSync;
  jest.spyOn(fs, 'lstatSync').mockImplementation((file, ...args) => {
    if (file === path.join(envDir, 'pyvenv.cfg'))
      throw Object.assign(new Error('private-token-value'), { code: 'EACCES' });
    return original(file, ...args);
  });
  const runner = jest.fn();
  expect(probe(runner)).toMatchObject({
    status: 'unavailable',
    message: 'The pack Python environment cannot be inspected.',
  });
  expect(runner).not.toHaveBeenCalled();
});

(process.platform === 'win32' ? test.skip : test)(
  'accepts the normal Unix venv interpreter symlink without dereferencing the invocation path',
  () => {
    fixture();
    const base = path.join(root, 'base-interpreter');
    fs.renameSync(executable, base);
    fs.symlinkSync(base, executable);
    const runner = jest.fn(() => response());
    expect(probe(runner).status).toBe('verified');
    expect(runner.mock.calls[0][0]).toBe(executable);
  }
);
