/**
 * BMAD+ Uninstall Command
 * Removes BMAD+ agents, skills, and configs from the current project
 */

const path = require('node:path');
const fs = require('node:fs');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');

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
    clack.log.info(`Found BMAD+ v${manifest.version} (installed ${manifest.installed})`);

    const confirm = await clack.confirm({
      message: 'Supprimer BMAD+ de ce projet ?',
    });

    if (!confirm || clack.isCancel(confirm)) {
      clack.cancel('Cancelled.');
      return;
    }

    const spinner = clack.spinner();
    spinner.start('Suppression...');

    // Remove .agents/skills/ (BMAD+ agents & skills)
    const agentsDir = path.join(projectDir, '.agents');
    if (fs.existsSync(agentsDir)) {
      fsExtra.removeSync(agentsDir);
    }

    // Remove _bmad/ config
    const bmadDir = path.join(projectDir, '_bmad');
    if (fs.existsSync(bmadDir)) {
      fsExtra.removeSync(bmadDir);
    }

    // Remove IDE configs
    for (const configFile of ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'OPENCODE.md']) {
      const p = path.join(projectDir, configFile);
      if (fs.existsSync(p)) {
        // Only remove if it's a BMAD+ generated file
        const content = fs.readFileSync(p, 'utf8');
        if (content.includes('BMAD+')) {
          fs.unlinkSync(p);
        }
      }
    }

    spinner.stop('✅ BMAD+ supprimé');
    clack.outro(pc.green('Done!'));
  },
};
