/** The npx wrapper must propagate startup failures as nonzero exit statuses. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { spawnTimeout } = require('../helpers/process-budget');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'tools', 'bmad-plus-npx.js'),
  'utf8'
);

function runWrapper(result, { exists = true, spawnError } = {}) {
  const spawn = jest.fn(() => {
    if (spawnError) throw spawnError;
    return result;
  });
  const exit = jest.fn((status) => {
    throw { status };
  });
  const logError = jest.fn();
  try {
    vm.runInNewContext(source, {
      __dirname: '/cache/_npx/bmad-plus/tools',
      require: (name) => {
        if (name === 'node:child_process') return { spawnSync: spawn };
        if (name === 'node:fs') return { existsSync: () => exists };
        if (name === 'node:path') return path;
        throw new Error('Unexpected require: ' + name);
      },
      process: { argv: ['node', 'bmad-plus', 'doctor'], execPath: '/trusted/node', exit },
      console: { error: logError },
    });
  } catch (error) {
    if (typeof error.status !== 'number') throw error;
  }
  return { spawn, exit, logError };
}

test.each([
  { status: null, error: new Error('spawn ENOENT') },
  { status: null, signal: 'SIGTERM' },
  { status: null },
])('fails on startup or signal termination: %p', (result) => {
  const { exit } = runWrapper(result);
  expect(exit).toHaveBeenLastCalledWith(1);
});

test('propagates the child exit status', () => {
  expect(runWrapper({ status: 7 }).exit).toHaveBeenLastCalledWith(7);
});

test('launches with the current Node executable and passes arguments through', () => {
  const { spawn, exit } = runWrapper({ status: 0 });
  expect(spawn).toHaveBeenCalledWith(
    '/trusted/node',
    [expect.stringContaining('bmad-plus-cli.js'), 'doctor'],
    { stdio: 'inherit' }
  );
  expect(exit).not.toHaveBeenCalled();
});

test('fails when the CLI entry file is missing', () => {
  const { spawn, exit } = runWrapper({}, { exists: false });
  expect(spawn).not.toHaveBeenCalled();
  expect(exit).toHaveBeenLastCalledWith(1);
});

test('fails when spawn throws synchronously', () => {
  expect(runWrapper({}, { spawnError: new Error('spawn failed') }).exit).toHaveBeenLastCalledWith(
    1
  );
});

test(
  'the registered uninstall command exposes --yes and --lang',
  () => {
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', '..', 'tools', 'cli', 'bmad-plus-cli.js'), 'uninstall', '--help'],
      {
        encoding: 'utf8',
        timeout: spawnTimeout(1, { floor: 10000 }),
      }
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--yes');
    expect(result.stdout).toContain('--lang');
  },
  spawnTimeout(1, { floor: 15000 })
);
