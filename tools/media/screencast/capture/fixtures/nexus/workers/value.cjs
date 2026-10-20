// A stand-in worker: reads the task packet from stdin and writes the requested value.
const fs = require('node:fs');

process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => {
  fs.writeFileSync('src/value.json', '{ "value": 7 }\n');
  console.log('wrote src/value.json');
});
