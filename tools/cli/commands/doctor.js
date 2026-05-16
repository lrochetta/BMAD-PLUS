/**
 * BMAD+ Doctor Command
 * Checks installation integrity and reports issues
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t } = require('../i18n');

module.exports = {
  command: 'doctor',
  description: 'Check BMAD+ installation integrity',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
  ],
  action: async (options) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const packageJson = require('../../../package.json');

    clack.intro(pc.bgBlue(pc.white(` BMAD+ Doctor v${packageJson.version} `)));

    let checks = 0;
    let passed = 0;
    let warnings = 0;
    let errors = 0;

    // ── Check 1: Installation manifest ──
    checks++;
    const manifestPath = path.join(projectDir, '_bmad', '.bmad-plus-install.json');
    if (!fs.existsSync(manifestPath)) {
      clack.log.error('❌ BMAD+ is not installed in this directory');
      clack.outro(pc.red('Run `npx bmad-plus install` first.'));
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    clack.log.success(`✅ Manifest found — v${manifest.version}`);
    passed++;

    // ── Check 2: Version comparison ──
    checks++;
    if (manifest.version === packageJson.version) {
      clack.log.success(`✅ Version up to date (v${manifest.version})`);
      passed++;
    } else {
      clack.log.warn(`⚠️  Version mismatch: installed v${manifest.version} → latest v${packageJson.version}`);
      clack.log.info('   Run `npx bmad-plus update` to upgrade');
      warnings++;
    }

    // ── Check 3: Agent files ──
    checks++;
    const agentsDir = path.join(projectDir, '.agents', 'skills');
    if (fs.existsSync(agentsDir)) {
      const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      clack.log.success(`✅ ${agentDirs.length} agent/skill directories found`);
      passed++;

      // Check each expected agent from manifest packs
      const expectedAgents = {
        core: ['agent-strategist', 'agent-architect-dev', 'agent-quality', 'agent-orchestrator'],
        osint: ['agent-shadow'],
        maker: ['agent-maker'],
        seo: ['pack-seo'],
        backup: ['pack-backup'],
        animated: ['pack-animated'],
      };

      for (const pack of (manifest.packs || ['core'])) {
        const expected = expectedAgents[pack] || [];
        for (const agent of expected) {
          checks++;
          const agentPath = path.join(agentsDir, agent);
          if (fs.existsSync(agentPath)) {
            passed++;
          } else {
            clack.log.warn(`⚠️  Missing agent: ${agent} (pack: ${pack})`);
            warnings++;
          }
        }
      }
    } else {
      clack.log.error('❌ No .agents/skills/ directory found');
      errors++;
    }

    // ── Check 4: Config files ──
    checks++;
    const configPath = path.join(projectDir, '_bmad', 'config.yaml');
    if (fs.existsSync(configPath)) {
      clack.log.success('✅ config.yaml present');
      passed++;
    } else {
      clack.log.error('❌ config.yaml missing');
      errors++;
    }

    // ── Check 5: Module config ──
    checks++;
    const moduleYaml = path.join(projectDir, '_bmad', 'module.yaml');
    if (fs.existsSync(moduleYaml)) {
      clack.log.success('✅ module.yaml present');
      passed++;
    } else {
      clack.log.warn('⚠️  module.yaml missing');
      warnings++;
    }

    // ── Check 6: IDE configs ──
    checks++;
    const ideFiles = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md'].filter(f =>
      fs.existsSync(path.join(projectDir, f))
    );
    if (ideFiles.length > 0) {
      clack.log.success(`✅ ${ideFiles.length} IDE config(s): ${ideFiles.join(', ')}`);
      passed++;
    } else {
      clack.log.warn('⚠️  No IDE config files found');
      warnings++;
    }

    // ── Check 7: Output directories ──
    checks++;
    const outputDir = path.join(projectDir, '_bmad-output');
    if (fs.existsSync(outputDir)) {
      clack.log.success('✅ _bmad-output/ directory exists');
      passed++;
    } else {
      clack.log.warn('⚠️  _bmad-output/ not found');
      warnings++;
    }

    // ── Check 8: Skills integrity (SKILL.md exists in pack dirs) ──
    if (manifest.packs && manifest.packs.includes('seo')) {
      checks++;
      const seoSkill = path.join(agentsDir, 'pack-seo', 'SKILL.md');
      if (fs.existsSync(seoSkill)) {
        clack.log.success('✅ SEO Engine SKILL.md present');
        passed++;
      } else {
        clack.log.error('❌ SEO Engine SKILL.md missing — /seo audit will not work');
        errors++;
      }
    }

    // ── Summary ──
    const summaryColor = errors > 0 ? pc.red : warnings > 0 ? pc.yellow : pc.green;
    const summaryIcon = errors > 0 ? '❌' : warnings > 0 ? '⚠️' : '✅';

    clack.note([
      `${summaryIcon} ${passed}/${checks} checks passed`,
      errors > 0 ? `❌ ${errors} error(s)` : null,
      warnings > 0 ? `⚠️  ${warnings} warning(s)` : null,
      '',
      `📦 Version: v${manifest.version}`,
      `📅 Installed: ${manifest.installed.split('T')[0]}`,
      `🗣️  Language: ${manifest.language || 'N/A'}`,
      `📦 Packs: ${(manifest.packs || ['core']).join(', ')}`,
    ].filter(Boolean).join('\n'), '🩺 BMAD+ Health Report');

    clack.outro(summaryColor(
      errors > 0
        ? 'Issues found — run `npx bmad-plus install` to fix'
        : warnings > 0
          ? 'Minor issues found — consider running `npx bmad-plus update`'
          : 'Everything looks great! 🎉'
    ));
  },
};
