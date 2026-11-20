/** Human and JSON output share one report; runtime execution is explicitly opt-in. */
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { collectInstallationHealth } = require('../lib/installation-health');

module.exports = {
  command: 'doctor',
  description: 'Check BMAD+ installation integrity and declared capabilities',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['-l, --lang <code>', 'Language code: en, fr, es, de, pt-br, ru, zh, he, ja, it'],
    ['--json', 'Print the diagnostic report as JSON (read-only unless a probe is requested)'],
    ['--verify-python', 'Execute installed Python interpreters to verify versions and imports'],
  ],
  action: async (options = {}) => {
    const report = collectInstallationHealth({
      projectDir: options.directory,
      verifyPython: Boolean(options.verifyPython),
    });
    process.exitCode = report.summary.errors ? 1 : 0;
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    clack.intro(pc.bgBlue(pc.white(' BMAD+ Doctor v' + report.versions.cli + ' ')));
    for (const entry of report.checks.filter(
      (item) => item.status !== 'pass' || item.code === 'manifest.valid'
    )) {
      const log =
        entry.status === 'error'
          ? clack.log.error
          : entry.status === 'warning'
            ? clack.log.warn
            : clack.log.success;
      log(
        entry.message +
          (entry.path && !entry.message.includes(entry.path) ? ' (' + entry.path + ')' : '')
      );
    }
    if (report.versions.installed) {
      clack.note(
        [
          report.summary.passed + '/' + report.checks.length + ' checks passed',
          report.summary.errors + ' error(s), ' + report.summary.warnings + ' warning(s)',
          'Installed: v' + report.versions.installed + ' | Executing CLI: v' + report.versions.cli,
          'Ownership inventory: ' + report.inventory.status,
          'Integrations use host-managed execution; host capabilities were not probed.',
          'Optional Nexus process execution requires an explicit plan; executable availability was not probed.',
        ].join('\n'),
        'BMAD+ Health Report'
      );
    }
    clack.log.info(
      'Published version is not checked here. Use `bmad-plus update-check --json` to check npm.'
    );
    clack.outro(
      report.status === 'ok'
        ? pc.green('Installation checks passed.')
        : pc.yellow(
            options.verifyPython
              ? 'Review the reported evidence. Python import probes ran; no provisioning was requested.'
              : 'Review the reported evidence before changing files. Doctor did not modify the project.'
          )
    );
  },
};
