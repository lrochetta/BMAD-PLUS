/**
 * Shared deterministic pack enumeration and conservative installation copying.
 * Author: Laurent Rochetta
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { safeTarget } = require('../../build/generate-adapters');

const fileHash = (content) => crypto.createHash('sha256').update(content).digest('hex');

function listPackFiles({ bmadSrc, targetAgentsDir, targetDataDir, projectRoot, pack }) {
  const result = { copiedAgents: 0, copiedSkills: 0, copiedFiles: 0, files: [] };
  if (!pack) return result;
  function walk(source, target) {
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
        walk(path.join(source, name), path.join(target, name));
    } else if (stat.isFile()) {
      result.files.push({ source, target });
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

module.exports = { copyPackFiles, listPackFiles, copyManagedFile, fileHash };
