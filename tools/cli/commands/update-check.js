/** Report release status without applying updates. */
const path = require('node:path');
const { checkForUpdate } = require('../lib/update-check');
const { notInstalledMessage, hasInstallManifest } = require('../lib/install-manifest');

module.exports = {
  command: 'update-check',
  description: 'Check the published BMAD+ release without applying it',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['--refresh', 'Bypass the release cache and retry backoff'],
    ['--offline', 'Report local state without network access'],
    ['--json', 'Print machine-readable JSON'],
  ],
  action: async (options = {}) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const result = await checkForUpdate({
      projectDir,
      runningVersion: require('../../../package.json').version,
      refresh: Boolean(options.refresh),
      offline: Boolean(options.offline),
      checkReadiness: ({ projectDir }) => {
        const { evaluateUpdateReadiness } = require('../lib/update-transaction');
        return evaluateUpdateReadiness({ projectDir });
      },
    });
    if (result.status.startsWith('invalid-')) process.exitCode = 1;
    // stderr keeps --json output parseable while still telling a person where to run it.
    if (!hasInstallManifest(projectDir)) console.error(notInstalledMessage(projectDir));
    if (options.json) console.log(JSON.stringify(result));
    else {
      console.log(
        `Installed: ${result.installedVersion || 'unknown'}; running: ${result.runningVersion}; channel ${result.channel || 'unknown'}: ${result.targetVersion || 'unknown'}`
      );
      console.log(
        `${result.status}: ${result.reason}${result.stale ? ' (cached result is stale)' : ''}`
      );
    }
  },
};
