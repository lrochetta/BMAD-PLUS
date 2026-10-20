const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.argv[2]);
const findings = JSON.parse(fs.readFileSync(path.join(root, 'review/findings.json'), 'utf8'));
assert.ok(Array.isArray(findings));
assert.equal(findings.length, 1, 'one reachable defect and no false-positive route finding');
const finding = findings[0];
assert.equal(finding.file, 'src/cart.cjs');
assert.ok(['high', 'medium', 'low'].includes(finding.severity));
for (const key of ['scenario', 'expected', 'actual', 'correction']) {
  assert.equal(typeof finding[key], 'string');
  assert.ok(finding[key].trim(), key + ' must provide concrete evidence');
}
const { createUserRoute } = require(path.join(root, 'src/route.cjs'));
const route = createUserRoute({ alice: { name: 'Alice' } });
assert.deepEqual(route('unknown'), { status: 404, body: 'Missing user' });
assert.deepEqual(route('alice'), { status: 200, body: 'Alice' });
const execute = (cwd) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/regression.test.cjs'], {
  cwd, encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024,
});
const broken = execute(root);
assert.equal(broken.error, undefined);
assert.notEqual(broken.status, 0, 'the regression must expose the existing defect');
assert.match(broken.stdout, /^# tests [1-9]\d*$/m, 'syntax/import failure is not a regression');
assert.match(broken.stdout, /^# skipped 0$/m);
const tempRoot = fs.realpathSync(os.tmpdir());
const fixedRoot = fs.mkdtempSync(path.join(tempRoot, 'bmad-counterfactual-'));
try {
  for (const dir of ['src', 'tests']) fs.cpSync(path.join(root, dir), path.join(fixedRoot, dir), { recursive: true });
  const cartPath = path.join(fixedRoot, 'src/cart.cjs');
  const original = fs.readFileSync(cartPath, 'utf8');
  assert.ok(original.includes('index <= items.length'));
  fs.writeFileSync(cartPath, original.replace('index <= items.length', 'index < items.length'));
  const fixed = execute(fixedRoot);
  assert.equal(fixed.error, undefined);
  assert.equal(fixed.status, 0, 'the same regression must pass after the minimal fix: ' + fixed.stdout);
  assert.match(fixed.stdout, /^# skipped 0$/m);
} finally {
  const actual = fs.realpathSync(fixedRoot);
  assert.equal(path.dirname(actual), tempRoot);
  assert.ok(path.basename(actual).startsWith('bmad-counterfactual-'));
  fs.rmSync(actual, { recursive: true });
}
console.log('One real defect, no guarded-route false positive, genuine red/green regression passed.');
