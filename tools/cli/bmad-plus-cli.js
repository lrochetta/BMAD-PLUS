#!/usr/bin/env node

/**
 * BMAD+ CLI — Main entry point
 * Commands: install, uninstall, update, doctor
 */

const { program } = require('commander');
const packageJson = require('../../package.json');

// Fix stdin for Windows
if (process.stdin.isTTY) {
  try {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    if (process.platform === 'win32') {
      process.stdin.on('error', () => {});
    }
  } catch {
    // stdin may be unavailable (piped/detached); safe to ignore.
  }
}

// Register commands
const install = require('./commands/install');
const uninstall = require('./commands/uninstall');
const update = require('./commands/update');
const doctor = require('./commands/doctor');
const scan = require('./commands/scan');
const memory = require('./commands/memory');

// `--lang` is declared per command: a program-level copy would swallow it.
program
  .name('bmad-plus')
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
const uninstallCmd = program.command('uninstall').description('Remove BMAD+ from your project');
for (const option of uninstall.options || []) {
  uninstallCmd.option(...option);
}
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
const doctorCmd = program.command('doctor').description('Check BMAD+ installation integrity');

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
scanCmd.action((scanPath, options) =>
  scan.action({ ...options, directory: scanPath || options.directory })
);

// Memory command
const memoryCmd = program
  .command('memory [subcommand]')
  .description('Manage persistent brain (status, export)');

for (const option of memory.options || []) {
  memoryCmd.option(...option);
}
memoryCmd.action(memory.action);

// Mem command (Karpathy memory loop — journal recall/write/reinforce)
const memJournal = require('./commands/memory-journal-cmd');
const memJournalCmd = program.command(memJournal.command).description(memJournal.description);

for (const option of memJournal.options || []) {
  memJournalCmd.option(...option);
}
memJournalCmd.action(memJournal.action);

// Autoconfig command
const autoconfig = require('./commands/autoconfig');
const autoconfigCmd = program
  .command('autoconfig')
  .description('Smart project bootstrap — auto-detect, install, and configure');

for (const option of autoconfig.options || []) {
  autoconfigCmd.option(...option);
}
autoconfigCmd.action(autoconfig.action);

// Version discovery and explicit per-project update policy.
for (const modulePath of [
  './commands/update-check',
  './commands/update-policy',
  './commands/studio',
  './commands/nexus',
  './commands/uat',
]) {
  const command = require(modulePath);
  const configured = program.command(command.command).description(command.description);
  if (command.aliases) configured.aliases(command.aliases);
  for (const option of command.options || []) configured.option(...option);
  configured.action(command.action);
}

// Await asynchronous registry checks and updates before completing the CLI.
program.parseAsync(process.argv).catch((error) => {
  console.error(`BMAD+: ${error.message}`);
  process.exitCode = 1;
});
