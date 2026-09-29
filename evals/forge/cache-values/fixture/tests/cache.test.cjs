const test = require('node:test');
const assert = require('node:assert/strict');
const { createLookup } = require('../src/cache.cjs');

test('a populated label is reused', () => {
  let reads = 0;
  const lookup = createLookup(() => { reads += 1; return 'ready'; });
  assert.equal(lookup('a'), 'ready');
  assert.equal(lookup('a'), 'ready');
  assert.equal(reads, 1);
});
