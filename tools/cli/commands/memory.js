/**
 * BMAD+ Memory Command
 * Manage persistent brain: status, export, consolidate
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const clack = require('@clack/prompts');
const pc = require('picocolors');

function countEntries(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, count: 0, lastModified: null };
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const entries = content.match(/^### /gm);
    const stat = fs.statSync(filePath);
    return {
      exists: true,
      count: entries ? entries.length : 0,
      lastModified: stat.mtime.toISOString().slice(0, 10),
      sizeKB: (stat.size / 1024).toFixed(1),
    };
  } catch {
    return { exists: true, count: 0, lastModified: null };
  }
}

function countSessions(dir) {
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.md')).length;
  } catch { return 0; }
}

module.exports = {
  command: 'memory',
  description: 'Manage BMAD+ persistent brain (status, export)',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
  ],
  subcommands: {
    status: 'Show memory health report',
    export: 'Export brain as portable archive',
  },
  action: async (subcommand, options) => {
    const projectDir = path.resolve(options?.directory || process.cwd());
    const cmd = subcommand || 'status';

    clack.intro(pc.bgMagenta(pc.white(' 🧠 BMAD+ Memory Manager ')));

    if (cmd === 'status') {
      // ── Project Memory ──
      const memoryDir = path.join(projectDir, '.agents', 'memory');
      const hasProjectMemory = fs.existsSync(memoryDir);

      clack.log.info(pc.bold('\n📁 Project Memory') + pc.dim(` (${projectDir})`));

      if (hasProjectMemory) {
        const decisions = countEntries(path.join(memoryDir, 'decisions.md'));
        const lessons = countEntries(path.join(memoryDir, 'lessons.md'));
        const patterns = countEntries(path.join(memoryDir, 'patterns.md'));
        const context = countEntries(path.join(memoryDir, 'context.md'));
        const sessions = countSessions(path.join(memoryDir, 'sessions'));
        const brainLink = fs.existsSync(path.join(memoryDir, '.brain-link'));

        clack.log.info(`  decisions.md     ${decisions.exists ? pc.green('✓') : pc.red('✗')}  ${decisions.count} entries  ${pc.dim(decisions.lastModified || '')}`);
        clack.log.info(`  lessons.md       ${lessons.exists ? pc.green('✓') : pc.red('✗')}  ${lessons.count} entries  ${pc.dim(lessons.lastModified || '')}`);
        clack.log.info(`  patterns.md      ${patterns.exists ? pc.green('✓') : pc.red('✗')}  ${patterns.count} entries  ${pc.dim(patterns.lastModified || '')}`);
        clack.log.info(`  context.md       ${context.exists ? pc.green('✓') : pc.red('✗')}  ${pc.dim(context.lastModified || '')}`);
        clack.log.info(`  sessions/        ${sessions > 0 ? pc.green('✓') : pc.dim('·')}  ${sessions} handoff(s)`);

        if (brainLink) {
          try {
            const link = JSON.parse(fs.readFileSync(path.join(memoryDir, '.brain-link'), 'utf8'));
            clack.log.info(`  ${pc.cyan('🔗 Linked brain')}: ${link.linked_brain}`);
          } catch {
            clack.log.info(`  ${pc.cyan('🔗 Brain link exists')}`);
          }
        }
      } else {
        clack.log.warn('  Not installed. Run: npx bmad-plus install (select Memory pack)');
      }

      // ── Global Brain ──
      const globalBrainDir = path.join(os.homedir(), '.bmad-plus', 'brain');
      const hasGlobalBrain = fs.existsSync(globalBrainDir);

      clack.log.info(pc.bold('\n🌐 Global Brain') + pc.dim(` (${globalBrainDir})`));

      if (hasGlobalBrain) {
        const identity = fs.existsSync(path.join(globalBrainDir, 'identity.yaml'));
        const gDecisions = countEntries(path.join(globalBrainDir, 'decisions.md'));
        const gLessons = countEntries(path.join(globalBrainDir, 'lessons.md'));
        const gPatterns = countEntries(path.join(globalBrainDir, 'patterns.md'));

        const projectsDir = path.join(globalBrainDir, 'projects');
        let projectCount = 0;
        if (fs.existsSync(projectsDir)) {
          projectCount = fs.readdirSync(projectsDir).filter(f => f.endsWith('.yaml')).length;
        }

        const indexExists = fs.existsSync(path.join(globalBrainDir, 'projects-index.md'));

        clack.log.info(`  identity.yaml    ${identity ? pc.green('✓') : pc.yellow('✗ missing')}`);
        clack.log.info(`  decisions.md     ${gDecisions.exists ? pc.green('✓') : pc.dim('·')}  ${gDecisions.count} entries`);
        clack.log.info(`  lessons.md       ${gLessons.exists ? pc.green('✓') : pc.dim('·')}  ${gLessons.count} entries`);
        clack.log.info(`  patterns.md      ${gPatterns.exists ? pc.green('✓') : pc.dim('·')}  ${gPatterns.count} entries`);
        clack.log.info(`  projects/        ${pc.green('✓')}  ${projectCount} project(s) indexed`);
        clack.log.info(`  projects-index   ${indexExists ? pc.green('✓') : pc.dim('·')}`);
      } else {
        clack.log.warn('  Not initialized. Run: npx bmad-plus install (select Memory pack)');
      }

      // ── Health Score ──
      let score = 0;
      let maxScore = 0;

      if (hasProjectMemory) {
        const checks = [
          fs.existsSync(path.join(memoryDir, 'decisions.md')),
          fs.existsSync(path.join(memoryDir, 'lessons.md')),
          fs.existsSync(path.join(memoryDir, 'patterns.md')),
          fs.existsSync(path.join(memoryDir, 'context.md')),
          countSessions(path.join(memoryDir, 'sessions')) > 0,
        ];
        maxScore += checks.length;
        score += checks.filter(Boolean).length;
      }

      if (hasGlobalBrain) {
        const gChecks = [
          fs.existsSync(path.join(globalBrainDir, 'identity.yaml')),
          fs.existsSync(path.join(globalBrainDir, 'decisions.md')),
          fs.existsSync(path.join(globalBrainDir, 'lessons.md')),
          fs.existsSync(path.join(globalBrainDir, 'patterns.md')),
          fs.existsSync(path.join(globalBrainDir, 'projects')),
        ];
        maxScore += gChecks.length;
        score += gChecks.filter(Boolean).length;
      }

      if (maxScore > 0) {
        const pct = Math.round((score / maxScore) * 100);
        const color = pct >= 80 ? pc.green : pct >= 50 ? pc.yellow : pc.red;
        clack.log.info('');
        clack.log.info(pc.bold(`🏥 Health: ${color(`${pct}%`)} (${score}/${maxScore} checks)`));
      }

      clack.log.info('');
    } else if (cmd === 'export') {
      // Export brain as text dump
      const globalBrainDir = path.join(os.homedir(), '.bmad-plus', 'brain');
      if (!fs.existsSync(globalBrainDir)) {
        clack.log.error('Global brain not found. Nothing to export.');
        clack.outro(pc.red('Export failed.'));
        return;
      }

      const exportPath = path.join(projectDir, `bmad-brain-export-${new Date().toISOString().slice(0, 10)}.md`);
      const sections = [];

      sections.push('# BMAD+ Brain Export', `> Exported: ${new Date().toISOString()}`, '');

      for (const file of ['identity.yaml', 'decisions.md', 'lessons.md', 'patterns.md']) {
        const fp = path.join(globalBrainDir, file);
        if (fs.existsSync(fp)) {
          sections.push(`## ${file}`, '```', fs.readFileSync(fp, 'utf8').trim(), '```', '');
        }
      }

      // Project index
      const projectsDir = path.join(globalBrainDir, 'projects');
      if (fs.existsSync(projectsDir)) {
        sections.push('## Projects', '');
        for (const f of fs.readdirSync(projectsDir)) {
          if (f.endsWith('.yaml')) {
            sections.push(`### ${f}`, '```yaml', fs.readFileSync(path.join(projectsDir, f), 'utf8').trim(), '```', '');
          }
        }
      }

      fs.writeFileSync(exportPath, sections.join('\n'), 'utf8');
      clack.log.success(`📦 Brain exported to: ${exportPath}`);
    } else {
      clack.log.error(`Unknown subcommand: ${cmd}`);
      clack.log.info('Available: status, export');
    }

    clack.outro(pc.green('Done! 🧠'));
  },
};
