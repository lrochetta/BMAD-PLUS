const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const policy = require('../../tools/cli/lib/update-policy');
const command = require('../../tools/cli/commands/update-policy');

describe('explicit update policy', () => {
  let project;
  let savedExit;
  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-update-policy-'));
    savedExit = process.exitCode;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.exitCode = savedExit;
    fs.rmSync(project, { recursive: true, force: true });
  });

  test('an absent policy defaults to notify without creating any file', () => {
    expect(policy.readUpdatePolicy(project)).toEqual(policy.DEFAULT_POLICY);
    expect(fs.readdirSync(project)).toEqual([]);
    expect(policy.authorizeTarget(policy.readUpdatePolicy(project), '0.12.3')).toEqual({
      allowed: false,
      reason: 'approval-required',
    });
  });

  test('explicit policy writes roundtrip atomically and can be revoked', () => {
    policy.writeUpdatePolicy(project, { mode: 'auto', allowedRange: '~0.12.2' });
    expect(policy.authorizeTarget(policy.readUpdatePolicy(project), '0.12.3').allowed).toBe(true);
    expect(policy.authorizeTarget(policy.readUpdatePolicy(project), '0.13.0').reason).toBe(
      'outside-allowed-range'
    );
    policy.writeUpdatePolicy(project, { mode: 'off' });
    expect(policy.authorizeTarget(policy.readUpdatePolicy(project), '0.12.3').reason).toBe(
      'updates-disabled'
    );
    expect(fs.readdirSync(path.join(project, '_bmad'))).toEqual(['update-policy.json']);
  });

  test.each([
    null,
    [],
    { mode: 'automatic' },
    { mode: 'auto' },
    { allowedRange: '' },
    { allowedRange: 'invalid range' },
    { channel: 'latest;echo' },
    { allowPrerelease: 'true' },
    { registry: 'https://other.example/' },
    { schemaVersion: 99 },
    { execute: 'anything' },
  ])('invalid configuration cannot authorize or persist: %j', (value) => {
    expect(() => policy.writeUpdatePolicy(project, value)).toThrow();
    expect(policy.authorizeTarget(value, '0.12.3').allowed).toBe(false);
    expect(fs.readdirSync(project)).toEqual([]);
  });

  test('prereleases require explicit permission and a matching range', () => {
    const base = { mode: 'auto', allowedRange: '>=0.12.2 <0.14.0', channel: 'next' };
    expect(policy.authorizeTarget(base, '0.13.0-beta.1').reason).toBe('prerelease-not-allowed');
    expect(
      policy.authorizeTarget({ ...base, allowPrerelease: true }, '0.13.0-beta.1').allowed
    ).toBe(true);
  });

  test.each(['v0.12.3', '0.12', ' 0.12.3', '0.12.3;echo', '01.2.3', 'latest', null])(
    'rejects an inexact package version: %p',
    (value) => {
      expect(policy.isExactVersion(value)).toBe(false);
      expect(policy.authorizeTarget({ mode: 'auto', allowedRange: '*' }, value).reason).toBe(
        'invalid-target-version'
      );
    }
  );

  test('a valid build-metadata version remains an exact allowed value', () => {
    expect(policy.isExactVersion('1.2.3+build.4')).toBe(true);
  });

  test('a corrupt policy fails closed instead of reverting to defaults', () => {
    fs.mkdirSync(path.join(project, '_bmad'));
    fs.writeFileSync(path.join(project, policy.POLICY_FILE), '{broken');
    expect(() => policy.readUpdatePolicy(project)).toThrow(/invalid/);
  });

  test('linked policy directories are rejected before reading or writing', () => {
    const victim = path.join(project, 'victim');
    fs.mkdirSync(victim);
    fs.writeFileSync(
      path.join(victim, 'update-policy.json'),
      JSON.stringify({ mode: 'auto', allowedRange: '*' })
    );
    fs.symlinkSync(
      victim,
      path.join(project, '_bmad'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect(() => policy.readUpdatePolicy(project)).toThrow(/symbolic link|junction/);
    expect(() => policy.writeUpdatePolicy(project, { mode: 'off' })).toThrow(
      /symbolic link|junction/
    );
    expect(JSON.parse(fs.readFileSync(path.join(victim, 'update-policy.json'), 'utf8')).mode).toBe(
      'auto'
    );
  });

  test('a failed replacement leaves the previous policy intact and removes its temporary file', () => {
    policy.writeUpdatePolicy(project, { mode: 'notify' });
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('read only');
    });
    expect(() => policy.writeUpdatePolicy(project, { mode: 'off' })).toThrow('read only');
    expect(policy.readUpdatePolicy(project).mode).toBe('notify');
    expect(fs.readdirSync(path.join(project, '_bmad'))).toEqual(['update-policy.json']);
  });

  test('CLI show is read-only; auto needs an explicit range; JSON has no extra chatter', async () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.action({ directory: project, json: true });
    expect(JSON.parse(output.mock.calls[0][0])).toEqual({
      policy: policy.DEFAULT_POLICY,
      changed: false,
    });
    expect(fs.readdirSync(project)).toEqual([]);
    output.mockClear();
    await command.action({ directory: project, json: true, mode: 'auto' });
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(output.mock.calls[0][0]).error).toContain('--range');
    expect(fs.readdirSync(project)).toEqual([]);
  });

  test('CLI explicit updates preserve unspecified fields and can disable prereleases', async () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.action({
      directory: project,
      mode: 'auto',
      range: '^0.12.2',
      channel: 'next',
      allowPrerelease: true,
    });
    expect(policy.readUpdatePolicy(project)).toMatchObject({
      mode: 'auto',
      channel: 'next',
      allowPrerelease: true,
    });
    await command.action({ directory: project, stableOnly: true, json: true });
    expect(policy.readUpdatePolicy(project)).toMatchObject({
      mode: 'auto',
      channel: 'next',
      allowPrerelease: false,
    });
    expect(output).toHaveBeenCalledTimes(2);
  });

  test('CLI conflicting flags fail without changing policy', async () => {
    const output = jest.spyOn(console, 'error').mockImplementation(() => {});
    await command.action({ directory: project, allowPrerelease: true, stableOnly: true });
    expect(process.exitCode).toBe(1);
    expect(output).toHaveBeenCalledWith(expect.stringContaining('Choose'));
    expect(fs.readdirSync(project)).toEqual([]);
  });
});
