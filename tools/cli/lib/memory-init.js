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
const { projectHash } = require('./path-hash');

/**
 * True when `p` exists AND is a directory. A stray *file* named `_brain` (or a
 * file-valued BMAD_PLUS_BRAIN) must never be linked as a brain.
 * @param {string} p
 * @returns {boolean}
 */
function isBrainCandidateDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the brain directory a project should link to.
 *
 * Priority order:
 *  1. `BMAD_PLUS_BRAIN` env var — explicit override, wins everywhere
 *  2. A `_brain/` directory in the project dir or any ancestor (portfolio brain
 *     shared by sibling projects under a common workspace root)
 *  3. `<home>/.bmad-plus/brain` — BMAD+ global brain
 *  4. `<home>/.claude/memory` — Claude Code persistent memory, only when it is
 *     a non-empty directory (an empty shell is not evidence of a real memory)
 *
 * @param {string} projectDir - Absolute path of the target project
 * @param {string} [homeDir]  - Home directory (injectable for tests; defaults to os.homedir())
 * @returns {{dir: string, type: 'portfolio'|'bmad-global'|'claude-memory'}|null}
 */
function resolveBrain(projectDir, homeDir = os.homedir()) {
  const envBrain = process.env.BMAD_PLUS_BRAIN;
  if (envBrain) {
    if (isBrainCandidateDir(envBrain)) return { dir: envBrain, type: 'portfolio' };
    clack.log.warn(
      `BMAD_PLUS_BRAIN is set but is not a directory: ${envBrain} — falling back to auto-detection`
    );
  }

  let dir = path.resolve(projectDir);
  for (;;) {
    const candidate = path.join(dir, '_brain');
    if (isBrainCandidateDir(candidate)) return { dir: candidate, type: 'portfolio' };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const globalBrain = path.join(homeDir, '.bmad-plus', 'brain');
  if (isBrainCandidateDir(globalBrain)) return { dir: globalBrain, type: 'bmad-global' };

  const claudeMemory = path.join(homeDir, '.claude', 'memory');
  if (isBrainCandidateDir(claudeMemory)) {
    let entries;
    try {
      entries = fs.readdirSync(claudeMemory);
    } catch {
      entries = [];
    }
    if (entries.length > 0) return { dir: claudeMemory, type: 'claude-memory' };
  }

  return null;
}

/**
 * Idempotently ensure the global brain is COMPLETE: identity.yaml, the global
 * memory files, and projects/. Creates only what is missing, never overwrites.
 *
 * This must run before ANY write into the global brain: older versions wrote
 * the projects/ index unconditionally while identity creation lived in a
 * branch that was skipped whenever any brain was detected — leaving a
 * permanent "half brain" (projects/ but no identity.yaml) that resolveBrain
 * then detected as a valid global brain forever.
 *
 * @param {string} brainRoot   - Path to <home>/.bmad-plus/brain
 * @param {string} templateDir - Path to pack-memory templates
 * @param {string} userName    - User display name (identity.yaml)
 * @param {string} commLang    - Communication language (identity.yaml)
 * @returns {void}
 */
function ensureGlobalBrain(brainRoot, templateDir, userName, commLang) {
  fsExtra.ensureDirSync(path.join(brainRoot, 'projects'));

  const identitySrc = path.join(templateDir, 'identity.yaml');
  const identityDest = path.join(brainRoot, 'identity.yaml');
  if (fs.existsSync(identitySrc) && !fs.existsSync(identityDest)) {
    let content = fs.readFileSync(identitySrc, 'utf8');
    content = content.replace(/\{\{user_name\}\}/g, userName);
    content = content.replace(/\{\{language\}\}/g, commLang);
    content = content.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
    fs.writeFileSync(identityDest, content, 'utf8');
  }

  for (const gf of ['decisions.md', 'lessons.md', 'patterns.md']) {
    const dest = path.join(brainRoot, gf);
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
}

/**
 * Initialize the memory pack: create project memory files, detect or create global brain.
 *
 * @param {object} opts
 * @param {string} opts.projectDir     - Target project directory
 * @param {string} opts.bmadSrc        - Path to src/bmad-plus/
 * @param {string} opts.userName       - User display name
 * @param {string} opts.commLang       - Communication language
 * @param {string[]} opts.selectedPacks - Array of pack IDs being installed
 * @param {string} [opts.homeDir]      - Home directory (injectable for tests; defaults to os.homedir())
 * @returns {void}
 */
function initMemory({
  projectDir,
  bmadSrc,
  userName,
  commLang,
  selectedPacks,
  homeDir = os.homedir(),
}) {
  const memoryDir = path.join(projectDir, '.agents', 'memory');
  const sessionsDir = path.join(memoryDir, 'sessions');
  const globalBrainRoot = path.join(homeDir, '.bmad-plus', 'brain');
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

  // Detect existing brain (env var > portfolio _brain walk-up > global > claude)
  const detected = resolveBrain(projectDir, homeDir);

  let linkedBrain;
  if (detected) {
    clack.log.info(`🧠 Existing brain detected (${detected.type}): ${detected.dir}`);
    linkedBrain = detected;
  } else {
    ensureGlobalBrain(globalBrainRoot, templateDir, userName, commLang);
    clack.log.info(`🧠 Global brain created: ${globalBrainRoot}`);
    linkedBrain = { dir: globalBrainRoot, type: 'bmad-global' };
  }

  // Write the brain link pointer in EVERY case — including first-ever creation,
  // so a fresh machine's first install is linked exactly like the second one.
  fs.writeFileSync(
    path.join(memoryDir, '.brain-link'),
    JSON.stringify(
      {
        linked_brain: linkedBrain.dir,
        brain_type: linkedBrain.type,
        linked_at: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );

  // Index this project in the global brain — only when the global brain IS the
  // linked brain. Portfolio and claude-memory brains keep their own registries
  // (see pack-memory/shared/memory-protocol.md); writing into ~/.bmad-plus from
  // those installs is what used to create orphaned "half brains".
  if (linkedBrain.type === 'bmad-global') {
    ensureGlobalBrain(globalBrainRoot, templateDir, userName, commLang);
    const projHash = projectHash(projectDir);
    const projMeta = {
      path: projectDir,
      name: path.basename(projectDir),
      hash: projHash,
      status: 'active',
      bmad_installed: true,
      packs_installed: selectedPacks,
      last_scanned: new Date().toISOString().slice(0, 10),
    };
    fs.writeFileSync(
      path.join(globalBrainRoot, 'projects', `${projHash}.yaml`),
      Object.entries(projMeta)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n'),
      'utf8'
    );
  }
}

module.exports = { initMemory, resolveBrain, ensureGlobalBrain };
