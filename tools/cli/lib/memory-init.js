/**
 * BMAD+ Memory Initialization Module
 * Extracted from install.js — initializes brain with existing brain detection.
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');

/**
 * Initialize the memory pack: create project memory files, detect or create global brain.
 *
 * @param {object} opts
 * @param {string} opts.projectDir     - Target project directory
 * @param {string} opts.bmadSrc        - Path to src/bmad-plus/
 * @param {string} opts.userName       - User display name
 * @param {string} opts.commLang       - Communication language
 * @param {string[]} opts.selectedPacks - Array of pack IDs being installed
 * @param {object} opts.i              - i18n translations object
 * @returns {void}
 */
function initMemory({ projectDir, bmadSrc, userName, commLang, selectedPacks }) {
  const memoryDir = path.join(projectDir, '.agents', 'memory');
  const sessionsDir = path.join(memoryDir, 'sessions');
  const globalBrainDir = path.join(os.homedir(), '.bmad-plus', 'brain', 'projects');
  const templateDir = path.join(bmadSrc, 'packs', 'pack-memory', 'templates');

  // Create project memory (never overwrite existing)
  fsExtra.ensureDirSync(sessionsDir);
  const memoryFiles = ['decisions.md', 'lessons.md', 'patterns.md', 'context.md'];
  for (const mf of memoryFiles) {
    const dest = path.join(memoryDir, mf);
    if (!fs.existsSync(dest)) {
      const src = path.join(templateDir, mf);
      if (fs.existsSync(src)) {
        let content = fs.readFileSync(src, 'utf8');
        content = content.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
        content = content.replace(/\{\{project_name\}\}/g, path.basename(projectDir));
        content = content.replace(/\{\{project_path\}\}/g, projectDir);
        fs.writeFileSync(dest, content, 'utf8');
      }
    }
  }

  // Detect existing brain directories
  const brainCandidates = [
    path.join(os.homedir(), '.bmad-plus', 'brain'),
    path.join(projectDir, '_brain'),
    path.join(os.homedir(), '.claude', 'memory'),
  ];
  const existingBrain = brainCandidates.find(p => fs.existsSync(p));

  if (existingBrain) {
    clack.log.info(`🧠 Existing brain detected: ${existingBrain}`);
    // Write brain link pointer
    fs.writeFileSync(
      path.join(memoryDir, '.brain-link'),
      JSON.stringify({ linked_brain: existingBrain, linked_at: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } else {
    // Create fresh global brain
    fsExtra.ensureDirSync(globalBrainDir);
    const identitySrc = path.join(templateDir, 'identity.yaml');
    const identityDest = path.join(os.homedir(), '.bmad-plus', 'brain', 'identity.yaml');
    if (fs.existsSync(identitySrc) && !fs.existsSync(identityDest)) {
      let content = fs.readFileSync(identitySrc, 'utf8');
      content = content.replace(/\{\{user_name\}\}/g, userName);
      content = content.replace(/\{\{language\}\}/g, commLang);
      content = content.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
      fs.writeFileSync(identityDest, content, 'utf8');
    }
    // Copy global memory templates
    for (const gf of ['decisions.md', 'lessons.md', 'patterns.md']) {
      const dest = path.join(os.homedir(), '.bmad-plus', 'brain', gf);
      if (!fs.existsSync(dest)) {
        const src = path.join(templateDir, gf);
        if (fs.existsSync(src)) {
          let content = fs.readFileSync(src, 'utf8');
          content = content.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
          content = content.replace(/\{\{project_name\}\}/g, 'Global Brain');
          fs.writeFileSync(dest, content, 'utf8');
        }
      }
    }
    clack.log.info(`🧠 Global brain created: ${path.join(os.homedir(), '.bmad-plus', 'brain')}`);
  }

  // Index this project in global brain
  const crypto = require('node:crypto');
  const projHash = crypto.createHash('sha256').update(projectDir).digest('hex').slice(0, 8);
  const projMeta = {
    path: projectDir,
    name: path.basename(projectDir),
    hash: projHash,
    status: 'active',
    bmad_installed: true,
    packs_installed: selectedPacks,
    last_scanned: new Date().toISOString().slice(0, 10),
  };
  fsExtra.ensureDirSync(globalBrainDir);
  fs.writeFileSync(
    path.join(globalBrainDir, `${projHash}.yaml`),
    Object.entries(projMeta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n'),
    'utf8'
  );
}

module.exports = { initMemory };
