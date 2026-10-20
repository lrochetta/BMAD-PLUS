const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.argv[2]);
const { normalizeLabel } = require(path.join(root, 'src/normalize.cjs'));
assert.equal(normalizeLabel(' ready '), 'ready');
for (const [args, stdout, success] of [
  [[' ready '], 'ready\n', true],
  [['a  b'], 'a  b\n', true],
  [[' café '], 'café\n', true],
  [[], '', false],
  [['   '], '', false],
]) {
  const child = spawnSync(process.execPath, ['src/cli.cjs', ...args], {
    cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status === 0, success, child.stderr);
  assert.equal(child.stdout, stdout);
  if (!success) assert.ok(child.stderr.trim());
}
const tests = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], {
  cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
});
assert.equal(tests.status, 0, tests.stderr || tests.stdout);
assert.match(tests.stdout, /^# tests ([2-9]|[1-9]\d+)$/m, 'the consumer needs regression coverage');
assert.match(tests.stdout, /^# skipped 0$/m);
console.log('Current helper, actual CLI, invalid inputs and regressions passed.');
