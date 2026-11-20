const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.argv[2]);
const { createLookup } = require(path.join(root, 'src/cache.cjs'));
const { createLabelPicker } = require(path.join(root, 'src/labels.cjs'));

for (const value of ['', 0, false, null, undefined, 'ready']) {
  let reads = 0;
  const picker = createLabelPicker(() => { reads += 1; return value; });
  assert.deepEqual(picker('a'), { id: 'a', label: value });
  assert.deepEqual(picker('a'), { id: 'a', label: value });
  assert.equal(reads, 1, 'successful values must be cached through the actual caller');
  picker('b');
  assert.equal(reads, 2, 'different keys must be independent');
}
let attempts = 0;
const lookup = createLookup(() => {
  attempts += 1;
  if (attempts === 1) throw new Error('temporary read failure');
  return '';
});
assert.throws(() => lookup('retry'), /temporary read failure/);
assert.equal(lookup('retry'), '');
assert.equal(lookup('retry'), '');
assert.equal(attempts, 2);
assert.ok(fs.readdirSync(path.join(root, 'tests')).some((name) => name.endsWith('.test.cjs')));
const checks = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], {
  cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
});
assert.equal(checks.status, 0, checks.stderr || checks.stdout);
assert.match(checks.stdout, /^# tests ([2-9]|[1-9]\d+)$/m, 'a regression must be added');
assert.match(checks.stdout, /^# skipped 0$/m);
console.log('Caller values, independent keys, retry behavior and unskipped regressions passed.');
