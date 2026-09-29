/**
 * BMAD+ Update Command — planned updates with recoverable backups.
 * Author: Laurent Rochetta
 */
const path = require('node:path');
const fs = require('node:fs');
const semver = require('semver');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t } = require('../i18n');
const { safeTarget } = require('../../build/generate-adapters');
const {
  readInstallManifest,
  notInstalledMessage,
  hasInstallManifest,
} = require('../lib/install-manifest');
const { isExactVersion } = require('../lib/update-policy');
const { planUpdate, applyPlan, restoreUpdate, MANIFEST } = require('../lib/update-transaction');

function authorizeAuto(projectDir, version) {
  const { readUpdatePolicy, authorizeTarget } = require('../lib/update-policy');
  const decision = authorizeTarget(readUpdatePolicy(projectDir), version);
  if (!decision.allowed) throw new Error('Automatic update refused: ' + decision.reason);
}

async function confirmAction(options, message, lang = 'en') {
  if (options.yes || options.auto) return true;
  const i = t(lang);
  if (!process.stdin.isTTY) throw new Error(i.noninteractive_requires_yes('update'));
  const confirmed = await clack.confirm({ message });
  if (!confirmed || clack.isCancel(confirmed)) {
    clack.cancel(i.cancelled);
    return false;
  }
  return true;
}

module.exports = {
  command: 'update',
  description: 'Update BMAD+ agents and skills (preserves local changes)',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['-y, --yes', 'Confirm update without prompting'],
    ['-l, --lang <code>', 'Language code: en, fr, es, de, pt-br, ru, zh, he, ja, it'],
    ['--latest', 'Resolve and run the exact latest compatible published package'],
    ['--expected-version <version>', 'Require this exact executing package version'],
    ['--auto', 'Apply only when automatic update policy and ownership allow it'],
    ['--restore <receipt-id>', 'Restore files from an update receipt'],
  ],
  action: async (options) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const version = require('../../../package.json').version;
    let spinner;
    try {
      if (options.restore && (options.latest || options.expectedVersion)) {
        throw new Error('--restore cannot be combined with --latest or --expected-version.');
      }
      if (!options.restore && !hasInstallManifest(projectDir)) {
        throw new Error(notInstalledMessage(projectDir));
      }
      // The dispatcher resolves the target package; this local package may be older.
      if (options.latest) {
        const result = await require('../lib/update-dispatch').runLatestUpdate({
          projectDir,
          auto: Boolean(options.auto),
          yes: Boolean(options.yes),
        });
        clack.log.info(result.reason || result.status);
        if (result.output) clack.log.info(result.output);
        if (result.targetVersion) clack.log.info('Target: v' + result.targetVersion);
        if (result.reloadInstructions)
          clack.log.info('Reload your agent instructions or start a new session.');
        return;
      }

      clack.intro(pc.bgMagenta(pc.white(' BMAD+ Updater v' + version + ' ')));
      if (options.restore) {
        if (options.auto) throw new Error('Recovery requires manual approval.');
        if (
          !(await confirmAction(
            options,
            'Restore the files saved in receipt ' + options.restore + '?',
            options.lang
          ))
        )
          return;
        const restored = restoreUpdate({ projectDir, receiptId: options.restore });
        clack.log.success('Restored BMAD+ v' + restored.restoredVersion);
        clack.log.info('Receipt: ' + restored.receiptPath);
        clack.outro('Reload your agent instructions or start a new session.');
        return;
      }

      if (options.auto && !options.expectedVersion)
        throw new Error('Automatic update requires --expected-version.');
      if (options.expectedVersion && options.expectedVersion !== version) {
        throw new Error(
          'Executing package version ' +
            version +
            ' does not match expected version ' +
            options.expectedVersion +
            '.'
        );
      }
      const manifestPath = safeTarget(projectDir, MANIFEST);
      if (!fs.existsSync(manifestPath)) throw new Error(notInstalledMessage(projectDir));
      let manifest;
      try {
        manifest = readInstallManifest(manifestPath);
      } catch (error) {
        throw new Error('Install manifest is unreadable or corrupt: ' + error.message, {
          cause: error,
        });
      }
      if (!isExactVersion(version) || !isExactVersion(manifest.version))
        throw new Error('Update versions must be strict semantic versions.');
      if (semver.lt(version, manifest.version))
        throw new Error('Downgrade refused: ' + manifest.version + ' -> ' + version);
      const lang = options.lang || manifest.uiLanguage || 'en';
      clack.log.info('Installed: v' + manifest.version + ' -> Executing package: v' + version);
      if (manifest.version === version) {
        clack.log.success(
          'The installed version matches this executing package. Use --latest to check the registry.'
        );
        clack.outro(pc.green('Nothing to update.'));
        return;
      }
      const plan = planUpdate({ projectDir, manifest, version, auto: Boolean(options.auto) });
      if (options.auto) {
        authorizeAuto(projectDir, version);
        const fresh = await require('../lib/update-check').checkForUpdate({
          projectDir,
          runningVersion: version,
          refresh: true,
        });
        if (
          fresh.source !== 'registry' ||
          fresh.stale ||
          !fresh.versionEligible ||
          fresh.targetVersion !== options.expectedVersion
        ) {
          throw new Error(
            'Automatic update requires a fresh, eligible registry target matching --expected-version.'
          );
        }
      }

      const removals = plan.files.filter((entry) => entry.afterHash === null).length;
      clack.log.info(
        'Planned changes: ' +
          (plan.files.length - 1) +
          ' files (' +
          removals +
          ' no longer shipped, removed with backup); preserved conflicts: ' +
          plan.conflicts.length +
          '.'
      );
      if (plan.legacy)
        clack.log.warn(
          'Legacy installation: original pack files will be backed up before replacement because ownership hashes are unavailable. Review the receipt to recover local edits.'
        );
      for (const conflict of plan.conflicts)
        clack.log.warn(conflict.file + ': preserved (' + conflict.reason + ').');
      if (
        !(await confirmAction(
          options,
          'Apply this update from v' + manifest.version + ' to v' + version + '?',
          lang
        ))
      )
        return;

      spinner = clack.spinner();
      spinner.start('Updating managed files...');
      const result = applyPlan(plan, { reauthorize: () => authorizeAuto(projectDir, version) });
      spinner.stop(
        result.changedFiles.length +
          ' files updated; ' +
          result.conflicts.length +
          ' local conflicts preserved.'
      );
      spinner = null;
      clack.log.info('Receipt and backups: ' + result.receiptPath);
      clack.outro(
        pc.green(
          'BMAD+ v' +
            version +
            (result.conflicts.length ? ' applied partially.' : ' installed.') +
            ' Reload your agent instructions or start a new session.'
        )
      );
    } catch (error) {
      if (spinner) spinner.stop('Update failed.');
      clack.log.error(error.message);
      process.exitCode = 1;
    }
  },
};
