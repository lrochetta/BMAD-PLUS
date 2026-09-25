/**
 * BMAD+ Uninstall Command
 * Removes identifiable BMAD+ files while preserving project memory and edits.
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t } = require('../i18n');
const { PACKS, DERIVED } = require('../lib/packs');
const { readInstallManifest } = require('../lib/install-manifest');
const { generateUserFiles, USER_CONFIG_MARKER } = require('../../build/generate-adapters');
const { contentHash } = require('../lib/installed-adapters');

// Never follow a junction/symlink in a path used for deletion, including parents.
function safeStat(projectDir, target) {
  const relative = path.relative(projectDir, target);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Path outside the project: ' + target);
  }
  let current = projectDir;
  let stat;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      stat = fs.lstatSync(current);
    } catch (err) {
      if (err.code === 'ENOENT') return undefined;
      throw err;
    }
    if (stat.isSymbolicLink()) {
      const error = new Error('Symbolic link or junction: ' + current);
      error.code = 'BMAD_UNSAFE_LINK';
      throw error;
    }
  }
  return stat;
}

function removalPlan(projectDir, manifest, manifestPath) {
  const packageRoot = path.join(__dirname, '..', '..', '..');
  const sourceRoot = path.join(packageRoot, 'src', 'bmad-plus');
  const files = new Map();
  const directories = new Set();
  const targetPath = (...parts) => path.join(projectDir, ...parts);

  // Old manifests contain pack IDs, not file hashes. Match shipped files byte for
  // byte; anything unknown or modified stays, including files inside a pack.
  function matchSource(source, target) {
    const targetStat = safeStat(projectDir, target);
    if (!targetStat || !fs.existsSync(source)) return;
    const sourceStat = fs.lstatSync(source);
    if (sourceStat.isDirectory() && targetStat.isDirectory()) {
      directories.add(target);
      for (const name of fs.readdirSync(source))
        matchSource(path.join(source, name), path.join(target, name));
    } else if (sourceStat.isFile() && targetStat.isFile()) {
      const expected = fs.readFileSync(source);
      if (fs.readFileSync(target).equals(expected)) files.set(target, expected);
    }
  }

  for (const relative of ['.agents', '.agents/skills', '.agents/data', '_bmad', '_bmad-output']) {
    const target = targetPath(relative);
    if (safeStat(projectDir, target)?.isDirectory()) directories.add(target);
  }

  for (const packId of manifest.packs) {
    if (!Object.hasOwn(PACKS, packId)) throw new Error('Unknown installed pack: ' + packId);
    const pack = PACKS[packId];
    for (const name of pack.agents || [])
      matchSource(path.join(sourceRoot, 'agents', name), targetPath('.agents', 'skills', name));
    for (const name of pack.skills || [])
      matchSource(path.join(sourceRoot, 'skills', name), targetPath('.agents', 'skills', name));
    for (const name of pack.data || [])
      matchSource(path.join(sourceRoot, 'data', name), targetPath('.agents', 'data', name));
    if (pack.packDir)
      matchSource(
        path.join(sourceRoot, pack.packSrcDir || 'agents', pack.packDir),
        targetPath('.agents', 'skills', pack.packDir)
      );
    if (pack.externalPackage)
      matchSource(
        path.join(packageRoot, pack.externalPackage, 'skills'),
        targetPath('.agents', 'skills')
      );
  }
  for (const name of ['module.yaml', 'module-help.csv'])
    matchSource(path.join(sourceRoot, name), targetPath('_bmad', name));
  const renderOptions = {
    packs: manifest.packs,
    userName: typeof manifest.user === 'string' ? manifest.user : 'Developer',
    language: typeof manifest.language === 'string' ? manifest.language : 'English',
  };
  const expectedFiles = new Map(
    generateUserFiles(DERIVED, renderOptions).map((entry) => [entry.file, entry.content])
  );
  const hashes =
    manifest.adapterHashes &&
    typeof manifest.adapterHashes === 'object' &&
    !Array.isArray(manifest.adapterHashes)
      ? manifest.adapterHashes
      : {};
  // Only registry-declared paths can become deletion candidates, even when the
  // manifest contains arbitrary hash keys. Keep previously owned tool targets.
  const claimed = new Set(Object.keys(hashes).filter((file) => expectedFiles.has(file)));
  if (Array.isArray(manifest.ides)) {
    const tools = manifest.ides.filter((id) =>
      DERIVED.targets.adapters.some((adapter) => adapter.tool === id)
    );
    if (tools.length) {
      for (const entry of generateUserFiles(DERIVED, { ...renderOptions, tools })) {
        claimed.add(entry.file);
        expectedFiles.set(entry.file, entry.content);
      }
    }
  }
  const legacyFallback = !Array.isArray(manifest.ides) && Object.keys(hashes).length === 0;
  for (const [file, rendered] of expectedFiles) {
    if (!legacyFallback && !claimed.has(file)) continue;
    const target = targetPath(file);
    let stat;
    try {
      stat = safeStat(projectDir, target);
    } catch (error) {
      // A link with no ownership evidence is user content, not an uninstall target.
      if (legacyFallback && error.code === 'BMAD_UNSAFE_LINK') continue;
      throw error;
    }
    if (stat?.isFile()) {
      const content = fs.readFileSync(target);
      const text = content.toString('utf8');
      const expectedHash = hashes[file];
      const matches = expectedHash ? contentHash(text) === expectedHash : text === rendered;
      if (text.includes(USER_CONFIG_MARKER) && matches) {
        files.set(target, content);
        let parent = path.dirname(target);
        while (parent !== projectDir) {
          directories.add(parent);
          parent = path.dirname(parent);
        }
      }
    }
  }
  // Keep config.yaml: it contains the user's settings and has no ownership hash.
  files.set(manifestPath, fs.readFileSync(manifestPath));
  return { files, directories };
}

module.exports = {
  command: 'uninstall',
  description: 'Remove BMAD+ from your project',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['-y, --yes', 'Confirm removal without prompting'],
    ['-l, --lang <code>', 'Language code: en, fr, es, de, pt-br, ru, zh, he, ja, it'],
  ],
  action: async (options) => {
    let i = t(options.lang || 'en');
    clack.intro(pc.bgRed(pc.white(' BMAD+ Uninstaller ')));
    let projectDir;
    try {
      projectDir = fs.realpathSync(path.resolve(options.directory || process.cwd()));
    } catch (err) {
      clack.log.error(
        'Project directory not found: ' +
          (options.directory || process.cwd()) +
          ' (' +
          err.code +
          ')'
      );
      process.exitCode = 1;
      return;
    }

    const manifestPath = path.join(projectDir, '_bmad', '.bmad-plus-install.json');
    let manifest;
    try {
      if (!safeStat(projectDir, manifestPath)) {
        clack.log.warn(i.uninstall_not_installed);
        return;
      }
      manifest = readInstallManifest(manifestPath);
    } catch (err) {
      clack.log.error(i.manifest_invalid(err.message));
      clack.outro(pc.red(i.manifest_repair));
      process.exitCode = 1;
      return;
    }
    i = t(options.lang || manifest.uiLanguage || 'en');
    if (!options.yes && !process.stdin.isTTY) {
      clack.log.error(i.noninteractive_requires_yes('uninstall'));
      process.exitCode = 1;
      return;
    }

    let plan;
    try {
      plan = removalPlan(projectDir, manifest, manifestPath);
    } catch (err) {
      clack.log.error(i.uninstall_aborted(err.message));
      process.exitCode = 1;
      return;
    }
    clack.log.info(
      'BMAD+ v' +
        manifest.version +
        ' (' +
        i.installed_on +
        ' ' +
        manifest.installed.split('T')[0] +
        ')'
    );
    clack.log.info(i.selected_packs + ': ' + manifest.packs.join(', '));
    if (!options.yes) {
      const confirm = await clack.confirm({ message: i.uninstall_confirm });
      if (!confirm || clack.isCancel(confirm)) {
        clack.cancel(i.cancelled);
        return;
      }
    }

    const spinner = clack.spinner();
    spinner.start(i.uninstall_removing);
    let removed = 0;
    try {
      // Revalidate after the prompt, before deleting any file.
      for (const target of [...plan.files.keys(), ...plan.directories])
        safeStat(projectDir, target);
      for (const [target, expected] of plan.files) {
        if (safeStat(projectDir, target)?.isFile() && fs.readFileSync(target).equals(expected)) {
          fs.unlinkSync(target);
          removed++;
        }
      }
      // No recursive deletion: hidden files, nested user content, and memory stay.
      for (const target of [...plan.directories].sort((a, b) => b.length - a.length)) {
        if (safeStat(projectDir, target)?.isDirectory() && fs.readdirSync(target).length === 0) {
          fs.rmdirSync(target);
          removed++;
        }
      }
    } catch (err) {
      spinner.stop(i.uninstall_aborted(err.message));
      process.exitCode = 1;
      return;
    }
    spinner.stop(i.uninstall_done(removed));
    clack.outro(i.uninstall_preserved);
  },
};
