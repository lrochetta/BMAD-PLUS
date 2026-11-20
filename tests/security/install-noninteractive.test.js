const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
let projectDir;

beforeEach(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-install-tty-'));
});

afterEach(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

function install(args = []) {
  return spawnSync(process.execPath, [CLI, 'install', '--directory', projectDir, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

test('piped install without --yes fails before prompting or creating files', () => {
  const result = install();
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toMatch(/--yes/);
  expect(fs.readdirSync(projectDir)).toEqual([]);
});

test('piped install with --yes completes and preserves existing user memory', () => {
  const memoryDir = path.join(projectDir, '.agents', 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  const memoryFile = path.join(memoryDir, 'decisions.md');
  fs.writeFileSync(memoryFile, 'Keep this project decision.\n');

  const result = install(['--yes', '--packs', 'core', '--tools', 'none', '--lang', 'en']);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(fs.readFileSync(memoryFile, 'utf8')).toBe('Keep this project decision.\n');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(projectDir, '_bmad', '.bmad-plus-install.json'))
  );
  expect(manifest.packs).toEqual(['core']);
  expect(
    fs.existsSync(path.join(projectDir, '.agents', 'skills', 'agent-architect-dev', 'SKILL.md'))
  ).toBe(true);
});
