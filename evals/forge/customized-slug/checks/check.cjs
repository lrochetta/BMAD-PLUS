const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.argv[2];
const { slug } = require(path.join(root, 'src/slug.cjs'));
const { documentKey } = require(path.join(root, 'src/caller.cjs'));
assert.equal(documentKey('  007 Launch - Notes  '), 'notes/007_launch_notes.md');
for (const [input, expected] of [['A__B', 'a__b'], ['a\tb', 'a_b'], ['X--Y', 'x_y'], ['0', '0']]) {
  assert.equal(slug(input), expected);
}
for (const input of ['', ' ', null, 0, {}, 'caf\u00e9', 'x/y', 'x.y']) assert.throws(() => slug(input), TypeError);
const tests = fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.cjs'));
assert.ok(tests.length > 0, 'a regression test is required');
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests.map((name) => path.join(root, 'tests', name))], { encoding: 'utf8', timeout: 10000 });
assert.equal(result.status, 0, result.stdout + result.stderr);
assert.match(result.stdout, /# tests [1-9]/);
assert.match(result.stdout, /# skipped 0/);
console.log('customized caller behavior passed');
