const { cleanLabel } = require('./normalize.cjs');

try {
  process.stdout.write(cleanLabel(process.argv[2]) + '\n');
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
