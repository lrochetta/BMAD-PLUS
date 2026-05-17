#!/usr/bin/env node

/**
 * BMAD+ CLI — Main entry point
 * Commands: install, uninstall, update, doctor
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
const update = require('./commands/update');
const doctor = require('./commands/doctor');
const scan = require('./commands/scan');
const memory = require('./commands/memory');

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

// Update command
const updateCmd = program
  .command('update')
  .description('Update BMAD+ agents and skills (preserves config)');

for (const option of update.options || []) {
  updateCmd.option(...option);
}
updateCmd.action(update.action);

// Doctor command
const doctorCmd = program
  .command('doctor')
  .description('Check BMAD+ installation integrity');

for (const option of doctor.options || []) {
  doctorCmd.option(...option);
}
doctorCmd.action(doctor.action);

// Scan command
const scanCmd = program
  .command('scan [path]')
  .description('Scan directories to discover and index projects in the global brain');

for (const option of scan.options || []) {
  scanCmd.option(...option);
}
scanCmd.action((scanPath, options) => scan.action({ ...options, directory: scanPath || options.directory }));

// Memory command
const memoryCmd = program
  .command('memory [subcommand]')
  .description('Manage persistent brain (status, export)');

for (const option of memory.options || []) {
  memoryCmd.option(...option);
}
memoryCmd.action(memory.action);

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
  program.outputHelp();
}
