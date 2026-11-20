'use strict';

const fs = require('node:fs');
const path = require('node:path');

const expected = {
  'deadline.txt': 'Votre lien expire vendredi à midi.',
  'price.txt': 'L’entrée coûte 12\u202f€.',
};

// A file may end with a conventional line terminator. All chat content,
// including any other whitespace and the narrow no-break space, is significant.
function matches(name, content) {
  if (!Object.hasOwn(expected, name)) return false;
  return [expected[name], expected[name] + '\n', expected[name] + '\r\n'].includes(content);
}

if (require.main === module) {
  for (const name of Object.keys(expected)) {
    const text = fs.readFileSync(path.join(process.argv[2], name), 'utf8');
    if (!matches(name, text)) {
      console.error(name + ' differs from the requested final reply.');
      process.exitCode = 1;
    }
  }
}

module.exports = { matches };
