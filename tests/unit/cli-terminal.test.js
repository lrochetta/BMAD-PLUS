/**
 * The CLI gives the terminal back. Every other suite spawns it without a terminal, where
 * stdin is not a TTY and a leaked stdin handle cannot show; the 0.20.0 acceptance run
 * caught it by hand (Ctrl+C after every command). Here the CLI runs under `script`, which
 * gives it a pseudo-terminal whose input stays open, as an interactive shell does.
 */
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const hasScript =
  process.platform !== 'win32' &&
  spawnSync('script', ['--version'], { stdio: 'ignore' }).status === 0;

function runInTerminal(args, limitMs = 10000) {
  const command = [process.execPath, cli, ...args]
    .map((part) => `'${part.replace(/'/g, "'\\''")}'`)
    .join(' ');
  return new Promise((resolve) => {
    // stdin is a pipe we never end: the pseudo-terminal's input stays open.
    const child = spawn('script', ['-qec', command, '/dev/null'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), limitMs);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      child.stdin.destroy();
      resolve({ code, signal, output });
    });
  });
}

(hasScript ? describe : describe.skip)('the CLI in an interactive terminal', () => {
  it.each([
    [['--version']],
    [['review', 'rules', 'README.md', '--directory', path.resolve(__dirname, '../..')]],
    [['doctor', '--directory', os.tmpdir()]],
  ])(
    'returns the prompt after %j',
    async (args) => {
      const result = await runInTerminal(args);
      expect(result.signal).toBeNull();
      expect(typeof result.code).toBe('number');
    },
    20000
  );
});
