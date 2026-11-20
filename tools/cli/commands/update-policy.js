/** Show or explicitly configure the local update policy; never updates packages. */
const path = require('node:path');
const { readUpdatePolicy, writeUpdatePolicy } = require('../lib/update-policy');

module.exports = {
  command: 'update-policy',
  description: 'Show or configure the project update policy',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['--mode <mode>', 'off, notify, or auto (auto requires --range)'],
    ['--range <range>', 'Explicit semantic-version range for automatic updates'],
    ['--channel <tag>', 'npm release tag (default: latest)'],
    ['--allow-prerelease', 'Explicitly allow prerelease targets'],
    ['--stable-only', 'Disable prerelease targets'],
    ['--json', 'Print machine-readable JSON'],
  ],
  action: async (options = {}) => {
    try {
      if (options.allowPrerelease && options.stableOnly)
        throw new Error('Choose --allow-prerelease or --stable-only.');
      if (options.mode === 'auto' && !options.range)
        throw new Error('--mode auto requires an explicit --range.');
      const projectDir = path.resolve(options.directory || process.cwd());
      const policy = readUpdatePolicy(projectDir);
      const changing =
        options.mode !== undefined ||
        options.range !== undefined ||
        options.channel !== undefined ||
        options.allowPrerelease ||
        options.stableOnly;
      if (options.mode !== undefined) policy.mode = options.mode;
      if (options.range !== undefined) policy.allowedRange = options.range;
      if (options.channel !== undefined) policy.channel = options.channel;
      if (options.allowPrerelease) policy.allowPrerelease = true;
      if (options.stableOnly) policy.allowPrerelease = false;
      const saved = changing ? writeUpdatePolicy(projectDir, policy) : policy;
      if (options.json) console.log(JSON.stringify({ policy: saved, changed: Boolean(changing) }));
      else
        console.log(
          `Update policy${changing ? ' saved' : ''}: ${saved.mode}; channel=${saved.channel}; range=${saved.allowedRange || 'none'}; prereleases=${saved.allowPrerelease}`
        );
    } catch (error) {
      process.exitCode = 1;
      if (options.json) console.log(JSON.stringify({ error: error.message }));
      else console.error(error.message);
    }
  },
};
