/**
 * BMAD+ Unified Python Provisioning (Pillar 2 — kills split-brain / broken-on-arrival)
 *
 * Provisions the Python runtime a pack declares in the registry
 * (`runtime: [node, python]`). One code path for every Python pack:
 *   1. detect a Python >= 3.11 interpreter (or a uv that can fetch one)
 *   2. choose a provisioner: uv > pipx > venv+pip
 *   3. create an isolated env under a given dir (e.g. <project>/.bmad/venv)
 *   4. install the pack's requirements.txt into that env
 *   5. VERIFY the pack's entry modules import / entry script runs
 *
 * Design rules:
 *  - every external command goes through spawnSync with an ARG ARRAY (never a
 *    shell string) → no injection surface, no quoting bugs.
 *  - pure functions (version parsing, candidate lists, provisioner choice,
 *    command construction) are exported separately and unit-tested without
 *    spawning anything.
 *  - side-effecting functions take an injectable `runner` for testability.
 *  - NOTHING here throws for a missing interpreter/tool: callers always get a
 *    structured { ok, tool, messages[] } with actionable guidance.
 *
 * Author: Laurent Rochetta
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

/** Minimum Python required by the registry (registry.yaml → runtimes.python). */
const MIN_PYTHON = { major: 3, minor: 11 };

/** Hard ceiling for any single provisioning step (pip installs can be slow). */
const STEP_TIMEOUT_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Runner — the ONLY place a real process is spawned.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default command runner. Wraps spawnSync with safe defaults.
 * @param {string} cmd  Executable name (resolved via PATH).
 * @param {string[]} args  Argument array — NEVER a shell string.
 * @param {object} [opts]  Extra spawnSync options (cwd, timeout…).
 * @returns {{ status: number|null, stdout: string, stderr: string, error: string|null }}
 */
function defaultRunner(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: STEP_TIMEOUT_MS,
    ...opts,
  });
  return {
    status: typeof res.status === 'number' ? res.status : null,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error ? String(res.error.message || res.error) : null,
  };
}

/** True when a runner result represents a successful invocation. */
function ranOk(result) {
  return Boolean(result) && result.error === null && result.status === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure logic — no I/O, fully unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a `python --version` / `py -3 --version` output line.
 * Accepts "Python 3.11.4", "Python 3.13.0rc1", output on stdout OR stderr.
 * @param {string} text
 * @returns {{ major: number, minor: number, patch: number, raw: string }|null}
 */
function parsePythonVersion(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] !== undefined ? Number(m[3]) : 0,
    raw: m[0],
  };
}

/**
 * @param {{major:number, minor:number}|null} version
 * @param {{major:number, minor:number}} [min]
 * @returns {boolean}
 */
function meetsMinVersion(version, min = MIN_PYTHON) {
  if (!version) return false;
  if (version.major !== min.major) return version.major > min.major;
  return version.minor >= min.minor;
}

/**
 * Interpreter candidates to probe, in priority order, per platform.
 * `baseArgs` are prepended to every use of the command (the Windows `py`
 * launcher needs `-3` to pick a Python 3).
 * @param {string} [platform]  process.platform value ('win32', 'linux', 'darwin')
 * @returns {Array<{ cmd: string, baseArgs: string[] }>}
 */
function pythonCandidates(platform = process.platform) {
  if (platform === 'win32') {
    return [
      { cmd: 'py', baseArgs: ['-3'] },
      { cmd: 'python', baseArgs: [] },
      { cmd: 'python3', baseArgs: [] },
    ];
  }
  return [
    { cmd: 'python3', baseArgs: [] },
    { cmd: 'python', baseArgs: [] },
  ];
}

/**
 * Choose the provisioner from availability flags (registry.yaml:
 * `provisioner: uv, fallback: pipx`, then plain venv+pip as last resort).
 * @param {{ uv?: boolean, pipx?: boolean }} availability
 * @returns {'uv'|'pipx'|'venv'}
 */
function chooseProvisioner({ uv = false, pipx = false } = {}) {
  if (uv) return 'uv';
  if (pipx) return 'pipx';
  return 'venv';
}

/**
 * Path of the python executable inside a virtualenv.
 * @param {string} envDir
 * @param {string} [platform]
 * @returns {string}
 */
function venvPython(envDir, platform = process.platform) {
  return platform === 'win32'
    ? path.join(envDir, 'Scripts', 'python.exe')
    : path.join(envDir, 'bin', 'python');
}

/**
 * Build the exact command steps (arg arrays) to create the env and install
 * requirements with the chosen tool. Pure: constructs, never executes.
 *
 * @param {object} p
 * @param {'uv'|'pipx'|'venv'} p.tool       Chosen provisioner.
 * @param {{cmd:string, baseArgs:string[]}|null} p.python  Detected interpreter
 *        (may be null only for uv, which can fetch its own Python).
 * @param {string} p.envDir                 Target env dir (e.g. .bmad/venv).
 * @param {string|null} [p.requirementsPath] requirements.txt to install, or null.
 * @param {string} [p.platform]
 * @returns {{ create: Array<{cmd:string,args:string[],label:string}>,
 *             install: Array<{cmd:string,args:string[],label:string}> }}
 */
function buildEnvCommands({
  tool,
  python,
  envDir,
  requirementsPath = null,
  platform = process.platform,
}) {
  const envPy = venvPython(envDir, platform);
  const create = [];
  const install = [];

  if (tool === 'uv') {
    create.push({
      cmd: 'uv',
      // `--python 3.11` lets uv pick (or download) a matching interpreter even
      // when the system Python is absent or too old.
      args: ['venv', envDir, '--python', `${MIN_PYTHON.major}.${MIN_PYTHON.minor}`],
      label: 'uv venv',
    });
    if (requirementsPath) {
      install.push({
        cmd: 'uv',
        args: ['pip', 'install', '-r', requirementsPath, '--python', envPy],
        label: 'uv pip install',
      });
    }
    return { create, install };
  }

  if (tool === 'pipx') {
    // pipx ships `pipx run` which can execute the virtualenv app in isolation
    // without polluting the system Python.
    create.push({
      cmd: 'pipx',
      args: ['run', 'virtualenv', envDir],
      label: 'pipx run virtualenv',
    });
    if (requirementsPath) {
      install.push({
        cmd: envPy,
        args: ['-m', 'pip', 'install', '-r', requirementsPath],
        label: 'pip install (pipx env)',
      });
    }
    return { create, install };
  }

  // tool === 'venv' — stdlib venv + pip, requires a detected interpreter.
  const py = python || { cmd: 'python', baseArgs: [] };
  create.push({
    cmd: py.cmd,
    args: [...py.baseArgs, '-m', 'venv', envDir],
    label: 'python -m venv',
  });
  if (requirementsPath) {
    install.push({
      cmd: envPy,
      args: ['-m', 'pip', 'install', '-r', requirementsPath],
      label: 'pip install (venv)',
    });
  }
  return { create, install };
}

/**
 * Human guidance shown when no suitable Python is found.
 * @param {string} [platform]
 * @returns {string[]}
 */
function missingPythonGuidance(platform = process.platform) {
  const min = `${MIN_PYTHON.major}.${MIN_PYTHON.minor}`;
  const lines = [`Python >= ${min} was not found on PATH.`];
  if (platform === 'win32') {
    lines.push(
      `Install it with: winget install Python.Python.3.12  (or from https://www.python.org/downloads/)`
    );
  } else if (platform === 'darwin') {
    lines.push(
      `Install it with: brew install python@3.12  (or from https://www.python.org/downloads/)`
    );
  } else {
    lines.push(
      `Install it with your package manager (e.g. apt install python3.12) or from https://www.python.org/downloads/`
    );
  }
  lines.push(
    `Alternatively install uv (https://docs.astral.sh/uv/) — BMAD+ will use it to fetch Python ${min} automatically.`
  );
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Side-effecting steps — all take an injectable runner.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probe PATH for a Python >= minVersion.
 * Never throws: a missing interpreter yields { ok:false } + guidance.
 *
 * @param {object} [opts]
 * @param {Function} [opts.runner]
 * @param {string} [opts.platform]
 * @param {{major:number,minor:number}} [opts.minVersion]
 * @returns {{ ok: boolean, tool: 'python'|null, command: {cmd:string,baseArgs:string[]}|null,
 *             version: object|null, messages: string[] }}
 */
function detectPython({
  runner = defaultRunner,
  platform = process.platform,
  minVersion = MIN_PYTHON,
} = {}) {
  const messages = [];
  let tooOld = null;

  for (const candidate of pythonCandidates(platform)) {
    const res = runner(candidate.cmd, [...candidate.baseArgs, '--version']);
    if (!ranOk(res)) continue; // not installed / broken shim — try next
    // Python 2 printed the version on stderr; be liberal in what we accept.
    const version = parsePythonVersion(`${res.stdout}\n${res.stderr}`);
    if (!version) continue;
    if (meetsMinVersion(version, minVersion)) {
      messages.push(
        `Found ${version.raw} via \`${[candidate.cmd, ...candidate.baseArgs].join(' ')}\`.`
      );
      return { ok: true, tool: 'python', command: candidate, version, messages };
    }
    tooOld = { candidate, version };
  }

  if (tooOld) {
    messages.push(
      `Found ${tooOld.version.raw} via \`${tooOld.candidate.cmd}\`, but BMAD+ requires >= ${minVersion.major}.${minVersion.minor}.`
    );
  }
  messages.push(...missingPythonGuidance(platform));
  return { ok: false, tool: null, command: null, version: null, messages };
}

/**
 * Detect which provisioner is available (uv > pipx > venv fallback).
 * @param {object} [opts]
 * @param {Function} [opts.runner]
 * @returns {{ ok: true, tool: 'uv'|'pipx'|'venv', messages: string[] }}
 */
function detectProvisioner({ runner = defaultRunner } = {}) {
  const messages = [];
  const uv = ranOk(runner('uv', ['--version']));
  const pipx = uv ? false : ranOk(runner('pipx', ['--version']));
  const tool = chooseProvisioner({ uv, pipx });
  if (tool === 'venv') {
    messages.push('Neither uv nor pipx found — falling back to stdlib venv + pip.');
  } else {
    messages.push(`Using ${tool} as Python provisioner.`);
  }
  return { ok: true, tool, messages };
}

/**
 * Create the isolated env with the chosen tool.
 * @returns {{ ok: boolean, tool: string, envDir: string, messages: string[] }}
 */
function createEnv({ tool, python, envDir, runner = defaultRunner, platform = process.platform }) {
  const messages = [];
  const { create } = buildEnvCommands({ tool, python, envDir, platform });
  for (const step of create) {
    const res = runner(step.cmd, step.args);
    if (!ranOk(res)) {
      messages.push(`Failed to create env (${step.label}): ${firstErrorLine(res)}`);
      return { ok: false, tool, envDir, messages };
    }
  }
  messages.push(`Created isolated Python env at ${envDir} (${tool}).`);
  return { ok: true, tool, envDir, messages };
}

/**
 * Install a requirements.txt into an existing env.
 * @returns {{ ok: boolean, tool: string, messages: string[] }}
 */
function installRequirements({
  tool,
  python,
  envDir,
  requirementsPath,
  runner = defaultRunner,
  platform = process.platform,
  fileExists = fs.existsSync,
}) {
  const messages = [];
  if (!requirementsPath) {
    return { ok: true, tool, messages: ['No requirements.txt declared — nothing to install.'] };
  }
  if (!fileExists(requirementsPath)) {
    messages.push(`requirements file not found: ${requirementsPath}`);
    return { ok: false, tool, messages };
  }
  const { install } = buildEnvCommands({ tool, python, envDir, requirementsPath, platform });
  for (const step of install) {
    const res = runner(step.cmd, step.args);
    if (!ranOk(res)) {
      messages.push(`Dependency install failed (${step.label}): ${firstErrorLine(res)}`);
      messages.push(`You can retry manually: ${step.cmd} ${step.args.join(' ')}`);
      return { ok: false, tool, messages };
    }
  }
  messages.push(`Installed ${path.basename(requirementsPath)} into ${envDir}.`);
  return { ok: true, tool, messages };
}

/**
 * Verify that the pack's entry modules import inside the env.
 * @param {object} p
 * @param {string[]} p.modules  e.g. ['requests', 'bs4'] — verified in ONE interpreter call.
 * @returns {{ ok: boolean, messages: string[] }}
 */
function verifyImports({ envDir, modules, runner = defaultRunner, platform = process.platform }) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return { ok: true, messages: [] };
  }
  const envPy = venvPython(envDir, platform);
  const res = runner(envPy, ['-c', `import ${modules.join(', ')}`]);
  if (!ranOk(res)) {
    return {
      ok: false,
      messages: [`Import check failed for [${modules.join(', ')}]: ${firstErrorLine(res)}`],
    };
  }
  return { ok: true, messages: [`Verified imports: ${modules.join(', ')}.`] };
}

/**
 * Verify that the pack's entry script runs inside the env (default: --help).
 * @returns {{ ok: boolean, messages: string[] }}
 */
function verifyEntry({
  envDir,
  entryPath,
  entryArgs = ['--help'],
  runner = defaultRunner,
  platform = process.platform,
}) {
  if (!entryPath) return { ok: true, messages: [] };
  const envPy = venvPython(envDir, platform);
  const res = runner(envPy, [entryPath, ...entryArgs]);
  if (!ranOk(res)) {
    return {
      ok: false,
      messages: [
        `Entry check failed (${path.basename(entryPath)} ${entryArgs.join(' ')}): ${firstErrorLine(res)}`,
      ],
    };
  }
  return { ok: true, messages: [`Verified entry: ${path.basename(entryPath)} runs.`] };
}

/**
 * Full pipeline: detect → choose provisioner → create env → install → verify.
 * This is the single call site the installer uses for ANY pack whose registry
 * runtime includes "python".
 *
 * Never throws for environmental problems — always returns
 * { ok, tool, messages[] } so the installer can degrade gracefully and print
 * guidance instead of aborting the whole install.
 *
 * @param {object} p
 * @param {string} p.envDir                    e.g. path.join(projectDir, '.bmad', 'venv')
 * @param {string|null} [p.requirementsPath]   pack requirements.txt (absolute)
 * @param {string[]} [p.verifyModules]         modules that must import post-install
 * @param {string|null} [p.entryPath]          entry script to smoke-run
 * @param {string[]} [p.entryArgs]
 * @param {Function} [p.runner]                injectable for tests
 * @param {string} [p.platform]
 * @param {Function} [p.fileExists]
 * @param {{major:number,minor:number}} [p.minVersion]
 * @returns {{ ok: boolean, tool: string|null, envDir: string, python: object|null, messages: string[] }}
 */
function provisionPack({
  envDir,
  requirementsPath = null,
  verifyModules = [],
  entryPath = null,
  entryArgs = ['--help'],
  runner = defaultRunner,
  platform = process.platform,
  fileExists = fs.existsSync,
  minVersion = MIN_PYTHON,
}) {
  const messages = [];

  if (!envDir) {
    return {
      ok: false,
      tool: null,
      envDir: null,
      python: null,
      messages: ['provisionPack: envDir is required.'],
    };
  }

  // 1) provisioner first — uv can operate without a system Python.
  const prov = detectProvisioner({ runner });
  messages.push(...prov.messages);

  // 2) interpreter
  const py = detectPython({ runner, platform, minVersion });
  messages.push(...py.messages);
  if (!py.ok && prov.tool !== 'uv') {
    return { ok: false, tool: prov.tool, envDir, python: null, messages };
  }
  if (!py.ok && prov.tool === 'uv') {
    messages.push(
      `No system Python >= ${minVersion.major}.${minVersion.minor} — uv will download a managed interpreter.`
    );
  }

  // 3) create isolated env
  const created = createEnv({ tool: prov.tool, python: py.command, envDir, runner, platform });
  messages.push(...created.messages);
  if (!created.ok) {
    return { ok: false, tool: prov.tool, envDir, python: py.version, messages };
  }

  // 4) install requirements
  const installed = installRequirements({
    tool: prov.tool,
    python: py.command,
    envDir,
    requirementsPath,
    runner,
    platform,
    fileExists,
  });
  messages.push(...installed.messages);
  if (!installed.ok) {
    return { ok: false, tool: prov.tool, envDir, python: py.version, messages };
  }

  // 5) verify — a pack is only "installed" when its entry actually works.
  const imports = verifyImports({ envDir, modules: verifyModules, runner, platform });
  messages.push(...imports.messages);
  if (!imports.ok) {
    return { ok: false, tool: prov.tool, envDir, python: py.version, messages };
  }

  const entry = verifyEntry({ envDir, entryPath, entryArgs, runner, platform });
  messages.push(...entry.messages);
  if (!entry.ok) {
    return { ok: false, tool: prov.tool, envDir, python: py.version, messages };
  }

  messages.push('Python runtime provisioned and verified.');
  return { ok: true, tool: prov.tool, envDir, python: py.version, messages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** First non-empty diagnostic line from a runner result, for compact messages. */
function firstErrorLine(res) {
  if (!res) return 'no result';
  if (res.error) return res.error;
  const text = `${res.stderr}\n${res.stdout}`
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return text.length > 0 ? text[text.length - 1] : `exit code ${res.status}`;
}

module.exports = {
  MIN_PYTHON,
  // pure
  parsePythonVersion,
  meetsMinVersion,
  pythonCandidates,
  chooseProvisioner,
  venvPython,
  buildEnvCommands,
  missingPythonGuidance,
  // side-effecting (injectable runner)
  defaultRunner,
  detectPython,
  detectProvisioner,
  createEnv,
  installRequirements,
  verifyImports,
  verifyEntry,
  provisionPack,
};
