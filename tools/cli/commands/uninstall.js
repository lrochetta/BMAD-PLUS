/**
 * BMAD+ Uninstall Command
 * Removes BMAD+ agents, skills, and configs from the current project
 * Internationalized — uses i18n system
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t, getLanguageOptions } = require('../i18n');

module.exports = {
  command: 'uninstall',
  description: 'Remove BMAD+ from your project',
  action: async () => {
    const projectDir = process.cwd();

    clack.intro(pc.bgRed(pc.white(' BMAD+ Uninstaller ')));

    // Check if installed
    const manifestPath = path.join(projectDir, '_bmad', '.bmad-plus-install.json');
    if (!fs.existsSync(manifestPath)) {
      clack.log.warn('BMAD+ is not installed in this directory.');
      clack.outro('Nothing to remove.');
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Use the language from install manifest, or ask
    let lang = manifest.uiLanguage || 'en';
    const i = t(lang);

    clack.log.info(`BMAD+ v${manifest.version} (${i.installed_on || 'installed'} ${manifest.installed.split('T')[0]})`);
    clack.log.info(`${i.selected_packs}: ${(manifest.packs || ['core']).join(', ')}`);

    const confirm = await clack.confirm({
      message: i.uninstall_confirm || 'Remove BMAD+ from this project?',
    });

    if (!confirm || clack.isCancel(confirm)) {
      clack.cancel(i.cancelled);
      return;
    }

    const spinner = clack.spinner();
    spinner.start(i.uninstall_removing || 'Removing...');

    let removed = 0;

    // Remove .agents/skills/ (BMAD+ agents & skills)
    const agentsDir = path.join(projectDir, '.agents');
    if (fs.existsSync(agentsDir)) {
      fsExtra.removeSync(agentsDir);
      removed++;
    }

    // Remove _bmad/ config
    const bmadDir = path.join(projectDir, '_bmad');
    if (fs.existsSync(bmadDir)) {
      fsExtra.removeSync(bmadDir);
      removed++;
    }

    // Remove _bmad-output/ (only if empty)
    const outputDir = path.join(projectDir, '_bmad-output');
    if (fs.existsSync(outputDir)) {
      const contents = fs.readdirSync(outputDir, { recursive: true }).filter(f => !f.startsWith('.'));
      if (contents.length === 0) {
        fsExtra.removeSync(outputDir);
        removed++;
      } else {
        clack.log.info(i.uninstall_output_kept || '📁 _bmad-output/ kept (contains files)');
      }
    }

    // Remove IDE configs (only BMAD+-generated ones)
    for (const configFile of ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'OPENCODE.md']) {
      const p = path.join(projectDir, configFile);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        if (content.includes('BMAD+')) {
          fs.unlinkSync(p);
          removed++;
        }
      }
    }

    spinner.stop(i.uninstall_done ? i.uninstall_done(removed) : `✅ BMAD+ removed (${removed} items)`);
    clack.outro(pc.green(i.guide_ready ? '👋 Done!' : 'Done!'));
  },
};
