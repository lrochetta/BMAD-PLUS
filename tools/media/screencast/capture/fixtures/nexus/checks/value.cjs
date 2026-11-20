const fs = require('node:fs');
const assert = require('node:assert/strict');

assert.equal(JSON.parse(fs.readFileSync('src/value.json', 'utf8')).value, 7);
console.log('value.json holds 7');
