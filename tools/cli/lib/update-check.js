/** Bounded release discovery. This module never downloads or applies a package. */
const fs = require('node:fs');
const semver = require('semver');
const { safeAdapterPath } = require('./installed-adapters');
const { readInstallManifest } = require('./install-manifest');
const {
  readUpdatePolicy,
  validatePolicy,
  authorizeTarget,
  isExactVersion,
  writeProjectJson,
} = require('./update-policy');

const CACHE_FILE = '.bmad/update-check.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 60 * 1000;

function validateRelease(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !isExactVersion(value.version)
  ) {
    throw new Error('Registry returned an invalid exact version.');
  }
  const engines = value.engines === undefined ? {} : value.engines;
  if (
    !engines ||
    typeof engines !== 'object' ||
    Array.isArray(engines) ||
    (engines.node !== undefined &&
      (typeof engines.node !== 'string' ||
        !engines.node.trim() ||
        !semver.validRange(engines.node)))
  ) {
    throw new Error('Registry returned an invalid Node engine requirement.');
  }
  return { version: value.version, engines: engines.node ? { node: engines.node } : {} };
}

async function queryNpmRelease({ projectDir, channel, registry }) {
  validatePolicy({ channel, registry });
  const { runNpm } = require('./npm-runner');
  const stdout = await runNpm(
    [
      'view',
      `bmad-plus@${channel}`,
      'version',
      'engines',
      '--json',
      `--registry=${registry}`,
      '--prefer-online',
      '--fetch-timeout=4000',
      '--fetch-retries=0',
    ],
    { cwd: projectDir, timeout: 6000, maxBuffer: 64 * 1024 }
  );
  return validateRelease(JSON.parse(stdout));
}

function timestamp(value, now) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= now ? time : null;
}

function readCache(projectDir, policy, now) {
  try {
    const cache = JSON.parse(fs.readFileSync(safeAdapterPath(projectDir, CACHE_FILE), 'utf8'));
    if (
      !cache ||
      cache.schemaVersion !== 1 ||
      cache.package !== 'bmad-plus' ||
      cache.registry !== policy.registry ||
      cache.channel !== policy.channel
    )
      return null;
    if (cache.release) {
      cache.release = validateRelease(cache.release);
      if (timestamp(cache.checkedAt, now) === null) return null;
    }
    if (cache.failedAt !== undefined && timestamp(cache.failedAt, now) === null) return null;
    return cache;
  } catch {
    return null;
  }
}

function saveCache(projectDir, cache) {
  try {
    writeProjectJson(projectDir, CACHE_FILE, cache);
  } catch {
    /* A read-only cache is nonfatal. */
  }
}

async function checkForUpdate({
  projectDir,
  runningVersion = require('../../../package.json').version,
  refresh = false,
  offline = false,
  now = Date.now,
  queryRelease = queryNpmRelease,
  checkReadiness,
  nodeVersion = process.version,
}) {
  const time = typeof now === 'function' ? now() : now;
  const result = {
    schemaVersion: 1,
    installedVersion: null,
    runningVersion,
    latestVersion: null,
    targetVersion: null,
    channel: null,
    status: 'unknown',
    checkedAt: null,
    source: 'none',
    stale: false,
    updateAvailable: null,
    releaseEligible: false,
    versionEligible: false,
    canAutoApply: false,
    engineCompatible: null,
    engines: {},
    reason: null,
  };
  if (
    !isExactVersion(runningVersion) ||
    !Number.isFinite(time) ||
    !Number.isFinite(new Date(time).getTime()) ||
    !semver.valid(nodeVersion)
  ) {
    return { ...result, status: 'invalid-runtime', reason: 'invalid-running-version-or-clock' };
  }
  try {
    const manifest = readInstallManifest(
      safeAdapterPath(projectDir, '_bmad/.bmad-plus-install.json')
    );
    if (!isExactVersion(manifest.version)) throw new Error('Invalid installed version');
    result.installedVersion = manifest.version;
  } catch {
    return {
      ...result,
      status: 'invalid-installation',
      reason: 'missing-or-invalid-installation-manifest',
    };
  }
  let policy;
  try {
    policy = readUpdatePolicy(projectDir);
  } catch {
    return { ...result, status: 'invalid-policy', reason: 'unreadable-or-invalid-update-policy' };
  }
  result.channel = policy.channel;
  if (policy.mode === 'off') return { ...result, status: 'off', reason: 'updates-disabled' };

  let cache = readCache(projectDir, policy, time);
  const cachedAt = cache?.release ? timestamp(cache.checkedAt, time) : null;
  const failedAt = cache?.failedAt === undefined ? null : timestamp(cache.failedAt, time);
  let release;
  if (offline) {
    result.reason = 'offline';
  } else if (!refresh && failedAt !== null && time - failedAt < FAILURE_BACKOFF_MS) {
    result.reason = 'registry-retry-backoff';
  } else if (!refresh && cachedAt !== null && failedAt === null && time - cachedAt < CACHE_TTL_MS) {
    release = cache.release;
    result.source = 'cache';
    result.checkedAt = cache.checkedAt;
  } else {
    try {
      release = validateRelease(
        await queryRelease({ projectDir, channel: policy.channel, registry: policy.registry })
      );
      cache = {
        schemaVersion: 1,
        package: 'bmad-plus',
        registry: policy.registry,
        channel: policy.channel,
        release,
        checkedAt: new Date(time).toISOString(),
      };
      saveCache(projectDir, cache);
      result.source = 'registry';
      result.checkedAt = cache.checkedAt;
    } catch {
      result.reason = 'registry-unavailable';
      saveCache(projectDir, {
        ...cache,
        schemaVersion: 1,
        package: 'bmad-plus',
        registry: policy.registry,
        channel: policy.channel,
        failedAt: new Date(time).toISOString(),
      });
    }
  }
  if (!release) {
    if (cache?.release) {
      result.targetVersion = cache.release.version;
      result.latestVersion = policy.channel === 'latest' ? cache.release.version : null;
      result.engines = cache.release.engines;
      result.checkedAt = cache.checkedAt;
      result.source = 'stale-cache';
      result.stale = true;
    }
    return result;
  }

  result.targetVersion = release.version;
  result.latestVersion = policy.channel === 'latest' ? release.version : null;
  result.engines = release.engines;
  result.engineCompatible =
    !release.engines.node || semver.satisfies(nodeVersion, release.engines.node);
  const comparison = semver.compare(release.version, result.installedVersion);
  result.updateAvailable = comparison > 0;
  result.status = comparison > 0 ? 'update-available' : comparison === 0 ? 'current' : 'ahead';
  result.reason =
    comparison > 0
      ? null
      : comparison === 0
        ? 'installed-matches-channel'
        : 'installed-ahead-of-channel';
  if (comparison <= 0) return result;
  if (!result.engineCompatible) return { ...result, reason: 'incompatible-node-version' };
  if (!policy.allowPrerelease && semver.prerelease(release.version)) {
    return { ...result, reason: 'prerelease-not-allowed' };
  }
  result.releaseEligible = true;
  const authorization = authorizeTarget(policy, release.version);
  result.versionEligible = authorization.allowed;
  result.reason = authorization.reason;
  if (authorization.allowed) {
    if (!checkReadiness) return { ...result, reason: 'ownership-readiness-not-checked' };
    try {
      const readiness = await checkReadiness({
        projectDir,
        targetVersion: release.version,
        policy,
      });
      result.canAutoApply = readiness?.ready === true;
      result.reason = result.canAutoApply
        ? 'ready-for-authorized-update'
        : readiness?.reason || 'ownership-not-ready';
    } catch {
      result.reason = 'ownership-readiness-failed';
    }
  }
  return result;
}

module.exports = { CACHE_FILE, CACHE_TTL_MS, FAILURE_BACKOFF_MS, checkForUpdate, queryNpmRelease };
