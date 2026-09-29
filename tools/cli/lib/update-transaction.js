/** Planned, locked framework updates with exact ownership and recoverable backups. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const semver = require('semver');
const { PACKS, DERIVED } = require('./packs');
const { listPackFiles, fileHash } = require('./pack-copy');
const { contentHash, classifyAdapter, INSTALLER_MARKER } = require('./installed-adapters');
const {
  generateUserFiles,
  IDE_CONFIGS,
  GENERATED_MARKER,
  USER_CONFIG_MARKER,
  safeTarget,
} = require('../../build/generate-adapters');
const { readInstallManifest } = require('./install-manifest');
const { isExactVersion } = require('./update-policy');

const MANIFEST = '_bmad/.bmad-plus-install.json';
const LOCK = '.bmad/update.lock';
// No install or update holds the lock this long; older locks are reported as stale.
const STALE_LOCK_MS = 60 * 60 * 1000;
const UNREADABLE_LOCK_GRACE_MS = 60 * 1000;
const MODULE_FILES = ['_bmad/module.yaml', '_bmad/module-help.csv'];
const DEFAULT_PACKAGE_ROOT = path.resolve(__dirname, '../../..');
const relativeFile = (root, target) => path.relative(root, target).split(path.sep).join('/');
const currentBytes = (root, file) => {
  const target = safeTarget(root, file);
  return fs.existsSync(target) ? fs.readFileSync(target) : null;
};
const currentHash = (root, file) => {
  const content = currentBytes(root, file);
  return content === null ? null : fileHash(content);
};
const isManagedFile = (file) =>
  typeof file === 'string' &&
  !file.includes('\\') &&
  path.posix.normalize(file) === file &&
  (MODULE_FILES.includes(file) ||
    file.startsWith('.agents/skills/') ||
    file.startsWith('.agents/data/'));

function inventoryOf(manifest) {
  const inventory = manifest.fileInventory;
  if (
    !inventory ||
    inventory.schemaVersion !== 1 ||
    !inventory.files ||
    typeof inventory.files !== 'object' ||
    Array.isArray(inventory.files)
  )
    return null;
  for (const [file, hash] of Object.entries(inventory.files)) {
    if (!isManagedFile(file) || !/^[a-f0-9]{64}$/.test(hash)) return null;
  }
  return inventory.files;
}

function hasCompleteInventory(manifest, inventory) {
  return Boolean(
    inventory &&
    manifest.fileInventory.complete === true &&
    MODULE_FILES.every((file) => typeof inventory[file] === 'string')
  );
}

function collectManagedFiles({ projectDir, packageRoot = DEFAULT_PACKAGE_ROOT, packs }) {
  const files = new Map();
  const bmadSrc = path.join(packageRoot, 'src', 'bmad-plus');
  for (const id of packs) {
    if (!Object.hasOwn(PACKS, id)) throw new Error('Unknown installed pack: ' + id);
    const entries = listPackFiles({
      bmadSrc,
      projectRoot: packageRoot,
      targetAgentsDir: path.join(projectDir, '.agents', 'skills'),
      targetDataDir: path.join(projectDir, '.agents', 'data'),
      pack: PACKS[id],
    });
    for (const entry of entries.files)
      files.set(relativeFile(projectDir, entry.target), entry.source);
  }
  for (const file of MODULE_FILES) files.set(file, path.join(bmadSrc, path.basename(file)));
  return [...files].map(([file, source]) => {
    safeTarget(packageRoot, relativeFile(packageRoot, source));
    return { file, content: fs.readFileSync(source), kind: 'pack' };
  });
}

function installedTools(projectDir, manifest) {
  if (Array.isArray(manifest.ides))
    return manifest.ides.filter((id) => Object.hasOwn(IDE_CONFIGS, id));
  const tools = Object.keys(IDE_CONFIGS).filter((id) =>
    fs.existsSync(safeTarget(projectDir, IDE_CONFIGS[id].configFile))
  );
  const spine = currentBytes(projectDir, DERIVED.targets.spine)?.toString('utf8');
  if (
    spine?.includes(INSTALLER_MARKER) &&
    !spine.includes(GENERATED_MARKER) &&
    !tools.includes('codex-cli')
  )
    tools.push('codex-cli');
  return tools;
}

function evaluateUpdateReadiness({ projectDir, manifest }) {
  try {
    manifest ||= readInstallManifest(safeTarget(projectDir, MANIFEST));
    const inventory = inventoryOf(manifest);
    if (!hasCompleteInventory(manifest, inventory))
      return {
        ready: false,
        legacy: true,
        conflicts: [],
        reason: 'Complete file ownership inventory is required.',
      };
    const conflicts = [];
    if (fs.existsSync(safeTarget(projectDir, LOCK)))
      conflicts.push({ file: LOCK, reason: 'update-in-progress' });
    for (const [file, hash] of Object.entries(inventory)) {
      const current = currentHash(projectDir, file);
      if (current !== null && current !== hash)
        conflicts.push({ file, reason: 'modified-managed-file' });
    }
    const tools = installedTools(projectDir, manifest);
    const expected = tools.length
      ? generateUserFiles(DERIVED, { packs: manifest.packs, tools })
      : [];
    for (const { file } of expected) {
      const bytes = currentBytes(projectDir, file);
      if (
        bytes !== null &&
        (!bytes.toString('utf8').includes(USER_CONFIG_MARKER) ||
          contentHash(bytes.toString('utf8')) !== manifest.adapterHashes?.[file])
      ) {
        conflicts.push({ file, reason: 'unowned-or-modified-adapter' });
      }
    }
    return {
      ready: conflicts.length === 0,
      legacy: false,
      conflicts,
      reason: conflicts.length
        ? 'Local changes or an active update require manual review.'
        : 'Managed files are unchanged.',
    };
  } catch (error) {
    return { ready: false, legacy: false, conflicts: [], reason: error.message };
  }
}

/** Read-only plan: every destination is checked before the first mutation. */
function planUpdate({
  projectDir,
  packageRoot = DEFAULT_PACKAGE_ROOT,
  manifest,
  version,
  auto = false,
}) {
  projectDir = path.resolve(projectDir);
  const snapshot = currentBytes(projectDir, MANIFEST);
  const live = readInstallManifest(safeTarget(projectDir, MANIFEST));
  if (manifest && JSON.stringify(live) !== JSON.stringify(manifest))
    throw new Error('Installation manifest changed; check again.');
  manifest = live;
  if (!isExactVersion(version) || !isExactVersion(manifest.version))
    throw new Error('Update versions must be strict semantic versions.');
  if (semver.lt(version, manifest.version))
    throw new Error('Downgrade refused: ' + manifest.version + ' -> ' + version);
  const owned = inventoryOf(manifest);
  let legacy = !hasCompleteInventory(manifest, owned);
  const nextHashes = { ...(owned || {}) };
  const nextAdapterHashes = { ...(manifest.adapterHashes || {}) };
  const tools = installedTools(projectDir, manifest);
  const expected = collectManagedFiles({ projectDir, packageRoot, packs: manifest.packs });
  if (tools.length)
    expected.push(
      ...generateUserFiles(DERIVED, {
        packs: manifest.packs,
        tools,
        userName: manifest.user || 'Developer',
        language: manifest.language || 'English',
      }).map((entry) => ({
        file: entry.file,
        content: Buffer.from(entry.content),
        kind: 'adapter',
      }))
    );
  const observed = new Map([[MANIFEST, fileHash(snapshot)]]);
  const files = [];
  const conflicts = [];
  const expectedFiles = new Set(expected.map((entry) => entry.file));
  // Owned files the new version no longer ships: remove them when unchanged
  // (backed up in the receipt); a locally edited one is kept and handed over.
  for (const [file, hash] of Object.entries(owned || {})) {
    const current = currentHash(projectDir, file);
    observed.set(file, current);
    if (expectedFiles.has(file)) continue;
    delete nextHashes[file];
    if (current === hash)
      files.push({ file, kind: 'delete', content: null, beforeHash: current, afterHash: null });
    else if (current !== null) conflicts.push({ file, reason: 'modified-orphaned-file' });
  }
  for (const entry of expected) {
    const before = currentBytes(projectDir, entry.file);
    const beforeHash = before === null ? null : fileHash(before);
    observed.set(entry.file, beforeHash);
    const afterHash = fileHash(entry.content);
    let backupLegacy = false;
    if (entry.kind === 'adapter') {
      const decision = classifyAdapter({
        existing: before?.toString('utf8'),
        content: entry.content.toString('utf8'),
        previousHash: manifest.adapterHashes?.[entry.file],
        update: true,
      });
      if (decision.action === 'preserve') {
        conflicts.push({ file: entry.file, reason: decision.reason });
        continue;
      }
      backupLegacy = decision.backup;
      if (decision.legacy) legacy = true;
      nextAdapterHashes[entry.file] = contentHash(entry.content.toString('utf8'));
    } else {
      if (before !== null && owned?.[entry.file] && beforeHash !== owned[entry.file]) {
        conflicts.push({ file: entry.file, reason: 'modified-managed-file' });
        continue;
      }
      if (before !== null && !owned?.[entry.file] && beforeHash !== afterHash) {
        if (owned) {
          conflicts.push({ file: entry.file, reason: 'unowned-file' });
          continue;
        }
        legacy = true;
      }
      nextHashes[entry.file] = afterHash;
    }
    if (beforeHash !== afterHash) files.push({ ...entry, beforeHash, afterHash, backupLegacy });
  }
  const nextManifest = {
    ...manifest,
    version,
    lastUpdated: new Date().toISOString(),
    ides: tools,
    adapterHashes: nextAdapterHashes,
    fileInventory: {
      schemaVersion: 1,
      complete: !conflicts.some((entry) => entry.reason === 'unowned-file'),
      files: nextHashes,
    },
  };
  const manifestContent = Buffer.from(JSON.stringify(nextManifest, null, 2));
  files.push({
    file: MANIFEST,
    kind: 'manifest',
    content: manifestContent,
    beforeHash: fileHash(snapshot),
    afterHash: fileHash(manifestContent),
  });
  for (const { file } of files) safeTarget(projectDir, file);
  if (auto && (legacy || conflicts.length))
    throw new Error(
      'Automatic update refused: ' +
        (legacy ? 'legacy ownership inventory' : 'local file conflicts')
    );
  return {
    projectDir,
    fromVersion: manifest.version,
    toVersion: version,
    files,
    conflicts,
    legacy,
    inventoryComplete: !legacy,
    nextManifest,
    observed: [...observed],
    auto,
  };
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** Read-only lock diagnosis: owner, age, and whether it can be proven stale. */
function inspectProjectLock(projectDir, { now = Date.now() } = {}) {
  const target = safeTarget(projectDir, LOCK);
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let lock = null;
  try {
    lock = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    /* reported as unreadable */
  }
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) lock = null;
  const createdAt = Date.parse(lock?.createdAt) || stat.mtimeMs;
  const ageMs = Math.max(0, now - createdAt);
  const pid = Number.isInteger(lock?.pid) && lock.pid > 0 ? lock.pid : null;
  const sameHost = !lock?.hostname || lock.hostname === os.hostname();
  const pidAlive = pid && sameHost ? processAlive(pid) : null;
  let stale = false;
  let reason = 'An install or update is running (pid ' + (pid ?? 'unknown') + ').';
  if (!lock) {
    stale = ageMs > UNREADABLE_LOCK_GRACE_MS;
    reason = 'The lock file is unreadable.';
  } else if (pidAlive === false) {
    stale = true;
    reason = 'The recorded process ' + pid + ' is no longer running.';
  } else if (ageMs > STALE_LOCK_MS) {
    stale = true;
    reason = 'The lock is older than ' + STALE_LOCK_MS / 60000 + ' minutes.';
  }
  return {
    path: target,
    id: lock?.id ?? null,
    pid,
    hostname: lock?.hostname || null,
    receiptId: lock?.receiptId || null,
    createdAt: new Date(createdAt).toISOString(),
    ageMs,
    pidAlive,
    stale,
    reason,
    // Only a dead process on this machine is proof enough to take the lock over.
    recoverable: pidAlive === false,
  };
}

function lockRemedy(info) {
  return info.stale
    ? ' ' +
        info.reason +
        ' If no BMAD+ install or update is running, delete ' +
        info.path +
        ' and retry.'
    : ' Wait for it to finish; if it was interrupted, `bmad-plus doctor` reports when the lock becomes stale.';
}

function acquireProjectLock(projectDir, { receiptId = null } = {}) {
  const target = safeTarget(projectDir, LOCK);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const id = crypto.randomUUID();
  let fd;
  for (let attempt = 0; fd === undefined; attempt++) {
    try {
      fd = fs.openSync(target, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const info = inspectProjectLock(projectDir);
      // Move a provably dead lock aside once (rename is atomic: one contender wins).
      if (attempt === 0 && info?.recoverable) {
        const aside = target + '.stale-' + id;
        try {
          fs.renameSync(target, aside);
        } catch (renameError) {
          if (renameError.code !== 'ENOENT') throw renameError;
          continue;
        }
        let moved = null;
        try {
          moved = JSON.parse(fs.readFileSync(aside, 'utf8'));
        } catch {
          /* unreadable: not a live lock */
        }
        if ((moved?.id ?? null) !== info.id || moved?.pid !== info.pid) {
          // Another contender took the lock between inspection and rename: give it back.
          try {
            fs.linkSync(aside, target);
            fs.unlinkSync(aside);
          } catch {
            /* keep evidence */
          }
          throw new Error('Another update is in progress: ' + target + '.', { cause: error });
        }
        continue;
      }
      throw new Error(
        'Another update is in progress: ' + target + '.' + (info ? lockRemedy(info) : ''),
        { cause: error }
      );
    }
  }
  try {
    fs.writeFileSync(
      fd,
      JSON.stringify({
        id,
        pid: process.pid,
        hostname: os.hostname(),
        createdAt: new Date().toISOString(),
        receiptId,
      })
    );
  } catch (error) {
    fs.closeSync(fd);
    fs.unlinkSync(target);
    throw error;
  }
  fs.closeSync(fd);
  return () => {
    if (
      fs.existsSync(safeTarget(projectDir, LOCK)) &&
      JSON.parse(fs.readFileSync(target, 'utf8')).id === id
    )
      fs.unlinkSync(target);
  };
}

function atomicWrite(projectDir, file, content) {
  const target = safeTarget(projectDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporaryFile = file + '.update-' + crypto.randomUUID() + '.tmp';
  const temporary = safeTarget(projectDir, temporaryFile);
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx' });
    safeTarget(projectDir, file);
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(safeTarget(projectDir, temporaryFile))) fs.unlinkSync(temporary);
  }
}

function rollback(projectDir, receipt) {
  const failures = [];
  // Restore the manifest last, after restoring the content it describes.
  const entries = [
    ...receipt.entries.filter((entry) => entry.file !== MANIFEST).reverse(),
    ...receipt.entries.filter((entry) => entry.file === MANIFEST),
  ];
  for (const entry of entries) {
    try {
      const current = currentHash(projectDir, entry.file);
      if (current === entry.beforeHash) continue;
      if (current !== entry.afterHash && current !== null)
        throw new Error('File changed since the update; retained');
      if (entry.beforeHash === null) {
        if (current !== null) fs.unlinkSync(safeTarget(projectDir, entry.file));
      } else {
        if (entry.file === MANIFEST && failures.length)
          throw new Error('Content recovery is incomplete; manifest retained');
        const backup = currentBytes(projectDir, entry.backup);
        if (!backup || fileHash(backup) !== entry.beforeHash)
          throw new Error('Backup is missing or does not match its recorded hash');
        atomicWrite(projectDir, entry.file, backup);
      }
    } catch (error) {
      failures.push({ file: entry.file, reason: error.message });
    }
  }
  return failures;
}

/** Remove directories emptied by a deletion, never above the managed roots. */
function pruneEmptyParents(projectDir, file) {
  let directory = path.posix.dirname(file);
  while (directory.startsWith('.agents/skills/') || directory.startsWith('.agents/data/')) {
    try {
      // safeTarget validates files; checking a child path rejects linked parents.
      const target = path.dirname(safeTarget(projectDir, directory + '/.bmad-preflight'));
      if (fs.readdirSync(target).length) return;
      fs.rmdirSync(target);
    } catch {
      return;
    }
    directory = path.posix.dirname(directory);
  }
}

function applyPlan(plan, { reauthorize } = {}) {
  const { projectDir } = plan;
  const id = crypto.randomUUID();
  const release = acquireProjectLock(projectDir, { receiptId: id });
  const receiptFile = '.bmad/updates/' + id + '/receipt.json';
  let receipt;
  try {
    if (plan.auto) {
      if (typeof reauthorize !== 'function')
        throw new Error('Automatic update requires policy reauthorization under the project lock.');
      reauthorize();
    }
    for (const [file, hash] of plan.observed) {
      if (currentHash(projectDir, file) !== hash)
        throw new Error('File changed after preflight: ' + file);
    }
    receipt = {
      schemaVersion: 1,
      id,
      status: 'prepared',
      fromVersion: plan.fromVersion,
      toVersion: plan.toVersion,
      createdAt: new Date().toISOString(),
      conflicts: plan.conflicts,
      entries: [],
    };
    for (const [index, entry] of plan.files.entries()) {
      let backup = null;
      if (entry.beforeHash !== null) {
        backup = '.bmad/updates/' + id + '/backups/' + index;
        const target = safeTarget(projectDir, backup);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(safeTarget(projectDir, entry.file), target, fs.constants.COPYFILE_EXCL);
        if (fileHash(fs.readFileSync(target)) !== entry.beforeHash)
          throw new Error('File changed while backing up: ' + entry.file);
      }
      if (entry.backupLegacy) {
        let legacyBackup = entry.file + '.bak';
        let index = 1;
        while (fs.existsSync(safeTarget(projectDir, legacyBackup)))
          legacyBackup = entry.file + '.bak.' + index++;
        fs.copyFileSync(
          safeTarget(projectDir, entry.file),
          safeTarget(projectDir, legacyBackup),
          fs.constants.COPYFILE_EXCL
        );
      }
      receipt.entries.push({
        file: entry.file,
        beforeHash: entry.beforeHash,
        afterHash: entry.afterHash,
        backup,
      });
    }
    atomicWrite(projectDir, receiptFile, JSON.stringify(receipt, null, 2));
    for (const entry of plan.files) {
      if (currentHash(projectDir, entry.file) !== entry.beforeHash)
        throw new Error('File changed during update: ' + entry.file);
      if (entry.afterHash === null) fs.unlinkSync(safeTarget(projectDir, entry.file));
      else atomicWrite(projectDir, entry.file, entry.content);
      if (currentHash(projectDir, entry.file) !== entry.afterHash)
        throw new Error('Written file verification failed: ' + entry.file);
    }
    receipt.status = 'committed';
    atomicWrite(projectDir, receiptFile, JSON.stringify(receipt, null, 2));
    const removedFiles = plan.files
      .filter((entry) => entry.afterHash === null)
      .map((entry) => entry.file);
    for (const file of removedFiles) pruneEmptyParents(projectDir, file);
    const manifest = readInstallManifest(safeTarget(projectDir, MANIFEST));
    return {
      manifest,
      receiptPath: path.join(projectDir, receiptFile),
      receiptId: id,
      changedFiles: plan.files
        .filter((entry) => entry.kind !== 'manifest')
        .map((entry) => entry.file),
      removedFiles,
      conflicts: plan.conflicts,
    };
  } catch (error) {
    if (receipt) {
      const failures = rollback(projectDir, receipt);
      receipt.status = failures.length ? 'recovery-required' : 'rolled-back';
      receipt.failures = failures;
      try {
        atomicWrite(projectDir, receiptFile, JSON.stringify(receipt, null, 2));
      } catch (writeError) {
        error.message += '; recovery receipt could not be saved: ' + writeError.message;
      }
      error.message +=
        '; ' +
        receipt.status +
        '. Recovery: bmad-plus update --restore ' +
        id +
        ' --directory "' +
        projectDir +
        '" --yes';
    }
    throw error;
  } finally {
    release();
  }
}

function restoreUpdate({ projectDir, receiptId }) {
  if (!/^[a-f0-9-]{36}$/.test(receiptId)) throw new Error('Invalid update receipt ID');
  const receiptFile = '.bmad/updates/' + receiptId + '/receipt.json';
  const receipt = JSON.parse(currentBytes(projectDir, receiptFile)?.toString('utf8') || 'null');
  if (
    !receipt ||
    receipt.schemaVersion !== 1 ||
    receipt.id !== receiptId ||
    !Array.isArray(receipt.entries)
  )
    throw new Error('Invalid update receipt');
  const adapterPaths = new Set([
    DERIVED.targets.spine,
    ...DERIVED.targets.adapters.map((entry) => entry.file),
  ]);
  const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  for (const entry of receipt.entries) {
    // A null afterHash records a deleted file, which always has a backup.
    if (
      typeof entry.file !== 'string' ||
      !(entry.file === MANIFEST || isManagedFile(entry.file) || adapterPaths.has(entry.file)) ||
      !(
        isHash(entry.afterHash) ||
        (entry.afterHash === null && entry.file !== MANIFEST && isHash(entry.beforeHash))
      ) ||
      (entry.beforeHash !== null && !isHash(entry.beforeHash))
    )
      throw new Error('Invalid recovery file entry');
    safeTarget(projectDir, entry.file);
    if (
      entry.beforeHash === null
        ? entry.backup !== null
        : typeof entry.backup !== 'string' ||
          !entry.backup.startsWith('.bmad/updates/' + receiptId + '/backups/') ||
          path.posix.normalize(entry.backup) !== entry.backup ||
          entry.backup.includes('\\')
    )
      throw new Error('Invalid backup entry');
    if (entry.backup) safeTarget(projectDir, entry.backup);
  }
  const manifestEntry = receipt.entries.find((entry) => entry.file === MANIFEST);
  const installedHash = currentHash(projectDir, MANIFEST);
  if (
    !manifestEntry ||
    (installedHash !== manifestEntry.beforeHash && installedHash !== manifestEntry.afterHash)
  )
    throw new Error('Installation changed since this receipt; recovery refused.');
  const lockPath = safeTarget(projectDir, LOCK);
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (lock.receiptId !== receiptId || !Number.isInteger(lock.pid) || lock.pid <= 0)
      throw new Error('Another update owns the project lock.');
    try {
      process.kill(lock.pid, 0);
      throw new Error('The recorded update process is still running.');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    fs.unlinkSync(lockPath);
  }
  const release = acquireProjectLock(projectDir);
  try {
    // Validate every required byte before starting a manual recovery.
    for (const entry of receipt.entries) {
      const current = currentHash(projectDir, entry.file);
      if (current !== entry.beforeHash && current !== entry.afterHash && current !== null)
        throw new Error('File changed since the update: ' + entry.file);
      if (entry.beforeHash !== null) {
        const backup = currentBytes(projectDir, entry.backup);
        if (backup === null || fileHash(backup) !== entry.beforeHash)
          throw new Error('Backup is missing or corrupt: ' + entry.file);
      }
    }
    const failures = rollback(projectDir, receipt);
    receipt.status = failures.length ? 'recovery-required' : 'restored';
    receipt.failures = failures;
    atomicWrite(projectDir, receiptFile, JSON.stringify(receipt, null, 2));
    if (failures.length)
      throw new Error(
        'Recovery incomplete: ' +
          failures.map((entry) => entry.file + ': ' + entry.reason).join('; ')
      );
    return {
      receiptPath: path.join(projectDir, receiptFile),
      restoredVersion: readInstallManifest(safeTarget(projectDir, MANIFEST)).version,
    };
  } finally {
    release();
  }
}

module.exports = {
  planUpdate,
  applyPlan,
  restoreUpdate,
  acquireProjectLock,
  inspectProjectLock,
  atomicWrite,
  evaluateUpdateReadiness,
  collectManagedFiles,
  inventoryOf,
  MANIFEST,
  LOCK,
  STALE_LOCK_MS,
};
