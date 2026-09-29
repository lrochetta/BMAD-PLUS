const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const result = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'recall.json'), 'utf8'));
assert.deepEqual(result.selected, ['D2']);
assert.deepEqual([...result.unresolved].sort(), ['C1','C2']);
assert.equal(result.excluded.length, 3);
assert.deepEqual(Object.fromEntries(result.excluded.map((entry) => [entry.id, entry.reason])), {D1:'superseded',D3:'missing-source',D4:'irrelevant'});
console.log('current bilingual recall and unresolved contradiction passed');
