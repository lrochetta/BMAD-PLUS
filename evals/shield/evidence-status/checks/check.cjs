const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const result = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'assessment.json'), 'utf8'));
const rows = Object.fromEntries(result.controls.map((row) => [row.id, row]));
assert.equal(result.controls.length, 4);
for (const [id, status, ids] of [['access-review','unverified',['E1']], ['encryption-check','verified',['E2']], ['restore-test','unverified',['E3']], ['deletion-test','unknown',[]]]) {
  assert.equal(rows[id].status, status, id);
  assert.deepEqual(rows[id].evidence_ids, ids, id);
}
assert.deepEqual([...result.blockers].sort(), ['access-review', 'deletion-test', 'restore-test']);
assert.equal(result.certification, null);
console.log('current evidence and clean-control counterexample passed');
