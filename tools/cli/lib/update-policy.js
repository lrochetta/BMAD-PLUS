/** Explicit project policy for release discovery and automatic application. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const semver = require('semver');
const { safeAdapterPath } = require('./installed-adapters');

const POLICY_FILE = '_bmad/update-policy.json';
const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';
const DEFAULT_POLICY = Object.freeze({
  mode: 'notify',
  channel: 'latest',
  allowedRange: null,
  allowPrerelease: false,
  registry: OFFICIAL_REGISTRY,
});

function isExactVersion(version) {
  return (
    typeof version === 'string' &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) &&
    semver.valid(version) !== null
  );
}

function validatePolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Update policy must be an object.');
  }
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) {
    throw new Error('Unsupported update policy schemaVersion.');
  }
  const policy = { ...DEFAULT_POLICY, ...value };
  delete policy.schemaVersion;
  if (
    Object.keys(policy).some((key) => !Object.hasOwn(DEFAULT_POLICY, key)) ||
    !['off', 'notify', 'auto'].includes(policy.mode) ||
    typeof policy.channel !== 'string' ||
    !/^[a-z][a-z0-9_-]{0,31}$/.test(policy.channel) ||
    typeof policy.allowPrerelease !== 'boolean' ||
    policy.registry !== OFFICIAL_REGISTRY ||
    (policy.allowedRange !== null &&
      (typeof policy.allowedRange !== 'string' ||
        !policy.allowedRange.trim() ||
        !semver.validRange(policy.allowedRange)))
  ) {
    throw new Error(
      'Invalid update policy: check mode, channel, range, prerelease flag and official registry.'
    );
  }
  if (policy.mode === 'auto' && policy.allowedRange === null) {
    throw new Error('Automatic updates require an explicit allowedRange.');
  }
  return policy;
}

function readUpdatePolicy(projectDir) {
  const file = safeAdapterPath(projectDir, POLICY_FILE);
  try {
    return validatePolicy(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_POLICY };
    throw new Error(`Update policy is unreadable or invalid: ${error.message}`, { cause: error });
  }
}

/** Atomic project-local JSON write; never follow linked destinations or parents. */
function writeProjectJson(projectDir, relativeFile, data) {
  const file = safeAdapterPath(projectDir, relativeFile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryName = `${relativeFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const temporary = safeAdapterPath(projectDir, temporaryName);
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });
    safeAdapterPath(projectDir, relativeFile);
    fs.renameSync(temporary, file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch {
      /* Preserve the original write error if cleanup fails. */
    }
  }
}

function writeUpdatePolicy(projectDir, value) {
  const policy = validatePolicy(value);
  writeProjectJson(projectDir, POLICY_FILE, { schemaVersion: 1, ...policy });
  return policy;
}

function authorizeTarget(value, version) {
  let policy;
  try {
    policy = validatePolicy(value);
  } catch {
    return { allowed: false, reason: 'invalid-policy' };
  }
  if (!isExactVersion(version)) return { allowed: false, reason: 'invalid-target-version' };
  if (policy.mode !== 'auto')
    return {
      allowed: false,
      reason: policy.mode === 'off' ? 'updates-disabled' : 'approval-required',
    };
  if (!policy.allowPrerelease && semver.prerelease(version))
    return { allowed: false, reason: 'prerelease-not-allowed' };
  if (
    !semver.satisfies(version, policy.allowedRange, { includePrerelease: policy.allowPrerelease })
  ) {
    return { allowed: false, reason: 'outside-allowed-range' };
  }
  return { allowed: true, reason: 'authorized-policy' };
}

module.exports = {
  DEFAULT_POLICY,
  POLICY_FILE,
  OFFICIAL_REGISTRY,
  isExactVersion,
  validatePolicy,
  readUpdatePolicy,
  writeUpdatePolicy,
  authorizeTarget,
  writeProjectJson,
};
