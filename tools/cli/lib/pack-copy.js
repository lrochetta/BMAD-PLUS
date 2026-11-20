/**
 * Shared deterministic pack enumeration and conservative installation copying.
 * Author: Laurent Rochetta
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { safeTarget } = require('../../build/generate-adapters');

const fileHash = (content) => crypto.createHash('sha256').update(content).digest('hex');
const MAX_MANIFEST = 1024 * 1024;

/** The package name comes from the generated registry data, never from user input. */
function resolveModule(name, projectRoot) {
  return require.resolve(name + '/package.json', { paths: [projectRoot] });
}

/** The node_modules directories Node searches from the BMAD+ package root upwards. */
function moduleChain(projectRoot) {
  const chain = [];
  let current = fs.realpathSync(projectRoot);
  for (;;) {
    if (path.basename(current) !== 'node_modules') chain.push(path.join(current, 'node_modules'));
    const parent = path.dirname(current);
    if (parent === current) return chain;
    current = parent;
  }
}

/**
 * The root of an `external_module` package installed next to BMAD+, once its
 * version is the one the registry pinned. Node resolves through symlinks, so the
 * resolved package must sit in the node_modules chain itself: a link or a global
 * module path is refused.
 */
function externalModuleRoot({ externalModule, projectRoot, resolve = resolveModule }) {
  const { package: name, version } = externalModule;
  let manifestPath;
  try {
    manifestPath = resolve(name, projectRoot);
  } catch (error) {
    throw new Error(
      'External module ' + name + ' is not installed next to BMAD+: ' + error.message,
      { cause: error }
    );
  }
  const expected = moduleChain(projectRoot).map((dir) =>
    path.join(dir, ...name.split('/'), 'package.json')
  );
  if (!expected.includes(manifestPath)) {
    throw new Error(
      'External module ' +
        name +
        ' resolved to ' +
        manifestPath +
        ', outside the node_modules chain of this BMAD+. A symlinked package, a global module path and the isolated layout of pnpm (node_modules/.pnpm) are refused: install bmad-plus with npm so its pinned dependency sits in that chain.'
    );
  }
  const root = path.dirname(manifestPath);
  safeTarget(root, 'package.json');
  const stat = fs.lstatSync(manifestPath);
  if (!stat.isFile() || stat.size > MAX_MANIFEST)
    throw new Error('External module ' + name + ' has no readable package.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error('External module ' + name + ': ' + error.message, { cause: error });
  }
  if (!manifest || manifest.name !== name || manifest.version !== version) {
    throw new Error(
      'External module ' +
        name +
        ' is ' +
        String(manifest && manifest.version) +
        ' but this BMAD+ expects exactly ' +
        version +
        '; reinstall bmad-plus so its pinned dependency matches.'
    );
  }
  return root;
}

function listPackFiles({
  bmadSrc,
  targetAgentsDir,
  targetDataDir,
  projectRoot,
  pack,
  resolveModule: resolve,
}) {
  const result = { copiedAgents: 0, copiedSkills: 0, copiedFiles: 0, files: [] };
  if (!pack) return result;
  function walk(source, target, root) {
    // Local Python execution must not turn interpreter caches into owned/shipped
    // framework files. Keep this aligned with the explicit npm files exclusions.
    if (path.basename(source) === '__pycache__' || /\.py[co]$/i.test(source)) return false;
    let stat;
    try {
      stat = fs.lstatSync(source);
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('Pack source is a symbolic link: ' + source);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(source).sort())
        walk(path.join(source, name), path.join(target, name), root);
    } else if (stat.isFile()) {
      result.files.push(root ? { source, target, root } : { source, target });
    } else throw new Error('Pack source is not a regular file: ' + source);
    return true;
  }
  for (const name of pack.agents || []) {
    if (walk(path.join(bmadSrc, 'agents', name), path.join(targetAgentsDir, name)))
      result.copiedAgents++;
  }
  for (const name of pack.skills || []) {
    if (walk(path.join(bmadSrc, 'skills', name), path.join(targetAgentsDir, name)))
      result.copiedSkills++;
  }
  for (const name of pack.data || []) {
    if (walk(path.join(bmadSrc, 'data', name), path.join(targetDataDir, name)))
      result.copiedFiles++;
  }
  if (
    pack.externalPackage &&
    walk(path.join(projectRoot, pack.externalPackage, 'skills'), targetAgentsDir)
  )
    result.copiedSkills++;
  if (pack.externalModule) {
    const root = externalModuleRoot({ externalModule: pack.externalModule, projectRoot, resolve });
    for (const name of pack.externalModule.skills) {
      if (!walk(path.join(root, 'skills', name), path.join(targetAgentsDir, name), root)) {
        throw new Error(
          'External module ' + pack.externalModule.package + ' does not ship skill ' + name
        );
      }
      result.copiedSkills++;
    }
  }
  if (
    pack.packDir &&
    walk(
      path.join(bmadSrc, pack.packSrcDir || 'agents', pack.packDir),
      path.join(targetAgentsDir, pack.packDir)
    )
  ) {
    result.copiedAgents++;
    result.copiedFiles++;
  }
  return result;
}

function copyManagedFile({
  source,
  target,
  projectDir,
  inventory,
  previousInventory = {},
  onConflict = () => {},
}) {
  const file = path.relative(projectDir, target).split(path.sep).join('/');
  safeTarget(projectDir, file);
  const sourceStat = fs.lstatSync(source);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink())
    throw new Error('Pack source is not a regular file: ' + source);
  const content = fs.readFileSync(source);
  const hash = fileHash(content);
  if (fs.existsSync(target)) {
    const existingHash = fileHash(fs.readFileSync(target));
    if (existingHash === hash) {
      if (inventory) inventory[file] = hash;
      return false;
    }
    if (previousInventory[file] !== existingHash) {
      if (inventory && previousInventory[file]) inventory[file] = previousInventory[file];
      onConflict(file);
      return false;
    }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  safeTarget(projectDir, file);
  fs.writeFileSync(target, content, { mode: sourceStat.mode });
  if (inventory) inventory[file] = hash;
  return true;
}

function copyPackFiles(options) {
  const { files, ...counts } = listPackFiles(options);
  const projectDir = options.projectDir || path.dirname(options.targetAgentsDir);
  for (const { target } of files)
    safeTarget(projectDir, path.relative(projectDir, target).split(path.sep).join('/'));
  for (const entry of files) copyManagedFile({ ...options, ...entry, projectDir });
  return counts;
}

module.exports = { copyPackFiles, listPackFiles, copyManagedFile, externalModuleRoot, fileHash };
