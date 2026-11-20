/**
 * BMAD+ Python Provisioning — Unit Tests
 * Pure logic (version parsing, provisioner selection, command construction)
 * plus the side-effecting pipeline driven by an injected FAKE runner.
 * No real python/uv/pipx process is ever spawned here.
 */
const path = require('node:path');
const {
  MIN_PYTHON,
  parsePythonVersion,
  meetsMinVersion,
  pythonCandidates,
  chooseProvisioner,
  venvPython,
  buildEnvCommands,
  missingPythonGuidance,
  detectPython,
  detectProvisioner,
  createEnv,
  installRequirements,
  verifyImports,
  verifyEntry,
  provisionPack,
} = require('../../tools/cli/lib/python-provision');

// ── Fake runner ──────────────────────────────────────────────────────────────
// rules: array of { match: (cmd, args) => boolean, result: partialResult }
// Records every call; unmatched calls fail like a missing executable (ENOENT).
function fakeRunner(rules = []) {
  const calls = [];
  const runner = (cmd, args) => {
    calls.push({ cmd, args });
    for (const rule of rules) {
      if (rule.match(cmd, args)) {
        return { status: 0, stdout: '', stderr: '', error: null, ...rule.result };
      }
    }
    return { status: null, stdout: '', stderr: '', error: `spawnSync ${cmd} ENOENT` };
  };
  runner.calls = calls;
  return runner;
}

const ok = (overrides = {}) => ({ status: 0, stdout: '', stderr: '', error: null, ...overrides });
const isVersionProbe = (name) => (cmd, args) =>
  cmd === name && args[args.length - 1] === '--version';

// ── Pure: version parsing ────────────────────────────────────────────────────

describe('python-provision — parsePythonVersion', () => {
  test('parses standard CPython output', () => {
    expect(parsePythonVersion('Python 3.11.4')).toMatchObject({ major: 3, minor: 11, patch: 4 });
  });

  test('parses release-candidate and no-patch forms', () => {
    expect(parsePythonVersion('Python 3.13.0rc1')).toMatchObject({ major: 3, minor: 13, patch: 0 });
    expect(parsePythonVersion('Python 3.12')).toMatchObject({ major: 3, minor: 12, patch: 0 });
  });

  test('parses version embedded in multi-line stdout+stderr blob', () => {
    expect(parsePythonVersion('\nPython 3.11.9\n')).toMatchObject({ major: 3, minor: 11 });
  });

  test('returns null on garbage or non-string input', () => {
    expect(parsePythonVersion('command not found')).toBeNull();
    expect(parsePythonVersion('')).toBeNull();
    expect(parsePythonVersion(undefined)).toBeNull();
  });
});

describe('python-provision — meetsMinVersion', () => {
  test('accepts exactly the minimum (3.11)', () => {
    expect(meetsMinVersion({ major: 3, minor: 11 })).toBe(true);
  });
  test('accepts newer minors and majors', () => {
    expect(meetsMinVersion({ major: 3, minor: 13 })).toBe(true);
    expect(meetsMinVersion({ major: 4, minor: 0 })).toBe(true);
  });
  test('rejects older versions and null', () => {
    expect(meetsMinVersion({ major: 3, minor: 10 })).toBe(false);
    expect(meetsMinVersion({ major: 2, minor: 7 })).toBe(false);
    expect(meetsMinVersion(null)).toBe(false);
  });
  test('honors a custom minimum', () => {
    expect(meetsMinVersion({ major: 3, minor: 11 }, { major: 3, minor: 12 })).toBe(false);
  });
});

// ── Pure: candidates, provisioner choice, paths ──────────────────────────────

describe('python-provision — pythonCandidates', () => {
  test('windows probes the py launcher first with -3', () => {
    const c = pythonCandidates('win32');
    expect(c[0]).toEqual({ cmd: 'py', baseArgs: ['-3'] });
    expect(c.map((x) => x.cmd)).toEqual(['py', 'python', 'python3']);
  });
  test('unix probes python3 first', () => {
    expect(pythonCandidates('linux').map((x) => x.cmd)).toEqual(['python3', 'python']);
    expect(pythonCandidates('darwin')[0].cmd).toBe('python3');
  });
});

describe('python-provision — chooseProvisioner', () => {
  test('prefers uv over everything', () => {
    expect(chooseProvisioner({ uv: true, pipx: true })).toBe('uv');
  });
  test('falls back to pipx, then venv', () => {
    expect(chooseProvisioner({ uv: false, pipx: true })).toBe('pipx');
    expect(chooseProvisioner({ uv: false, pipx: false })).toBe('venv');
    expect(chooseProvisioner()).toBe('venv');
  });
});

describe('python-provision — venvPython', () => {
  test('windows layout', () => {
    expect(venvPython(path.join('.bmad', 'venv'), 'win32')).toBe(
      path.join('.bmad', 'venv', 'Scripts', 'python.exe')
    );
  });
  test('posix layout', () => {
    expect(venvPython('.bmad/venv', 'linux')).toBe(path.join('.bmad/venv', 'bin', 'python'));
  });
});

// ── Pure: command construction (arg arrays, never shell strings) ─────────────

describe('python-provision — buildEnvCommands', () => {
  const envDir = path.join('.bmad', 'venv');
  const req = path.join('pack', 'requirements.txt');

  test('uv: uv venv + uv pip install targeting the env python', () => {
    const { create, install } = buildEnvCommands({
      tool: 'uv',
      python: null,
      envDir,
      requirementsPath: req,
      platform: 'win32',
    });
    expect(create).toEqual([
      {
        cmd: 'uv',
        args: ['venv', envDir, '--python', `${MIN_PYTHON.major}.${MIN_PYTHON.minor}`],
        label: 'uv venv',
      },
    ]);
    expect(install).toHaveLength(1);
    expect(install[0].cmd).toBe('uv');
    expect(install[0].args).toEqual([
      'pip',
      'install',
      '-r',
      req,
      '--python',
      venvPython(envDir, 'win32'),
    ]);
  });

  test('pipx: pipx run virtualenv + env pip install', () => {
    const { create, install } = buildEnvCommands({
      tool: 'pipx',
      python: null,
      envDir,
      requirementsPath: req,
      platform: 'linux',
    });
    expect(create).toEqual([
      { cmd: 'pipx', args: ['run', 'virtualenv', envDir], label: 'pipx run virtualenv' },
    ]);
    expect(install[0]).toEqual({
      cmd: venvPython(envDir, 'linux'),
      args: ['-m', 'pip', 'install', '-r', req],
      label: 'pip install (pipx env)',
    });
  });

  test('venv: uses the detected interpreter with its baseArgs (py -3)', () => {
    const python = { cmd: 'py', baseArgs: ['-3'] };
    const { create, install } = buildEnvCommands({
      tool: 'venv',
      python,
      envDir,
      requirementsPath: req,
      platform: 'win32',
    });
    expect(create).toEqual([
      { cmd: 'py', args: ['-3', '-m', 'venv', envDir], label: 'python -m venv' },
    ]);
    expect(install[0].cmd).toBe(venvPython(envDir, 'win32'));
    expect(install[0].args).toEqual(['-m', 'pip', 'install', '-r', req]);
  });

  test('no requirements → no install steps, env creation still built', () => {
    const { create, install } = buildEnvCommands({
      tool: 'venv',
      python: { cmd: 'python3', baseArgs: [] },
      envDir,
      platform: 'linux',
    });
    expect(create).toHaveLength(1);
    expect(install).toEqual([]);
  });

  test('every step is a {cmd, args[]} pair — no shell strings anywhere', () => {
    for (const tool of ['uv', 'pipx', 'venv']) {
      const { create, install } = buildEnvCommands({
        tool,
        python: { cmd: 'python3', baseArgs: [] },
        envDir,
        requirementsPath: req,
        platform: 'linux',
      });
      for (const step of [...create, ...install]) {
        expect(typeof step.cmd).toBe('string');
        expect(Array.isArray(step.args)).toBe(true);
        // no step smuggles a whole command line into a single string
        expect(step.cmd.includes(' && ')).toBe(false);
        for (const a of step.args) expect(typeof a).toBe('string');
      }
    }
  });
});

// ── Side-effecting: detection via fake runner ────────────────────────────────

describe('python-provision — detectPython (fake runner)', () => {
  test('finds a suitable interpreter on the second candidate', () => {
    const runner = fakeRunner([
      // 'py' missing (default ENOENT), 'python' is 3.12
      { match: isVersionProbe('python'), result: ok({ stdout: 'Python 3.12.1\n' }) },
    ]);
    const res = detectPython({ runner, platform: 'win32' });
    expect(res.ok).toBe(true);
    expect(res.tool).toBe('python');
    expect(res.command).toEqual({ cmd: 'python', baseArgs: [] });
    expect(res.version).toMatchObject({ major: 3, minor: 12 });
    // probed py first, then python — with arg arrays
    expect(runner.calls[0]).toEqual({ cmd: 'py', args: ['-3', '--version'] });
    expect(runner.calls[1]).toEqual({ cmd: 'python', args: ['--version'] });
  });

  test('too-old interpreter → ok:false with version + install guidance, no throw', () => {
    const runner = fakeRunner([
      { match: isVersionProbe('python3'), result: ok({ stdout: 'Python 3.9.7\n' }) },
    ]);
    const res = detectPython({ runner, platform: 'linux' });
    expect(res.ok).toBe(false);
    expect(res.tool).toBeNull();
    const blob = res.messages.join('\n');
    expect(blob).toContain('3.9');
    expect(blob).toContain('>= 3.11');
    expect(blob).toContain('python.org');
  });

  test('no interpreter at all → ok:false with platform guidance', () => {
    const runner = fakeRunner([]);
    const res = detectPython({ runner, platform: 'win32' });
    expect(res.ok).toBe(false);
    expect(res.messages.join('\n')).toContain('winget');
  });
});

describe('python-provision — detectProvisioner (fake runner)', () => {
  test('uv wins when available (pipx not even probed)', () => {
    const runner = fakeRunner([
      { match: isVersionProbe('uv'), result: ok({ stdout: 'uv 0.5.0' }) },
    ]);
    const res = detectProvisioner({ runner });
    expect(res.tool).toBe('uv');
    expect(runner.calls.map((c) => c.cmd)).toEqual(['uv']);
  });

  test('pipx when uv missing', () => {
    const runner = fakeRunner([{ match: isVersionProbe('pipx'), result: ok({ stdout: '1.7.1' }) }]);
    expect(detectProvisioner({ runner }).tool).toBe('pipx');
  });

  test('venv fallback when neither exists', () => {
    const res = detectProvisioner({ runner: fakeRunner([]) });
    expect(res.tool).toBe('venv');
    expect(res.messages.join(' ')).toContain('venv');
  });
});

// ── Side-effecting: steps and full pipeline ──────────────────────────────────

describe('python-provision — createEnv / installRequirements / verify (fake runner)', () => {
  const envDir = path.join('proj', '.bmad', 'venv');
  const envPy = venvPython(envDir, 'linux');
  const req = path.join('proj', 'requirements.txt');
  const python = { cmd: 'python3', baseArgs: [] };

  test('createEnv failure surfaces the tool error, no throw', () => {
    const runner = fakeRunner([
      {
        match: (c) => c === 'python3',
        result: ok({ status: 1, stderr: 'venv: error: permission denied' }),
      },
    ]);
    const res = createEnv({ tool: 'venv', python, envDir, runner, platform: 'linux' });
    expect(res.ok).toBe(false);
    expect(res.messages.join(' ')).toContain('permission denied');
  });

  test('installRequirements returns ok:false when the file is missing', () => {
    const runner = fakeRunner([]);
    const res = installRequirements({
      tool: 'venv',
      python,
      envDir,
      requirementsPath: req,
      runner,
      platform: 'linux',
      fileExists: () => false,
    });
    expect(res.ok).toBe(false);
    expect(res.messages.join(' ')).toContain(req);
    expect(runner.calls).toHaveLength(0); // nothing spawned for a missing file
  });

  test('verifyImports runs one interpreter call importing all modules', () => {
    const runner = fakeRunner([{ match: (c) => c === envPy, result: ok() }]);
    const res = verifyImports({ envDir, modules: ['requests', 'bs4'], runner, platform: 'linux' });
    expect(res.ok).toBe(true);
    expect(runner.calls).toEqual([{ cmd: envPy, args: ['-c', 'import requests, bs4'] }]);
  });

  test('verifyEntry smoke-runs the entry script inside the env', () => {
    const runner = fakeRunner([{ match: (c) => c === envPy, result: ok() }]);
    const res = verifyEntry({
      envDir,
      entryPath: 'scripts/seo_fetch.py',
      runner,
      platform: 'linux',
    });
    expect(res.ok).toBe(true);
    expect(runner.calls[0]).toEqual({ cmd: envPy, args: ['scripts/seo_fetch.py', '--help'] });
  });
});

describe('python-provision — provisionPack full pipeline (fake runner)', () => {
  const envDir = path.join('proj', '.bmad', 'venv');
  const req = path.join('proj', 'requirements.txt');

  test('happy path with uv: detect → create → install → verify, ok:true', () => {
    const envPy = venvPython(envDir, 'win32');
    const runner = fakeRunner([
      { match: isVersionProbe('uv'), result: ok({ stdout: 'uv 0.5.0' }) },
      { match: isVersionProbe('py'), result: ok({ stdout: 'Python 3.12.3' }) },
      { match: (c, a) => c === 'uv' && a[0] === 'venv', result: ok() },
      { match: (c, a) => c === 'uv' && a[0] === 'pip', result: ok() },
      { match: (c) => c === envPy, result: ok() },
    ]);

    const res = provisionPack({
      envDir,
      requirementsPath: req,
      verifyModules: ['requests', 'bs4'],
      runner,
      platform: 'win32',
      fileExists: () => true,
    });

    expect(res.ok).toBe(true);
    expect(res.tool).toBe('uv');
    expect(res.python).toMatchObject({ major: 3, minor: 12 });
    expect(res.messages.join('\n')).toContain('provisioned and verified');

    // exact spawn sequence, all arg arrays
    const seq = runner.calls.map((c) => [c.cmd, ...c.args].join(' '));
    expect(seq).toEqual([
      'uv --version',
      'py -3 --version',
      `uv venv ${envDir} --python 3.11`,
      `uv pip install -r ${req} --python ${envPy}`,
      `${envPy} -c import requests, bs4`,
    ]);
  });

  test('no python, no uv → ok:false with guidance, and NO env/install attempted', () => {
    const runner = fakeRunner([]); // everything ENOENT
    const res = provisionPack({
      envDir,
      requirementsPath: req,
      runner,
      platform: 'linux',
      fileExists: () => true,
    });
    expect(res.ok).toBe(false);
    expect(res.tool).toBe('venv');
    expect(res.messages.join('\n')).toContain('not found on PATH');
    // only probes ran: uv, pipx, python3, python — no venv creation, no pip
    expect(runner.calls.every((c) => c.args[c.args.length - 1] === '--version')).toBe(true);
  });

  test('no system python but uv present → proceeds with uv-managed interpreter', () => {
    const runner = fakeRunner([
      { match: isVersionProbe('uv'), result: ok({ stdout: 'uv 0.5.0' }) },
      { match: (c, a) => c === 'uv' && a[0] === 'venv', result: ok() },
      { match: (c, a) => c === 'uv' && a[0] === 'pip', result: ok() },
    ]);
    const res = provisionPack({
      envDir,
      requirementsPath: req,
      runner,
      platform: 'linux',
      fileExists: () => true,
    });
    expect(res.ok).toBe(true);
    expect(res.tool).toBe('uv');
    expect(res.messages.join('\n')).toContain('uv will download a managed interpreter');
  });

  test('pip install failure → ok:false, retry hint, verify never runs', () => {
    const envPy = venvPython(envDir, 'linux');
    const runner = fakeRunner([
      { match: isVersionProbe('python3'), result: ok({ stdout: 'Python 3.11.9' }) },
      { match: (c, a) => c === 'python3' && a.includes('venv'), result: ok() },
      {
        match: (c, a) => c === envPy && a[0] === '-m',
        result: ok({ status: 1, stderr: 'ERROR: No matching distribution found for lxml==5.2.0' }),
      },
    ]);
    const res = provisionPack({
      envDir,
      requirementsPath: req,
      verifyModules: ['lxml'],
      runner,
      platform: 'linux',
      fileExists: () => true,
    });
    expect(res.ok).toBe(false);
    const blob = res.messages.join('\n');
    expect(blob).toContain('No matching distribution');
    expect(blob).toContain('retry manually');
    // no '-c import …' verify call happened
    expect(runner.calls.some((c) => c.args[0] === '-c')).toBe(false);
  });

  test('import verification failure → ok:false (pack must not report healthy)', () => {
    const envPy = venvPython(envDir, 'linux');
    const runner = fakeRunner([
      { match: isVersionProbe('python3'), result: ok({ stdout: 'Python 3.11.9' }) },
      { match: (c, a) => c === 'python3' && a.includes('venv'), result: ok() },
      { match: (c, a) => c === envPy && a[0] === '-m', result: ok() }, // pip ok
      {
        match: (c, a) => c === envPy && a[0] === '-c',
        result: ok({ status: 1, stderr: "ModuleNotFoundError: No module named 'bs4'" }),
      },
    ]);
    const res = provisionPack({
      envDir,
      requirementsPath: req,
      verifyModules: ['requests', 'bs4'],
      runner,
      platform: 'linux',
      fileExists: () => true,
    });
    expect(res.ok).toBe(false);
    expect(res.messages.join('\n')).toContain('ModuleNotFoundError');
  });

  test('missing envDir → structured failure, never throws', () => {
    const res = provisionPack({ envDir: null, runner: fakeRunner([]) });
    expect(res.ok).toBe(false);
    expect(res.messages.join(' ')).toContain('envDir');
  });
});

describe('python-provision — missingPythonGuidance', () => {
  test('mentions uv as an alternative on every platform', () => {
    for (const p of ['win32', 'darwin', 'linux']) {
      expect(missingPythonGuidance(p).join('\n')).toContain('uv');
    }
  });
});
