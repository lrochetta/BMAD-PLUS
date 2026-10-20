const fs = require('node:fs');
const assert = require('node:assert/strict');

assert.ok(fs.readFileSync('docs/notes.md', 'utf8').trim().length > 0);
console.log('notes.md is not empty');
