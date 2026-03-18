#!/usr/bin/env node

/**
 * BMAD+ CLI — Main entry point
 */

const { program } = require('commander');
const path = require('node:path');
const packageJson = require('../../package.json');

// Fix stdin for Windows
if (process.stdin.isTTY) {
  try {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    if (process.platform === 'win32') {
      process.stdin.on('error', () => {});
    }
  } catch {}
}

// Register commands
const install = require('./commands/install');
const uninstall = require('./commands/uninstall');

program
  .version(packageJson.version)
  .description('BMAD+ — Augmented AI-Driven Development Framework');

// Install command
const installCmd = program
  .command('install')
  .description('Install BMAD+ agents and skills into your project');

for (const option of install.options || []) {
  installCmd.option(...option);
}
installCmd.action(install.action);

// Uninstall command
const uninstallCmd = program
  .command('uninstall')
  .description('Remove BMAD+ from your project');
uninstallCmd.action(uninstall.action);

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
  program.outputHelp();
}
