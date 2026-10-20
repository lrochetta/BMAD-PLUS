/** Read the manifest fields used by maintenance commands without unsafe coercion. */
const fs = require('node:fs');
const path = require('node:path');

function readInstallManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    typeof manifest.version !== 'string' ||
    !manifest.version.trim() ||
    typeof manifest.installed !== 'string' ||
    !Number.isFinite(Date.parse(manifest.installed)) ||
    !Array.isArray(manifest.packs) ||
    manifest.packs.length === 0 ||
    manifest.packs.some((pack) => typeof pack !== 'string' || !/^[a-z0-9-]+$/.test(pack)) ||
    (manifest.uiLanguage !== undefined && typeof manifest.uiLanguage !== 'string')
  ) {
    throw new Error('Expected version, installed date, and a nonempty array of pack IDs.');
  }
  return manifest;
}

/**
 * Guidance for maintenance commands run outside an installed project. A person who
 * opens a terminal in a drive root or a parent folder must learn where to run them.
 */
function notInstalledMessage(projectDir) {
  return [
    `No BMAD+ installation found in ${projectDir} (missing _bmad/.bmad-plus-install.json).`,
    'Run this command from your project folder, for example: cd "path/to/your-project"',
    'or pass the folder explicitly: --directory "path/to/your-project".',
    'To install BMAD+ in this folder instead: npx bmad-plus@latest install',
  ].join('\n');
}

function hasInstallManifest(projectDir) {
  return fs.existsSync(path.join(projectDir, '_bmad', '.bmad-plus-install.json'));
}

module.exports = { readInstallManifest, notInstalledMessage, hasInstallManifest };
