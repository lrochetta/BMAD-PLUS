/**
 * BMAD+ Update Command
 * Updates agents and skills while preserving user config
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t } = require('../i18n');

// Same pack definitions as install.js — keep in sync
const PACKS = {
  core: {
    agents: ['agent-strategist', 'agent-architect-dev', 'agent-quality', 'agent-orchestrator'],
    skills: ['bmad-plus-autopilot', 'bmad-plus-parallel', 'bmad-plus-sync'],
    data: ['role-triggers.yaml'],
  },
  osint: {
    agents: ['agent-shadow'],
    skills: [],
    externalPackage: 'osint-agent-package',
  },
  maker: {
    agents: ['agent-maker'],
    skills: [],
    data: [],
  },
  seo: { agents: [], skills: [], packDir: 'pack-seo' },
  backup: { agents: [], skills: [], packDir: 'pack-backup' },
  animated: { agents: [], skills: [], packDir: 'pack-animated' },
};

module.exports = {
  command: 'update',
  description: 'Update BMAD+ agents and skills (preserves config)',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
  ],
  action: async (options) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const bmadSrc = path.join(__dirname, '..', '..', '..', 'src', 'bmad-plus');
    const packageJson = require('../../../package.json');

    clack.intro(pc.bgMagenta(pc.white(` BMAD+ Updater v${packageJson.version} `)));

    // Check if installed
    const manifestPath = path.join(projectDir, '_bmad', '.bmad-plus-install.json');
    if (!fs.existsSync(manifestPath)) {
      clack.log.error('BMAD+ is not installed in this directory.');
      clack.log.info('Run `npx bmad-plus install` first.');
      clack.outro(pc.red('Update aborted.'));
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const lang = manifest.uiLanguage || 'en';
    const i = t(lang);

    clack.log.info(`📦 Installed: v${manifest.version} → Available: v${packageJson.version}`);

    if (manifest.version === packageJson.version) {
      clack.log.success(i.update_current || '✅ Already up to date!');
      clack.outro(pc.green('Nothing to update.'));
      return;
    }

    const selectedPacks = manifest.packs || ['core'];
    clack.log.info(`${i.selected_packs}: ${selectedPacks.join(', ')}`);

    const confirm = await clack.confirm({
      message: i.update_confirm || `Update from v${manifest.version} to v${packageJson.version}?`,
    });

    if (!confirm || clack.isCancel(confirm)) {
      clack.cancel(i.cancelled);
      return;
    }

    const spinner = clack.spinner();
    spinner.start(i.update_updating || 'Updating agents and skills...');

    const targetAgentsDir = path.join(projectDir, '.agents', 'skills');
    const targetDataDir = path.join(projectDir, '.agents', 'data');

    fsExtra.ensureDirSync(targetAgentsDir);
    fsExtra.ensureDirSync(targetDataDir);

    let updated = 0;

    for (const packId of selectedPacks) {
      const pack = PACKS[packId];
      if (!pack) continue;

      // Update agents
      for (const agent of (pack.agents || [])) {
        const src = path.join(bmadSrc, 'agents', agent);
        const dest = path.join(targetAgentsDir, agent);
        if (fs.existsSync(src)) {
          fsExtra.copySync(src, dest, { overwrite: true });
          updated++;
        }
      }

      // Update skills
      for (const skill of (pack.skills || [])) {
        const src = path.join(bmadSrc, 'skills', skill);
        const dest = path.join(targetAgentsDir, skill);
        if (fs.existsSync(src)) {
          fsExtra.copySync(src, dest, { overwrite: true });
          updated++;
        }
      }

      // Update data files
      for (const dataFile of (pack.data || [])) {
        const src = path.join(bmadSrc, 'data', dataFile);
        const dest = path.join(targetDataDir, dataFile);
        if (fs.existsSync(src)) {
          fsExtra.copySync(src, dest, { overwrite: true });
          updated++;
        }
      }

      // Update external package (OSINT)
      if (pack.externalPackage) {
        const extSrc = path.join(__dirname, '..', '..', '..', pack.externalPackage, 'skills');
        if (fs.existsSync(extSrc)) {
          fsExtra.copySync(extSrc, targetAgentsDir, { overwrite: true });
          updated++;
        }
      }

      // Update pack directory (SEO, Backup, Animated)
      if (pack.packDir) {
        const packSrc = path.join(bmadSrc, 'agents', pack.packDir);
        const packDest = path.join(targetAgentsDir, pack.packDir);
        if (fs.existsSync(packSrc)) {
          fsExtra.copySync(packSrc, packDest, { overwrite: true });
          updated++;
        }
      }
    }

    // Update module config (always)
    const moduleYaml = path.join(bmadSrc, 'module.yaml');
    const targetBmadDir = path.join(projectDir, '_bmad');
    if (fs.existsSync(moduleYaml)) {
      fsExtra.copySync(moduleYaml, path.join(targetBmadDir, 'module.yaml'));
      updated++;
    }

    const helpCsv = path.join(bmadSrc, 'module-help.csv');
    if (fs.existsSync(helpCsv)) {
      fsExtra.copySync(helpCsv, path.join(targetBmadDir, 'module-help.csv'));
      updated++;
    }

    // Update manifest version (preserve everything else)
    manifest.version = packageJson.version;
    manifest.lastUpdated = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    spinner.stop(i.update_done ? i.update_done(updated) : `✅ ${updated} files updated to v${packageJson.version}`);

    clack.log.info('📋 Config preserved: config.yaml, IDE configs, output directories');
    clack.outro(pc.green(i.update_ready || `BMAD+ v${packageJson.version} is ready! 🚀`));
  },
};
