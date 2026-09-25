const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createNpmRunner, resolveNpmCli, runNpm } = require('../../tools/cli/lib/npm-runner');
const { spawnTimeout, removeTree } = require('../helpers/process-budget');

// The real npm exec case starts npm, its script shell and the fixture bin; the
// mocked cases finish in milliseconds, so one file-wide budget costs nothing.
jest.setTimeout(spawnTimeout(6, { floor: 30000 }));

function fakeChild() {
  const child = new EventEmitter();
  child.pid = 43210;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn();
  return child;
}

describe('npm process boundary', () => {
  let child;
  let spawn;
  let runner;
  let kill;

  beforeEach(() => {
    child = fakeChild();
    spawn = jest.fn(() => child);
    kill = jest.fn();
    runner = createNpmRunner({
      spawn,
      kill,
      platform: 'linux',
      execPath: '/opt/node',
      resolveCli: () => '/opt/npm/bin/npm-cli.js',
    });
  });
  afterEach(() => jest.useRealTimers());

  test('executes Node with exact arguments and returns only stdout', async () => {
    const env = { PATH: '/opt', NPM_TOKEN: 'never log this' };
    const args = ['view', 'bmad-plus@latest', '--json', 'a path & (literal)'];
    const result = runner(args, { cwd: '/project with spaces', env });
    child.stdout.write('first');
    child.stderr.write('diagnostic');
    child.stdout.write(' second');
    child.emit('close', 0, null);
    await expect(result).resolves.toBe('first second');
    expect(spawn).toHaveBeenCalledWith('/opt/node', ['/opt/npm/bin/npm-cli.js', ...args], {
      cwd: '/project with spaces',
      env,
      shell: false,
      windowsHide: true,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  });

  test('reports bounded child diagnostics without dumping the environment', async () => {
    const result = runner(['view'], { env: { NPM_TOKEN: 'private-token' } });
    child.stdout.write('Recovery record: /project/receipt.json\n');
    child.stderr.write('Ownership conflict: skill.md');
    child.emit('close', 1, null);
    await expect(result).rejects.toMatchObject({
      code: 'NPM_EXIT',
      exitCode: 1,
      message:
        'npm exited unsuccessfully (1).\nRecovery record: /project/receipt.json\nOwnership conflict: skill.md',
      stderr: 'Ownership conflict: skill.md',
    });
  });

  test('enforces the deadline and kills the npm process group', async () => {
    jest.useFakeTimers();
    const result = runner(['view'], { timeout: 10 });
    const assertion = expect(result).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    jest.advanceTimersByTime(10);
    await assertion;
    expect(kill).toHaveBeenCalledWith(-child.pid, 'SIGKILL');
  });

  test('bounds combined stdout and stderr even when the caller only needs stdout', async () => {
    const result = runner(['exec'], { maxBuffer: 5 });
    child.stdout.write('123');
    child.stderr.write('456');
    await expect(result).rejects.toMatchObject({ code: 'ENOBUFS' });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  test('cancellation terminates the child instead of waiting for the timeout', async () => {
    const controller = new globalThis.AbortController();
    const result = runner(['view'], { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'ABORT_ERR' });
    expect(kill).toHaveBeenCalledWith(-child.pid, 'SIGKILL');
  });

  test('terminates Windows descendants without using a visible shell', async () => {
    jest.useFakeTimers();
    const terminator = new EventEmitter();
    spawn.mockReturnValueOnce(child).mockReturnValueOnce(terminator);
    const windowsRunner = createNpmRunner({
      spawn,
      platform: 'win32',
      execPath: 'C:\\node\\node.exe',
      resolveCli: () => 'C:\\npm\\npm-cli.js',
    });
    const result = windowsRunner(['exec'], { timeout: 10, env: {} });
    const assertion = expect(result).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    jest.advanceTimersByTime(10);
    await assertion;
    expect(spawn).toHaveBeenNthCalledWith(2, 'taskkill.exe', ['/pid', '43210', '/t', '/f'], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      env: {},
    });
    terminator.emit('error', new Error('taskkill unavailable'));
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });

  test('fails before spawning invalid argument values', async () => {
    await expect(runner(['view', null])).rejects.toThrow('array of strings');
    await expect(runner(['view\0'])).rejects.toThrow('NUL');
    await expect(runner(['view'], { timeout: 0 })).rejects.toThrow('positive integers');
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('portable npm entry resolution', () => {
  test('resolves a POSIX npm symlink to its JavaScript entry', () => {
    const actual = '/usr/lib/node_modules/npm/bin/npm-cli.js';
    expect(
      resolveNpmCli({
        platform: 'linux',
        execPath: '/custom/node',
        env: { PATH: '/usr/bin' },
        realpath: (file) => {
          if (file === '/usr/bin/npm') return actual;
          throw new Error('missing');
        },
        isFile: () => true,
      })
    ).toBe(actual);
  });

  test('finds npm alongside Windows Node without running npm.cmd', () => {
    const actual = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
    expect(
      resolveNpmCli({
        platform: 'win32',
        execPath: 'C:\\Program Files\\nodejs\\node.exe',
        env: {},
        realpath: (file) => {
          if (file === actual) return file;
          throw new Error('missing');
        },
        isFile: () => true,
      })
    ).toBe(actual);
  });

  test('fails clearly if npm is missing instead of invoking a shell fallback', () => {
    expect(() =>
      resolveNpmCli({
        env: {},
        realpath: () => {
          throw new Error('missing');
        },
      })
    ).toThrow('npm-cli.js was not found');
  });
});

test('real npm exec offline preserves project paths through its internal shell', async () => {
  const parent = fs.realpathSync(os.tmpdir());
  const temporary = fs.mkdtempSync(path.join(parent, 'bmad-npm-argv-'));
  try {
    const project = path.join(temporary, 'isolated npm execution');
    const packageDir = path.join(project, 'node_modules', 'bmad-plus');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(project, 'package.json'),
      JSON.stringify({
        name: 'npm-exec-offline-fixture',
        private: true,
        dependencies: { 'bmad-plus': '0.12.3' },
      })
    );
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'bmad-plus',
        version: '0.12.3',
        bin: { 'bmad-plus': 'cli.js' },
      })
    );
    const cliFile = path.join(packageDir, 'cli.js');
    fs.writeFileSync(
      cliFile,
      '#!/usr/bin/env node\n' +
        'console.log(JSON.stringify({args:process.argv.slice(2),registry:process.env.npm_config_registry}));\n'
    );
    // Use npm's own shim writer to exercise its real .cmd quoting on Windows.
    const npmRoot = path.dirname(path.dirname(resolveNpmCli()));
    const cmdShim = require(path.join(npmRoot, 'node_modules', 'cmd-shim'));
    await cmdShim(cliFile, path.join(project, 'node_modules', '.bin', 'bmad-plus'));
    const target = path.join(project, 'target & (group) %BMAD_RUNNER_TEST% ! ^');
    const args = ['update', '--yes', '--directory', target, '--expected-version', '0.12.3'];
    const registry = 'https://registry.npmjs.org/';
    const stdout = await runNpm(
      [
        'exec',
        '--yes',
        '--offline',
        '--package=bmad-plus@0.12.3',
        `--registry=${registry}`,
        `--script-shell=${process.platform === 'win32' ? 'cmd.exe' : 'sh'}`,
        '--cache',
        path.join(temporary, 'cache'),
        '--',
        'bmad-plus',
        ...args,
      ],
      {
        cwd: project,
        timeout: 20000,
        env: {
          ...process.env,
          BMAD_RUNNER_TEST: 'must-not-expand',
          NPM_CONFIG_REGISTRY: 'https://invalid.example/',
          npm_config_registry: 'https://invalid.example/',
          NPM_CONFIG_UPDATE_NOTIFIER: 'false',
        },
      }
    );
    expect(JSON.parse(stdout)).toEqual({ args, registry });
  } finally {
    const actual = fs.realpathSync(temporary);
    expect(path.dirname(actual)).toBe(parent);
    expect(path.basename(actual).startsWith('bmad-npm-argv-')).toBe(true);
    removeTree(actual, { force: true });
  }
});
