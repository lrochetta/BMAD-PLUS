const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  checkForUpdate,
  CACHE_FILE,
  CACHE_TTL_MS,
  FAILURE_BACKOFF_MS,
  queryNpmRelease,
} = require('../../tools/cli/lib/update-check');
const { writeUpdatePolicy, OFFICIAL_REGISTRY } = require('../../tools/cli/lib/update-policy');
const command = require('../../tools/cli/commands/update-check');

jest.mock('../../tools/cli/lib/npm-runner', () => ({ runNpm: jest.fn() }), { virtual: true });
jest.mock(
  '../../tools/cli/lib/update-transaction',
  () => ({ evaluateUpdateReadiness: jest.fn() }),
  { virtual: true }
);

describe('bounded update discovery', () => {
  let project;
  let clock;
  let query;
  let savedExit;
  const initialTime = Date.parse('2026-09-08T12:00:00Z');
  const manifest = (version) => ({ version, installed: '2026-09-01T00:00:00Z', packs: ['core'] });
  const setInstalled = (version) =>
    fs.writeFileSync(
      path.join(project, '_bmad/.bmad-plus-install.json'),
      JSON.stringify(manifest(version))
    );
  const check = (overrides) =>
    checkForUpdate({
      projectDir: project,
      runningVersion: '0.12.2',
      now: () => clock,
      queryRelease: query,
      nodeVersion: 'v20.20.0',
      ...overrides,
    });

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-update-check-'));
    fs.mkdirSync(path.join(project, '_bmad'));
    setInstalled('0.12.2');
    clock = initialTime;
    query = jest.fn().mockResolvedValue({ version: '0.12.3', engines: { node: '>=20' } });
    savedExit = process.exitCode;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    process.exitCode = savedExit;
    fs.rmSync(project, { recursive: true, force: true });
  });

  test('equal installed/running versions do not hide a published update', async () => {
    const before = fs.readFileSync(path.join(project, '_bmad/.bmad-plus-install.json'), 'utf8');
    expect(await check()).toMatchObject({
      installedVersion: '0.12.2',
      runningVersion: '0.12.2',
      latestVersion: '0.12.3',
      targetVersion: '0.12.3',
      status: 'update-available',
      source: 'registry',
      stale: false,
      updateAvailable: true,
      releaseEligible: true,
      versionEligible: false,
      canAutoApply: false,
      reason: 'approval-required',
    });
    expect(fs.readFileSync(path.join(project, '_bmad/.bmad-plus-install.json'), 'utf8')).toBe(
      before
    );
  });

  test('newer installed release is never downgraded by the old running CLI', async () => {
    setInstalled('0.13.0');
    expect(await check()).toMatchObject({
      status: 'ahead',
      updateAvailable: false,
      versionEligible: false,
      installedVersion: '0.13.0',
    });
  });

  test('matching the selected release is current while running version stays distinct', async () => {
    setInstalled('0.12.3');
    expect(await check()).toMatchObject({
      status: 'current',
      installedVersion: '0.12.3',
      runningVersion: '0.12.2',
      updateAvailable: false,
    });
  });

  test('comparison uses semantic ordering instead of lexical ordering', async () => {
    setInstalled('0.9.0');
    query.mockResolvedValue({ version: '0.10.0' });
    expect(await check()).toMatchObject({ status: 'update-available', engineCompatible: true });
  });

  test('auto eligibility requires explicit range and a separate ownership readiness result', async () => {
    writeUpdatePolicy(project, { mode: 'auto', allowedRange: '~0.12.2' });
    expect(await check()).toMatchObject({
      versionEligible: true,
      canAutoApply: false,
      reason: 'ownership-readiness-not-checked',
    });
    const readiness = jest.fn().mockResolvedValue({ ready: true });
    expect(await check({ checkReadiness: readiness })).toMatchObject({
      canAutoApply: true,
      source: 'cache',
    });
    expect(readiness).toHaveBeenCalledWith(
      expect.objectContaining({ projectDir: project, targetVersion: '0.12.3' })
    );
    readiness.mockResolvedValue({ ready: false, reason: 'modified-files' });
    expect(await check({ checkReadiness: readiness })).toMatchObject({
      canAutoApply: false,
      reason: 'modified-files',
    });
    readiness.mockRejectedValue(new Error('failure'));
    expect(await check({ checkReadiness: readiness })).toMatchObject({
      canAutoApply: false,
      reason: 'ownership-readiness-failed',
    });
  });

  test('a revoked or out-of-range policy immediately stops auto eligibility even with a cached release', async () => {
    writeUpdatePolicy(project, { mode: 'auto', allowedRange: '0.12.2' });
    expect(await check()).toMatchObject({
      versionEligible: false,
      releaseEligible: true,
      reason: 'outside-allowed-range',
    });
    writeUpdatePolicy(project, { mode: 'notify' });
    expect(await check()).toMatchObject({ versionEligible: false, reason: 'approval-required' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('off does not read the registry', async () => {
    writeUpdatePolicy(project, { mode: 'off' });
    expect(await check()).toMatchObject({ status: 'off', source: 'none', updateAvailable: null });
    expect(query).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(project, CACHE_FILE))).toBe(false);
  });

  test('fresh cache avoids the registry, expiry and explicit refresh each query again', async () => {
    await check();
    clock += CACHE_TTL_MS - 1;
    expect((await check()).source).toBe('cache');
    expect(query).toHaveBeenCalledTimes(1);
    clock += 1;
    expect((await check()).source).toBe('registry');
    expect(query).toHaveBeenCalledTimes(2);
    expect((await check({ refresh: true })).source).toBe('registry');
    expect(query).toHaveBeenCalledTimes(3);
  });

  test('offline returns explicit unknown, even when the cached record was recently fresh', async () => {
    expect(await check({ offline: true })).toMatchObject({
      status: 'unknown',
      updateAvailable: null,
      source: 'none',
      reason: 'offline',
    });
    expect(query).not.toHaveBeenCalled();
    await check();
    expect(await check({ offline: true })).toMatchObject({
      status: 'unknown',
      updateAvailable: null,
      targetVersion: '0.12.3',
      stale: true,
      source: 'stale-cache',
      canAutoApply: false,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('registry failures back off for an hour and refresh bypasses the backoff', async () => {
    query.mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await check()).toMatchObject({ status: 'unknown', reason: 'registry-unavailable' });
    expect(await check()).toMatchObject({ reason: 'registry-retry-backoff' });
    expect(query).toHaveBeenCalledTimes(1);
    clock += FAILURE_BACKOFF_MS;
    await check();
    expect(query).toHaveBeenCalledTimes(2);
    await check({ refresh: true });
    expect(query).toHaveBeenCalledTimes(3);
  });

  test('failed fresh recheck retains historical data without authorizing an update', async () => {
    writeUpdatePolicy(project, { mode: 'auto', allowedRange: '~0.12.2' });
    await check();
    query.mockRejectedValue(new Error('offline'));
    expect(await check({ refresh: true })).toMatchObject({
      status: 'unknown',
      source: 'stale-cache',
      latestVersion: '0.12.3',
      checkedAt: new Date(initialTime).toISOString(),
      stale: true,
      versionEligible: false,
    });
    expect((await check()).reason).toBe('registry-retry-backoff');
  });

  test.each([
    '{bad',
    JSON.stringify({ schemaVersion: 99 }),
    JSON.stringify({
      schemaVersion: 1,
      package: 'bmad-plus',
      registry: OFFICIAL_REGISTRY,
      channel: 'latest',
      release: { version: '0.12.3' },
      checkedAt: '2999-01-01T00:00:00Z',
    }),
  ])('corrupt or mismatched cache is ignored: %s', async (data) => {
    fs.mkdirSync(path.join(project, '.bmad'));
    fs.writeFileSync(path.join(project, CACHE_FILE), data);
    expect((await check()).source).toBe('registry');
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('read-only cache cannot turn successful discovery into an error', async () => {
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('read-only filesystem');
    });
    expect(await check()).toMatchObject({ status: 'update-available', source: 'registry' });
    expect(fs.readdirSync(path.join(project, '.bmad'))).toEqual([]);
  });

  test('a linked cache directory is neither read nor written', async () => {
    const victim = path.join(project, 'victim');
    fs.mkdirSync(victim);
    fs.writeFileSync(path.join(victim, 'keep.txt'), 'preserved');
    fs.symlinkSync(
      victim,
      path.join(project, '.bmad'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect((await check()).source).toBe('registry');
    expect(fs.readdirSync(victim)).toEqual(['keep.txt']);
  });

  test('channel changes invalidate the cache and do not mislabel next as latest', async () => {
    await check();
    writeUpdatePolicy(project, { mode: 'auto', allowedRange: '>=0.12.2 <0.14.0', channel: 'next' });
    query.mockResolvedValue({ version: '0.13.0-beta.1' });
    expect(await check()).toMatchObject({
      channel: 'next',
      latestVersion: null,
      targetVersion: '0.13.0-beta.1',
      releaseEligible: false,
      reason: 'prerelease-not-allowed',
    });
    writeUpdatePolicy(project, {
      mode: 'auto',
      allowedRange: '>=0.12.2 <0.14.0',
      channel: 'next',
      allowPrerelease: true,
    });
    expect(await check()).toMatchObject({
      source: 'cache',
      releaseEligible: true,
      versionEligible: true,
    });
  });

  test('incompatible Node blocks application without hiding an available release', async () => {
    query.mockResolvedValue({ version: '0.12.3', engines: { node: '>=30' } });
    expect(await check()).toMatchObject({
      updateAvailable: true,
      engineCompatible: false,
      releaseEligible: false,
      reason: 'incompatible-node-version',
    });
  });

  test.each([
    { version: '0.12.3;echo' },
    { version: 'latest' },
    null,
    { version: '0.12.3', engines: { node: 'nonsense' } },
  ])('untrusted registry metadata fails closed: %j', async (release) => {
    query.mockResolvedValue(release);
    expect(await check()).toMatchObject({
      status: 'unknown',
      updateAvailable: null,
      source: 'none',
      versionEligible: false,
    });
  });

  test('missing and malformed installation manifests never become version zero', async () => {
    setInstalled('not-a-version');
    expect(await check()).toMatchObject({ status: 'invalid-installation', installedVersion: null });
    fs.unlinkSync(path.join(project, '_bmad/.bmad-plus-install.json'));
    expect((await check()).status).toBe('invalid-installation');
    expect(query).not.toHaveBeenCalled();
  });

  test('a linked installation directory cannot supply trusted version metadata', async () => {
    const victim = path.join(project, 'victim');
    fs.renameSync(path.join(project, '_bmad'), victim);
    fs.symlinkSync(
      victim,
      path.join(project, '_bmad'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect(await check()).toMatchObject({ status: 'invalid-installation', installedVersion: null });
    expect(query).not.toHaveBeenCalled();
    expect(fs.readdirSync(victim)).toEqual(['.bmad-plus-install.json']);
  });

  test('corrupt policy and runtime inputs are errors without a network query', async () => {
    fs.writeFileSync(path.join(project, '_bmad/update-policy.json'), '{}broken');
    expect((await check()).status).toBe('invalid-policy');
    expect((await check({ runningVersion: 'bad' })).status).toBe('invalid-runtime');
    expect((await check({ now: 1e99 })).status).toBe('invalid-runtime');
    expect(query).not.toHaveBeenCalled();
  });

  test('npm query uses bounded registry reads and parses the two requested fields', async () => {
    const { runNpm } = require('../../tools/cli/lib/npm-runner');
    runNpm.mockResolvedValue(JSON.stringify({ version: '0.12.3', engines: { node: '>=20' } }));
    expect(
      await queryNpmRelease({ projectDir: project, channel: 'latest', registry: OFFICIAL_REGISTRY })
    ).toEqual({ version: '0.12.3', engines: { node: '>=20' } });
    expect(runNpm).toHaveBeenCalledWith(
      [
        'view',
        'bmad-plus@latest',
        'version',
        'engines',
        '--json',
        `--registry=${OFFICIAL_REGISTRY}`,
        '--prefer-online',
        '--fetch-timeout=4000',
        '--fetch-retries=0',
      ],
      { cwd: project, timeout: 6000, maxBuffer: 65536 }
    );
  });

  test('npm query rejects a custom registry or malformed channel before invoking npm', async () => {
    await expect(
      queryNpmRelease({ projectDir: project, channel: 'latest', registry: 'https://example.com/' })
    ).rejects.toThrow('Invalid update policy');
    await expect(
      queryNpmRelease({ projectDir: project, channel: '--offline', registry: OFFICIAL_REGISTRY })
    ).rejects.toThrow('Invalid update policy');
    expect(require('../../tools/cli/lib/npm-runner').runNpm).not.toHaveBeenCalled();
  });

  test('CLI JSON emits a single envelope and never downloads a package to check', async () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.action({ directory: project, json: true, offline: true });
    expect(output).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({
      status: 'unknown',
      reason: 'offline',
      canAutoApply: false,
    });
    expect(require('../../tools/cli/lib/npm-runner').runNpm).not.toHaveBeenCalled();
  });

  test('CLI includes local ownership readiness for a previously authorized auto policy', async () => {
    writeUpdatePolicy(project, { mode: 'auto', allowedRange: '~0.12.2' });
    require('../../tools/cli/lib/npm-runner').runNpm.mockResolvedValue(
      JSON.stringify({ version: '0.12.3' })
    );
    require('../../tools/cli/lib/update-transaction').evaluateUpdateReadiness.mockReturnValue({
      ready: true,
    });
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.action({ directory: project, json: true, refresh: true });
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({
      canAutoApply: true,
      versionEligible: true,
    });
  });

  test('CLI marks invalid installation as failure and emits human output when JSON is omitted', async () => {
    setInstalled('bad');
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.action({ directory: project });
    expect(process.exitCode).toBe(1);
    expect(output.mock.calls.flat().join('\n')).toContain('invalid-installation');
  });
});
