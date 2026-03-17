#!/usr/bin/env node

/**
 * BMAD+ CLI — npx execution wrapper
 * Ensures proper execution when run via npx from npm registry
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const isNpxExecution = __dirname.includes('_npx') || __dirname.includes('.npm');

if (isNpxExecution) {
  const args = process.argv.slice(2);
  const cliPath = path.join(__dirname, 'cli', 'bmad-plus-cli.js');

  if (!fs.existsSync(cliPath)) {
    console.error('Error: Could not find bmad-plus-cli.js at', cliPath);
    process.exit(1);
  }

  try {
    execSync(`node "${cliPath}" ${args.join(' ')}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    process.exit(error.status || 1);
  }
} else {
  require('./cli/bmad-plus-cli.js');
}
