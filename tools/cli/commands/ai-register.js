/**
 * The AI processing register: start it from the Shield template, warn about AI integrations
 * it does not cover.
 */
'use strict';

const path = require('node:path');
const register = require('../lib/ai-register');

module.exports = {
  command: 'ai-register <action>',
  description:
    'AI processing register: start it from the Shield template, check which AI integrations it does not cover',
  options: [
    ['-d, --directory <path>', 'Project directory'],
    ['--json', 'Machine-readable output'],
  ],
  action: (action, options = {}) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    if (action === 'init') {
      try {
        const file = register.initRegister(projectDir);
        if (options.json) console.log(JSON.stringify({ schemaVersion: 1, action, file }, null, 2));
        else
          console.log(
            `${file}: started from the Shield template. Replace the example entries, then run bmad-plus ai-register check.`
          );
      } catch (error) {
        console.error(`ai-register: ${error.message}`);
        process.exitCode = 3;
      }
      return;
    }
    if (action !== 'check') {
      console.error(`ai-register: unknown action "${action}" (init, check)`);
      process.exitCode = 3;
      return;
    }
    const result = register.checkRegister(projectDir);
    // A soft gate: warnings never fail the command; only an unreadable register does.
    process.exitCode = result.errors.length ? 1 : 0;
    if (options.json) {
      console.log(JSON.stringify({ schemaVersion: 1, ...result }, null, 2));
      return;
    }
    const covered = result.integrations.filter((item) => item.coveredBy);
    console.log(
      `${result.registerFile}: ${result.register ? `reviewed ${result.register.reviewed}` : 'absent'} — ${covered.length}/${result.integrations.length} AI integration(s) registered`
    );
    for (const item of covered)
      console.log(`  registered ${item.ids.join(' or ')} → ${item.coveredBy}`);
    for (const warning of result.warnings) console.log(`  warning   ${warning}`);
    for (const error of result.errors) console.error(`  error     ${error}`);
    if (result.unmatched.length)
      console.log(
        `  not found here (may be used outside the repository): ${result.unmatched.join(', ')}`
      );
    if (result.warnings.length && !result.errors.length)
      console.log(
        '  Add each tool with its purpose, data, legal basis, retention and transfers; see the Shield template shared/ai-processing-register-template.yaml.'
      );
  },
};
