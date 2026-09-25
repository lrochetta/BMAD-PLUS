/** Discover and execute one exact, approved BMAD+ release. */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const semver = require('semver');
const {
  OFFICIAL_REGISTRY,
  isExactVersion,
  readUpdatePolicy,
  authorizeTarget,
} = require('./update-policy');

function readProjectManifest(projectDir) {
  const { safeAdapterPath } = require('./installed-adapters');
  const { readInstallManifest } = require('./install-manifest');
  return readInstallManifest(safeAdapterPath(projectDir, '_bmad/.bmad-plus-install.json'));
}

function refusal(reason, detail) {
  return Object.assign(new Error(`Update refused: ${detail || reason}.`), {
    code: 'UPDATE_REFUSED',
    reason,
  });
}

function requirePolicy(policy, targetVersion, auto) {
  if (policy.registry !== OFFICIAL_REGISTRY) throw refusal('unsupported-registry');
  if (policy.mode === 'off') throw refusal('updates-disabled');
  if (semver.prerelease(targetVersion) && !policy.allowPrerelease)
    throw refusal('prerelease-not-allowed');
  if (auto) {
    const authorization = authorizeTarget(policy, targetVersion);
    if (!authorization.allowed) throw refusal(authorization.reason);
  }
}

async function withExecutionDirectory(action) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'bmad-update-exec-'));
  try {
    // npm exec may otherwise select a project-local .cmd shim. npm's Windows
    // shim fails on metacharacters in its own path; target argv is escaped by npm.
    return await action(directory);
  } finally {
    const actual = fs.realpathSync(directory);
    assert(
      path.dirname(actual) === parent &&
        path.basename(actual).startsWith('bmad-update-exec-') &&
        !fs.lstatSync(directory).isSymbolicLink(),
      'Refusing to remove an unexpected updater temporary directory.'
    );
    fs.rmSync(actual, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function runLatestUpdate({ projectDir, auto = false, yes = false }, injectedDeps = {}) {
  if (typeof auto !== 'boolean' || typeof yes !== 'boolean')
    throw refusal('invalid-confirmation-options');
  const directory = path.resolve(projectDir || process.cwd());
  const checkForUpdate = injectedDeps.checkForUpdate || require('./update-check').checkForUpdate;
  const runNpm = injectedDeps.runNpm || require('./npm-runner').runNpm;
  const readManifest = injectedDeps.readManifest || readProjectManifest;
  const readPolicy = injectedDeps.readPolicy || readUpdatePolicy;
  const platform = injectedDeps.platform || process.platform;
  const nodeVersion = injectedDeps.nodeVersion || process.version;
  const executeInDirectory = injectedDeps.withExecutionDirectory || withExecutionDirectory;
  const manifest = readManifest(directory);
  if (!isExactVersion(manifest.version)) throw refusal('invalid-installation');
  const initialPolicy = readPolicy(directory);
  if (initialPolicy.mode === 'off') throw refusal('updates-disabled');
  if (auto && initialPolicy.mode !== 'auto') throw refusal('automatic-updates-not-authorized');

  const check = await checkForUpdate({ projectDir: directory, refresh: true });
  if (!check || check.source !== 'registry' || check.stale !== false)
    throw refusal('fresh-metadata-required');
  const targetVersion = check.targetVersion;
  if (!isExactVersion(targetVersion)) throw refusal('invalid-target-version');
  if (check.channel !== initialPolicy.channel) throw refusal('policy-channel-changed');
  if (check.installedVersion !== manifest.version)
    throw refusal('installation-changed-during-discovery');
  if (check.status === 'ahead' || semver.lt(targetVersion, manifest.version))
    throw refusal('downgrade-not-allowed');
  if (check.status === 'current' && semver.eq(targetVersion, manifest.version)) {
    return { status: 'current', targetVersion, installedVersion: manifest.version, updated: false };
  }
  if (
    check.status !== 'update-available' ||
    check.updateAvailable !== true ||
    check.releaseEligible !== true ||
    check.engineCompatible !== true ||
    !semver.gt(targetVersion, manifest.version)
  ) {
    throw refusal(check.reason || 'release-not-eligible');
  }
  const engine = check.engines?.node;
  if (
    !check.engines ||
    typeof check.engines !== 'object' ||
    Array.isArray(check.engines) ||
    (engine !== undefined &&
      (typeof engine !== 'string' ||
        !semver.validRange(engine) ||
        !semver.satisfies(nodeVersion, engine)))
  ) {
    throw refusal('incompatible-or-invalid-node-engine');
  }
  requirePolicy(initialPolicy, targetVersion, auto);

  const args = [
    'exec',
    '--yes',
    `--package=bmad-plus@${targetVersion}`,
    `--registry=${OFFICIAL_REGISTRY}`,
    `--script-shell=${platform === 'win32' ? 'cmd.exe' : 'sh'}`,
    '--',
    'bmad-plus',
    'update',
    '--yes',
    ...(auto ? ['--auto'] : []),
    '--directory',
    directory,
    '--expected-version',
    targetVersion,
  ];
  if (!auto && !yes) {
    return {
      status: 'approval-required',
      reason: 'Confirm this exact update with --yes.',
      installedVersion: manifest.version,
      targetVersion,
      updated: false,
      command: ['npm', ...args],
    };
  }
  if (auto) {
    const evaluateReadiness =
      injectedDeps.evaluateReadiness || require('./update-transaction').evaluateUpdateReadiness;
    const readiness = await evaluateReadiness({ projectDir: directory, manifest });
    if (readiness?.ready !== true || readiness.legacy || readiness.conflicts?.length) {
      throw refusal(
        'ownership-preflight-failed',
        readiness?.reason || 'The installation is not ready for an automatic update'
      );
    }
  }
  // Re-read authorization after asynchronous work, including potential revocation.
  const finalPolicy = readPolicy(directory);
  requirePolicy(finalPolicy, targetVersion, auto);
  if (finalPolicy.channel !== check.channel) throw refusal('policy-channel-changed');
  const beforeExec = readManifest(directory);
  if (beforeExec.version !== manifest.version)
    throw refusal('installation-changed-before-execution');
  const output = await executeInDirectory((cwd) =>
    runNpm(args, { cwd, timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
  );
  const updated = readManifest(directory);
  if (updated.version !== targetVersion) {
    throw Object.assign(
      new Error(
        `Updater finished without the expected manifest version ${targetVersion}. Inspect the project before retrying.\n${output}`
      ),
      {
        code: 'UPDATE_UNVERIFIED',
        reason: 'manifest-version-mismatch',
        targetVersion,
        stdout: output,
      }
    );
  }
  return {
    status: 'updated',
    installedVersion: updated.version,
    previousVersion: manifest.version,
    targetVersion,
    updated: true,
    reloadInstructions: true,
    output,
  };
}

module.exports = { runLatestUpdate };
