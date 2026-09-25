const path = require('node:path');
const { runLatestUpdate } = require('../../tools/cli/lib/update-dispatch');
const { DEFAULT_POLICY } = require('../../tools/cli/lib/update-policy');

describe('exact release update dispatch', () => {
  let manifest;
  let policy;
  let release;
  let deps;
  const projectDir = path.resolve('project with spaces & (literal)');

  beforeEach(() => {
    manifest = { version: '0.12.2' };
    policy = { ...DEFAULT_POLICY };
    release = {
      status: 'update-available',
      installedVersion: '0.12.2',
      targetVersion: '0.12.3',
      source: 'registry',
      channel: 'latest',
      stale: false,
      updateAvailable: true,
      releaseEligible: true,
      engineCompatible: true,
      engines: { node: '>=20' },
    };
    deps = {
      readManifest: jest.fn(() => ({ ...manifest })),
      readPolicy: jest.fn(() => ({ ...policy })),
      checkForUpdate: jest.fn(async () => ({ ...release })),
      evaluateReadiness: jest.fn(async () => ({ ready: true, legacy: false, conflicts: [] })),
      runNpm: jest.fn(async () => {
        manifest.version = release.targetVersion;
        return 'done';
      }),
      withExecutionDirectory: jest.fn((action) => action('/isolated/updater')),
      platform: 'win32',
      nodeVersion: '22.0.0',
    };
  });

  test('returns a concrete plan and downloads nothing until explicit manual confirmation', async () => {
    const result = await runLatestUpdate({ projectDir }, deps);
    expect(result).toMatchObject({
      status: 'approval-required',
      targetVersion: '0.12.3',
      updated: false,
    });
    expect(result.command).toContain('--package=bmad-plus@0.12.3');
    expect(deps.checkForUpdate).toHaveBeenCalledWith({ projectDir, refresh: true });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('pins the exact package, official registry, guarded child, and one path argument', async () => {
    const result = await runLatestUpdate({ projectDir, yes: true }, deps);
    expect(result).toMatchObject({
      status: 'updated',
      targetVersion: '0.12.3',
      updated: true,
      reloadInstructions: true,
      output: 'done',
    });
    expect(deps.runNpm).toHaveBeenCalledWith(
      [
        'exec',
        '--yes',
        '--package=bmad-plus@0.12.3',
        '--registry=https://registry.npmjs.org/',
        '--script-shell=cmd.exe',
        '--',
        'bmad-plus',
        'update',
        '--yes',
        '--directory',
        projectDir,
        '--expected-version',
        '0.12.3',
      ],
      { cwd: '/isolated/updater', timeout: 120000, maxBuffer: 4 * 1024 * 1024 }
    );
    expect(deps.evaluateReadiness).not.toHaveBeenCalled();
    expect(deps.readManifest).toHaveBeenCalledTimes(3);
  });

  test('current fresh release needs no package execution', async () => {
    Object.assign(release, {
      status: 'current',
      targetVersion: '0.12.2',
      updateAvailable: false,
      releaseEligible: false,
    });
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).resolves.toMatchObject({
      status: 'current',
      updated: false,
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test.each([
    ['offline', { source: 'none', status: 'unknown' }],
    ['stale cache', { source: 'stale-cache', stale: true }],
    ['unexpected status', { status: 'unknown' }],
    ['range instead of exact version', { targetVersion: '^0.12.3' }],
    ['injected version', { targetVersion: '0.12.3 && echo unsafe' }],
    ['downgrade', { targetVersion: '0.12.1' }],
    ['ahead', { status: 'ahead' }],
    ['incompatible runtime', { engineCompatible: false }],
    ['malformed engine', { engines: { node: 'not a range' } }],
    ['future engine', { engines: { node: '>=999' } }],
    ['installation changed', { installedVersion: '0.12.1' }],
  ])('refuses %s before launching a package', async (_label, fields) => {
    Object.assign(release, fields);
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).rejects.toMatchObject({
      code: 'UPDATE_REFUSED',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('compares semantic versions rather than strings', async () => {
    manifest.version = release.installedVersion = '0.9.0';
    release.targetVersion = '0.10.0';
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).resolves.toMatchObject({
      targetVersion: '0.10.0',
      updated: true,
    });
  });

  test('does not allow a prerelease merely because manual --yes was supplied', async () => {
    release.targetVersion = '0.13.0-beta.1';
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).rejects.toMatchObject({
      reason: 'prerelease-not-allowed',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('automatic execution requires an authorized range and a clean ownership preflight', async () => {
    policy = { ...policy, mode: 'auto', allowedRange: '>=0.12.2 <0.13.0' };
    const result = await runLatestUpdate({ projectDir, auto: true }, deps);
    expect(result.updated).toBe(true);
    expect(deps.evaluateReadiness).toHaveBeenCalledWith({
      projectDir,
      manifest: { version: '0.12.2' },
    });
    expect(deps.runNpm.mock.calls[0][0]).toContain('--auto');
    expect(deps.readPolicy).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['notify', { mode: 'notify' }],
    ['off', { mode: 'off' }],
    ['out of range', { mode: 'auto', allowedRange: '>=0.13.0' }],
    ['missing range', { mode: 'auto' }],
  ])('blocks automatic updates under %s policy', async (_label, fields) => {
    policy = { ...policy, ...fields };
    await expect(runLatestUpdate({ projectDir, auto: true }, deps)).rejects.toMatchObject({
      code: 'UPDATE_REFUSED',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test.each([
    { ready: false, reason: 'modified-skill' },
    { ready: true, legacy: true },
    { ready: true, conflicts: [{ file: 'skill.md', reason: 'modified' }] },
  ])('refuses automatic ownership conflicts or legacy evidence: %j', async (readiness) => {
    policy = { ...policy, mode: 'auto', allowedRange: '>=0.12.2 <0.13.0' };
    deps.evaluateReadiness.mockResolvedValue(readiness);
    await expect(runLatestUpdate({ projectDir, auto: true }, deps)).rejects.toMatchObject({
      reason: 'ownership-preflight-failed',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('rechecks a policy revoked while ownership was evaluated', async () => {
    policy = { ...policy, mode: 'auto', allowedRange: '>=0.12.2 <0.13.0' };
    deps.evaluateReadiness.mockImplementation(async () => {
      policy.mode = 'notify';
      return { ready: true };
    });
    await expect(runLatestUpdate({ projectDir, auto: true }, deps)).rejects.toMatchObject({
      reason: 'approval-required',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('does not execute stale channel metadata when the policy channel changes', async () => {
    policy = { ...policy, mode: 'auto', allowedRange: '>=0.12.2 <0.13.0' };
    deps.evaluateReadiness.mockImplementation(async () => {
      policy.channel = 'next';
      return { ready: true };
    });
    await expect(runLatestUpdate({ projectDir, auto: true }, deps)).rejects.toMatchObject({
      reason: 'policy-channel-changed',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('refuses a concurrent manifest change before execution', async () => {
    deps.readManifest
      .mockReturnValueOnce({ version: '0.12.2' })
      .mockReturnValue({ version: '0.13.0' });
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).rejects.toMatchObject({
      reason: 'installation-changed-before-execution',
    });
    expect(deps.runNpm).not.toHaveBeenCalled();
  });

  test('does not claim success when the child leaves the wrong installed version', async () => {
    deps.runNpm.mockResolvedValue('pretended success');
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).rejects.toMatchObject({
      code: 'UPDATE_UNVERIFIED',
    });
  });

  test('propagates child failure instead of verifying or promoting a manifest', async () => {
    deps.runNpm.mockRejectedValue(new Error('wrong executing child version'));
    await expect(runLatestUpdate({ projectDir, yes: true }, deps)).rejects.toThrow(
      'wrong executing child version'
    );
    expect(deps.readManifest).toHaveBeenCalledTimes(2);
    expect(manifest.version).toBe('0.12.2');
  });
});
