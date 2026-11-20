/**
 * BMAD+ Path Hashing — shared project-identity hashing for the global brain index.
 *
 * Single source of truth: memory-init.js and scan.js MUST produce identical
 * hashes for the same project, or the brain index double-counts it (one entry
 * per drive-letter casing on Windows).
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Normalize a filesystem path for stable hashing.
 * On Windows the same project can be referenced as `D:\proj` or `d:\proj`
 * (case-insensitive drive) with mixed separators. Resolving + lowercasing the
 * drive letter ensures the same project produces the same index key and is not
 * double-indexed.
 * @param {string} p - Raw filesystem path
 * @returns {string} Normalized path suitable for hashing
 */
function normalizePathForHash(p) {
  let resolved = path.resolve(p);
  // Lowercase a leading Windows drive letter (e.g. "D:" → "d:").
  resolved = resolved.replace(/^([A-Za-z]):/, (_m, drive) => drive.toLowerCase() + ':');
  return resolved;
}

/**
 * Stable 8-hex-char identity hash for a project directory.
 * @param {string} projectDir - Raw project path (normalized internally)
 * @returns {string} 8-character hex hash
 */
function projectHash(projectDir) {
  return crypto
    .createHash('sha256')
    .update(normalizePathForHash(projectDir))
    .digest('hex')
    .slice(0, 8);
}

module.exports = { normalizePathForHash, projectHash };
