/**
 * BMAD+ Shared Pack-Copy Module
 * Extracted duplicate file-copy loops from install.js and update.js.
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const fsExtra = require('fs-extra');

/**
 * Copy files for a single pack definition into the target directories.
 *
 * @param {object} opts
 * @param {string} opts.bmadSrc      - Path to src/bmad-plus/
 * @param {string} opts.targetAgentsDir - Destination for agents / skills
 * @param {string} opts.targetDataDir   - Destination for data files
 * @param {string} opts.projectRoot    - Project root (for external package resolution)
 * @param {object} opts.pack           - Pack definition from PACKS
 * @returns {{ copiedAgents: number, copiedSkills: number, copiedFiles: number }}
 */
function copyPackFiles({ bmadSrc, targetAgentsDir, targetDataDir, projectRoot, pack }) {
  let copiedAgents = 0;
  let copiedSkills = 0;
  let copiedFiles = 0;

  if (!pack) return { copiedAgents, copiedSkills, copiedFiles };

  // Copy agents
  for (const agent of (pack.agents || [])) {
    const src = path.join(bmadSrc, 'agents', agent);
    const dest = path.join(targetAgentsDir, agent);
    if (fs.existsSync(src)) {
      fsExtra.copySync(src, dest, { overwrite: true });
      copiedAgents++;
    }
  }

  // Copy skills
  for (const skill of (pack.skills || [])) {
    const src = path.join(bmadSrc, 'skills', skill);
    const dest = path.join(targetAgentsDir, skill);
    if (fs.existsSync(src)) {
      fsExtra.copySync(src, dest, { overwrite: true });
      copiedSkills++;
    }
  }

  // Copy data files
  for (const dataFile of (pack.data || [])) {
    const src = path.join(bmadSrc, 'data', dataFile);
    const dest = path.join(targetDataDir, dataFile);
    if (fs.existsSync(src)) {
      fsExtra.copySync(src, dest, { overwrite: true });
      copiedFiles++;
    }
  }

  // Copy external package (e.g. OSINT)
  if (pack.externalPackage) {
    const extSrc = path.join(projectRoot, pack.externalPackage, 'skills');
    if (fs.existsSync(extSrc)) {
      fsExtra.copySync(extSrc, targetAgentsDir, { overwrite: true });
      copiedSkills++;
    }
  }

  // Copy pack directory (SEO, Backup, Animated, Shield, etc.)
  if (pack.packDir) {
    const srcParent = pack.packSrcDir || 'agents';
    const packSrc = path.join(bmadSrc, srcParent, pack.packDir);
    const packDest = path.join(targetAgentsDir, pack.packDir);
    if (fs.existsSync(packSrc)) {
      fsExtra.copySync(packSrc, packDest, { overwrite: true });
      copiedAgents++;
      copiedFiles++;
    }
  }

  return { copiedAgents, copiedSkills, copiedFiles };
}

module.exports = { copyPackFiles };
