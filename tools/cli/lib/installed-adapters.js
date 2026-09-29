/** Installed adapter ownership shared by install, update, and uninstall. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const clack = require('@clack/prompts');
const { GENERATED_MARKER, USER_CONFIG_MARKER } = require('../../build/generate-adapters');

const INSTALLER_MARKER = 'BMAD+ \u2014 AI Agent Configuration';
const contentHash = (content) =>
  crypto.createHash('sha256').update(String(content).replace(/\r\n/g, '\n')).digest('hex');

function classifyAdapter({ existing, content, previousHash, update = false, yes = false }) {
  if (existing === undefined) return { action: 'write', backup: false };
  const installed = existing.includes(USER_CONFIG_MARKER);
  const adopted = existing.includes(GENERATED_MARKER) && !installed;
  const legacy = existing.includes(INSTALLER_MARKER) && !existing.includes(GENERATED_MARKER);
  if (installed && existing === content) return { action: 'same', backup: false };
  const unchanged = installed && previousHash === contentHash(existing);
  if (adopted || (installed && !unchanged) || (!installed && !legacy && (update || !yes))) {
    return {
      action: 'preserve',
      backup: false,
      adopted,
      installed,
      reason: adopted ? 'repository-adopted' : 'local-instructions',
    };
  }
  return { action: 'write', backup: legacy || (!installed && yes), legacy };
}

// Refuse redirected parent directories as well as linked destination files.
function safeAdapterPath(projectDir, file) {
  const root = path.resolve(projectDir);
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Adapter path outside project: ' + file);
  }
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new Error('Adapter path is a symbolic link or junction: ' + current);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return target;
}

function writeIDEConfigs({ projectDir, files, yes = false, update = false, adapterHashes = {} }) {
  const outcome = { written: [], skipped: [], backedUp: [], adapterHashes: {} };
  // Preflight the complete set before writing any adapter.
  for (const { file } of files) safeAdapterPath(projectDir, file);
  for (const { file, content } of files) {
    const target = safeAdapterPath(projectDir, file);
    const previousHash = Object.hasOwn(adapterHashes, file) ? adapterHashes[file] : undefined;
    let backup = false;
    if (fs.existsSync(target)) {
      const existing = fs.readFileSync(target, 'utf8');
      const decision = classifyAdapter({ existing, content, previousHash, update, yes });
      if (decision.action === 'same') {
        outcome.adapterHashes[file] = contentHash(content);
        continue;
      }
      if (decision.action === 'preserve') {
        if (previousHash && decision.installed) outcome.adapterHashes[file] = previousHash;
        outcome.skipped.push(file);
        const compare = decision.adopted
          ? ` Compare package defaults: node "${require.resolve('../../build/generate-adapters')}" --target "${path.resolve(projectDir)}" --check`
          : '';
        clack.log.warn(`${file}: existing project instructions preserved.${compare}`);
        continue;
      }
      // Older installers did not record hashes. Keep their exact bytes before
      // migration, including any local additions that cannot be distinguished.
      backup = decision.backup;
    }
    if (backup) {
      let suffix = '.bak';
      let index = 1;
      while (fs.existsSync(safeAdapterPath(projectDir, file + suffix))) suffix = `.bak.${index++}`;
      fs.copyFileSync(
        target,
        safeAdapterPath(projectDir, file + suffix),
        fs.constants.COPYFILE_EXCL
      );
      outcome.backedUp.push(file);
      clack.log.warn(`${file}: backed up to ${file + suffix} before refreshing.`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    safeAdapterPath(projectDir, file);
    fs.writeFileSync(target, content, 'utf8');
    outcome.written.push(file);
    outcome.adapterHashes[file] = contentHash(content);
  }
  return outcome;
}

module.exports = {
  INSTALLER_MARKER,
  contentHash,
  safeAdapterPath,
  writeIDEConfigs,
  classifyAdapter,
};
