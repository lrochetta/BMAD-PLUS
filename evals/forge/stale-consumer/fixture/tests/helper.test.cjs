const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLabel } = require('../src/normalize.cjs');

test('normalizes a label', () => assert.equal(normalizeLabel(' ready '), 'ready'));
