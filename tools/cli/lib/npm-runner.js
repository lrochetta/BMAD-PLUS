/** Run npm through Node with bounded output and no shell interpolation. */
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

function resolveNpmCli({
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
  realpath = fs.realpathSync,
  isFile = (file) => fs.statSync(file).isFile(),
} = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const searchPath = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
  const directories = searchPath.split(platform === 'win32' ? ';' : ':').filter(Boolean);
  const nodeDir = paths.dirname(execPath);
  const candidates = [
    env.npm_execpath,
    paths.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    paths.resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ...directories.flatMap((dir) => [
      paths.join(dir, 'npm'),
      paths.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ]),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const resolved = realpath(candidate);
      if (paths.basename(resolved).toLowerCase() === 'npm-cli.js' && isFile(resolved))
        return resolved;
    } catch {
      /* Try the next standard npm installation location. */
    }
  }
  throw new Error('npm-cli.js was not found. Install Node.js with npm or repair its PATH.');
}

/** Injectable process boundary; tests never need to fetch a package. */
function createNpmRunner({
  spawn = childProcess.spawn,
  resolveCli = resolveNpmCli,
  platform = process.platform,
  execPath = process.execPath,
  kill = process.kill.bind(process),
} = {}) {
  return async function runNpm(
    args,
    { cwd, timeout = 6000, env = process.env, maxBuffer = 1024 * 1024, signal } = {}
  ) {
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) {
      throw new Error('npm arguments must be an array of strings without NUL bytes.');
    }
    if (
      !Number.isSafeInteger(timeout) ||
      timeout <= 0 ||
      !Number.isSafeInteger(maxBuffer) ||
      maxBuffer <= 0
    ) {
      throw new Error('npm timeout and maxBuffer must be positive integers.');
    }
    if (signal?.aborted)
      throw Object.assign(new Error('npm operation was cancelled.'), { code: 'ABORT_ERR' });
    const cli = resolveCli({ env, execPath, platform });

    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(execPath, [cli, ...args], {
          cwd,
          env,
          shell: false,
          windowsHide: true,
          detached: platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        reject(new Error('Could not start npm.', { cause: error }));
        return;
      }
      let settled = false;
      let bytes = 0;
      const stdout = [];
      const stderr = [];
      let timer;
      const finish = (error, output) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (error) {
          error.stdout = Buffer.concat(stdout).toString('utf8');
          error.stderr = Buffer.concat(stderr).toString('utf8');
          const diagnostic = [error.stdout.trim(), error.stderr.trim()].filter(Boolean).join('\n');
          if (diagnostic) error.message += '\n' + diagnostic;
          reject(error);
        } else resolve(output);
      };
      const killChild = () => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* The process may already have exited. */
        }
      };
      const stop = () => {
        if (!Number.isInteger(child.pid) || child.pid <= 0) return killChild();
        if (platform !== 'win32') {
          // A detached npm owns this process group, including its updater child.
          try {
            kill(-child.pid, 'SIGKILL');
          } catch {
            killChild();
          }
          return;
        }
        try {
          const terminator = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
            shell: false,
            windowsHide: true,
            stdio: 'ignore',
            env,
          });
          terminator.once('error', killChild);
          terminator.once('close', (code) => {
            if (code !== 0) killChild();
          });
        } catch {
          killChild();
        }
      };
      const cancel = (message, code) => {
        if (settled) return;
        stop();
        finish(Object.assign(new Error(message), { code }));
      };
      const abort = () =>
        cancel('npm operation was cancelled; child termination requested.', 'ABORT_ERR');
      const collect = (chunk, save) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBuffer)
          return cancel('npm output exceeded the configured buffer limit.', 'ENOBUFS');
        (save ? stdout : stderr).push(buffer);
      };
      child.stdout.on('data', (chunk) => collect(chunk, true));
      child.stderr.on('data', (chunk) => collect(chunk, false));
      child.once('error', (error) => finish(new Error('Could not run npm.', { cause: error })));
      child.once('close', (code, exitSignal) => {
        if (code !== 0 || exitSignal) {
          finish(
            Object.assign(new Error(`npm exited unsuccessfully (${exitSignal || code}).`), {
              code: 'NPM_EXIT',
              exitCode: code,
              signal: exitSignal,
            })
          );
        } else finish(null, Buffer.concat(stdout).toString('utf8'));
      });
      timer = setTimeout(
        () =>
          cancel(
            `npm exceeded its ${timeout} ms deadline; child termination requested.`,
            'ETIMEDOUT'
          ),
        timeout
      );
      timer.unref?.();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  };
}

const runNpm = createNpmRunner();
module.exports = { runNpm, resolveNpmCli, createNpmRunner };
