#!/usr/bin/env node
/**
 * Verify that real source and npm-package installs deliver the adapter contract.
 * Uses existing dependencies, temporary projects and an isolated brain; no
 * lifecycle scripts, dependency installation or Python provisioning are run.
 *
 * Run: node tools/build/check-install-contract.js
 * Author: Laurent Rochetta
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEMP_PREFIX = 'bmad-install-contract-';

function resolveWithin(root, relative) {
  assert(typeof relative === 'string' && relative.length > 0, 'Expected a relative file path');
  assert(
    !path.win32.isAbsolute(relative) && !path.posix.isAbsolute(relative),
    `Absolute path: ${relative}`
  );
  const target = path.resolve(root, relative);
  const fromRoot = path.relative(root, target);
  assert(
    fromRoot &&
      !path.isAbsolute(fromRoot) &&
      !fromRoot.startsWith(`..${path.sep}`) &&
      fromRoot !== '..',
    `Path escapes project: ${relative}`
  );
  return target;
}

function sameSelection(actual, expected, label) {
  assert(Array.isArray(actual), `Manifest ${label} must be an array`);
  assert.deepEqual(
    [...actual].sort(),
    [...expected].sort(),
    `Manifest ${label} differs from requested selection`
  );
}

/** Compare the installed bytes, normalizing only Windows/Unix line endings. */
function verifyInstallation(
  projectDir,
  { packs, tools, derived, ideConfigs, renderFiles, requireInventory = false }
) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(projectDir, '_bmad', '.bmad-plus-install.json'), 'utf8')
  );
  sameSelection(manifest.packs, packs, 'packs');
  sameSelection(manifest.ides, tools, 'ides');
  assert(typeof manifest.user === 'string' && manifest.user, 'Manifest user is missing');
  assert(
    typeof manifest.language === 'string' && manifest.language,
    'Manifest language is missing'
  );

  const files = renderFiles(derived, {
    packs,
    userName: manifest.user,
    language: manifest.language,
    tools: manifest.ides,
  });
  const expectedPaths = new Set(files.map(({ file }) => file));
  assert.equal(expectedPaths.size, files.length, 'Renderer returned duplicate output paths');
  assert.equal(
    derived.targets.spine,
    'AGENTS.md',
    'Install contract requires the root AGENTS.md spine'
  );
  assert(
    expectedPaths.has(derived.targets.spine),
    'Renderer must include the root AGENTS.md spine'
  );
  for (const tool of tools) {
    assert(expectedPaths.has(ideConfigs[tool].configFile), `Renderer omitted the ${tool} adapter`);
  }

  for (const { file, content } of files) {
    const target = resolveWithin(projectDir, file);
    assert(fs.existsSync(target), `Missing installed file: ${file}`);
    const actual = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    const expected = content.replace(/\r\n/g, '\n');
    assert(actual === expected, `Installed adapter differs from renderer: ${file}`);
  }
  for (const { configFile } of Object.values(ideConfigs)) {
    assert(
      expectedPaths.has(configFile) || !fs.existsSync(resolveWithin(projectDir, configFile)),
      `Unselected adapter was installed: ${configFile}`
    );
  }
  if (requireInventory) {
    assert.equal(manifest.fileInventory?.schemaVersion, 1, 'Missing file inventory');
    const { collectManagedFiles } = require('../cli/lib/update-transaction');
    const managedFiles = collectManagedFiles({ projectDir, packs });
    assert.deepEqual(
      Object.keys(manifest.fileInventory.files).sort(),
      managedFiles.map((entry) => entry.file).sort(),
      'Inventory does not cover exactly the selected framework files'
    );
    for (const { file } of managedFiles) {
      const actualHash = crypto
        .createHash('sha256')
        .update(fs.readFileSync(resolveWithin(projectDir, file)))
        .digest('hex');
      assert.equal(
        manifest.fileInventory.files[file],
        actualHash,
        `Inventory differs from installed bytes: ${file}`
      );
    }
  }
  return files.length;
}

function verifyDiagnostics(report, { packs, tools, derived }) {
  assert.equal(report.schemaVersion, 1, 'Unsupported diagnostic report');
  assert.equal(report.versions.installed, derived.product.version);
  assert.equal(report.versions.cli, derived.product.version);
  assert.equal(report.versions.published, null, 'Doctor must not invent npm freshness evidence');
  sameSelection(
    report.packs.map(({ id }) => id),
    packs,
    'diagnostic packs'
  );
  sameSelection(
    report.integrations.map(({ tool }) => tool),
    tools,
    'diagnostic integrations'
  );
  for (const integration of report.integrations) {
    assert.deepEqual(
      integration,
      {
        tool: integration.tool,
        ...derived.diagnostics.integrations[integration.tool],
        ownership: 'unchanged',
        hostVerified: false,
      },
      'An installed adapter must not imply verified host execution'
    );
  }
  const expectedErrors = [];
  assert.deepEqual(
    report.checks
      .filter(({ status }) => status === 'error')
      .map(({ code, path: file }) => `${code}:${file}`)
      .sort(),
    expectedErrors.sort(),
    'Every advertised pack must install without delivery errors'
  );
  assert.equal(report.summary.errors, expectedErrors.length);
  assert.equal(report.inventory.status, 'complete');
  assert(report.inventory.trackedFiles > 0, 'Doctor did not inspect the ownership inventory');
  assert.equal(
    report.checks.filter(({ code }) => code === 'file.unchanged').length,
    report.inventory.trackedFiles,
    'Every freshly installed managed file must have matching ownership'
  );
  assert(!report.checks.some(({ code }) => ['file.modified', 'file.unowned'].includes(code)));
  for (const runtime of report.runtimes.filter(({ runtime }) => runtime === 'python')) {
    assert.equal(
      runtime.imports,
      'not-verified',
      'Presence of requirements cannot prove Python imports'
    );
    assert.equal(runtime.environment, 'missing', 'Contract checks must not provision Python');
  }
  const expectedStatus = expectedErrors.length
    ? 'error'
    : report.summary.warnings
      ? 'warning'
      : 'ok';
  assert.equal(report.status, expectedStatus);
}

function run(command, args, { cwd, env, timeout = 60000, expectedExitCode = 0 }) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    timeout,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== expectedExitCode) {
    const reason = result.error
      ? result.error.message
      : `exit ${result.status}, signal ${result.signal || 'none'}`;
    throw new Error(
      `${path.basename(command)} ${args.join(' ')}: ${reason}\n${result.stdout || ''}${result.stderr || ''}`
    );
  }
  return result.stdout;
}

/** Invoke npm without a shell, including Windows where npm.cmd is not executable. */
function npmCommand(env) {
  const candidates = [
    env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ...(env.PATH || env.Path || '')
      .split(path.delimiter)
      .map((dir) => path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js')),
  ];
  const cli = candidates.find(
    (candidate) => candidate && /npm-cli\.js$/i.test(candidate) && fs.existsSync(candidate)
  );
  if (cli) return { command: process.execPath, args: [cli] };
  assert(process.platform !== 'win32', 'Could not locate npm-cli.js beside Node or on PATH');
  return { command: 'npm', args: [] };
}

function packAndExtract(tempRoot, env) {
  const destination = path.join(tempRoot, 'distribution');
  fs.mkdirSync(destination);
  const npm = npmCommand(env);
  const output = run(
    npm.command,
    [
      ...npm.args,
      'pack',
      '--ignore-scripts',
      '--offline',
      '--json',
      '--pack-destination',
      destination,
      '--cache',
      path.join(tempRoot, 'npm-cache'),
    ],
    { cwd: REPO_ROOT, env, timeout: 120000 }
  );
  // npm 11 reports a list, npm 12 an object keyed by package name.
  const reported = JSON.parse(output);
  const packed = Array.isArray(reported) ? reported : Object.values(reported);
  assert(
    packed.length === 1 && typeof packed[0]?.filename === 'string',
    'npm pack must produce exactly one package'
  );
  const archive = resolveWithin(destination, packed[0].filename);
  // The archive already sits in cwd, and it is named relatively on purpose: GNU tar
  // reads a Windows "C:\..." argument as a remote host and refuses to open it.
  const archiveName = path.basename(archive);
  const entries = run('tar', ['-tzf', archiveName], { cwd: destination, env })
    .trim()
    .split(/\r?\n/);
  for (const entry of entries) {
    assert(entry.startsWith('package/'), `Unexpected npm archive entry: ${entry}`);
    resolveWithin(destination, entry);
  }
  run('tar', ['-xzf', archiveName, '-C', '.'], { cwd: destination, env });
  const packageRoot = path.join(destination, 'package');
  assert(
    !fs.existsSync(path.join(packageRoot, 'registry.yaml')),
    'npm contract must work without registry.yaml'
  );
  assert(fs.statSync(packageRoot).isDirectory(), 'npm package directory is missing');
  for (const file of ['LICENSE', 'THIRD-PARTY-LICENSES.md', 'SECURITY.md']) {
    assert(fs.statSync(path.join(packageRoot, file)).isFile(), `npm archive is missing ${file}`);
  }
  assert(
    !fs.existsSync(path.join(packageRoot, 'src/bmad-plus/packs/pack-seo/scripts/__pycache__')),
    'npm archive must exclude local Python caches'
  );
  return packageRoot;
}

function verifyNexusConsumer(packageRoot, projectDir, env) {
  const invoke = (args) =>
    JSON.parse(
      run(
        process.execPath,
        [
          path.join(packageRoot, 'tools/cli/bmad-plus-cli.js'),
          'nexus',
          ...args,
          '--directory',
          projectDir,
          '--json',
        ],
        { cwd: projectDir, env }
      )
    );
  const input = (name, value) => {
    const file = path.join(projectDir, name);
    fs.writeFileSync(file, JSON.stringify(value));
    return file;
  };
  const instruction = '.agents/skills/agent-orchestrator/SKILL.md';
  assert(
    fs
      .readFileSync(path.join(projectDir, instruction), 'utf8')
      .includes('Durable host-managed attempts')
  );
  fs.mkdirSync(path.join(projectDir, 'checks'));
  fs.mkdirSync(path.join(projectDir, 'result'));
  fs.writeFileSync(
    path.join(projectDir, 'checks/accepted.cjs'),
    "const fs=require('node:fs');const assert=require('node:assert/strict');assert.equal(fs.readFileSync('result/value.txt','utf8'),'accepted');\n"
  );
  const plan = input('nexus-plan.json', {
    id: 'consumer',
    tasks: [
      {
        id: 'work',
        objective: 'Verify a real relocated npm/source consumer',
        scope: ['result'],
        artifacts: ['result/value.txt'],
        resources: [instruction, 'checks/accepted.cjs'],
        checks: [{ id: 'actual-output', command: 'node', args: ['checks/accepted.cjs'] }],
      },
    ],
  });
  invoke(['create', '--plan', plan]);
  const backend = { kind: 'host', id: 'consumer-check', sessionId: 'observed-attempt' };
  const started = invoke([
    'start',
    'consumer',
    'work',
    '--input',
    input('nexus-host.json', { backend }),
  ]);
  const attemptId = started.tasks[0].attempts[0].id;
  fs.writeFileSync(path.join(projectDir, 'result/value.txt'), 'accepted');
  // A separate CLI process reconciles an interrupted host without repeating its work.
  invoke([
    'reconcile',
    'consumer',
    'work',
    '--input',
    input('nexus-observation.json', {
      attemptId,
      backend,
      ownerStopped: true,
      outcome: 'completed',
      summary: 'Test host stopped after writing its artifact; independent checker follows.',
    }),
  ]);
  const checked = invoke(['verify', 'consumer', 'work']);
  assert.equal(checked.tasks[0].attempts[0].verification.status, 'passed');
  const accepted = invoke(['accept', 'consumer', 'work']);
  assert.equal(accepted.tasks[0].integration, 'accepted');
  assert.equal(accepted.tasks[0].integrationReceipt.gitOperation, null);
  const observed = invoke(['inspect', 'consumer']);
  assert.equal(observed.observations[0].evidenceEligible, true);
  assert.equal(observed.observations[0].stale, false);

  fs.mkdirSync(path.join(projectDir, 'processed'));
  fs.writeFileSync(path.join(projectDir, 'checks/task.txt'), 'Write the supervised result.\n');
  fs.writeFileSync(
    path.join(projectDir, 'checks/worker.cjs'),
    "require('node:fs').writeFileSync('processed/value.txt','supervised');\n"
  );
  fs.writeFileSync(
    path.join(projectDir, 'checks/process.cjs'),
    "require('node:assert/strict').equal(require('node:fs').readFileSync('processed/value.txt','utf8'),'supervised');\n"
  );
  invoke([
    'create',
    '--plan',
    input('process-plan.json', {
      id: 'process-consumer',
      tasks: [
        {
          id: 'work',
          objective: 'Verify the packaged foreground process backend',
          scope: ['processed'],
          artifacts: ['processed/value.txt'],
          resources: [instruction, 'checks/process.cjs'],
          checks: [{ id: 'process-output', command: 'node', args: ['checks/process.cjs'] }],
          execution: {
            adapter: 'command',
            command: 'node',
            args: ['checks/worker.cjs'],
            resources: ['checks/worker.cjs'],
            input: 'checks/task.txt',
          },
        },
      ],
    }),
  ]);
  const launched = invoke(['launch', 'process-consumer', 'work']);
  const processAttempt = launched.tasks[0].attempts[0];
  assert.equal(processAttempt.process.receipt.outcome, 'completed');
  invoke([
    'collect',
    'process-consumer',
    'work',
    '--input',
    input('collect.json', {
      attemptId: processAttempt.id,
      backend: processAttempt.backend,
    }),
  ]);
  assert.equal(
    invoke(['verify', 'process-consumer', 'work']).tasks[0].attempts[0].verification.status,
    'passed'
  );
  assert.equal(invoke(['accept', 'process-consumer', 'work']).tasks[0].integration, 'accepted');

  const mem = (args) =>
    JSON.parse(
      run(
        process.execPath,
        [
          path.join(packageRoot, 'tools/cli/bmad-plus-cli.js'),
          'mem',
          ...args,
          '--directory',
          projectDir,
          '--json',
        ],
        { cwd: projectDir, env }
      )
    );
  const memoryFile = '.agents/memory/patterns.md';
  fs.mkdirSync(path.dirname(path.join(projectDir, memoryFile)), { recursive: true });
  fs.appendFileSync(
    path.join(projectDir, memoryFile),
    '\n### Consumer supervision evidence\nVerify the supervised artifact before accepting process work.\n'
  );
  input('memory-observation.json', {
    runId: 'process-consumer',
    taskId: 'work',
    memory: { file: memoryFile, heading: 'Consumer supervision evidence' },
    scope: ['processed'],
    interpretation:
      'Consumer fixture links this note to the accepted result; causality is unmeasured.',
  });
  mem(['observe', '--input', 'memory-observation.json']);
  const recall = () =>
    mem([
      'recall',
      'Consumer supervision evidence',
      '--ranking',
      'evidence',
      '--context-scope',
      'processed',
    ]);
  assert(recall().results.some((entry) => entry.ref === 'Consumer supervision evidence'));
  fs.writeFileSync(path.join(projectDir, 'processed/value.txt'), 'changed after acceptance');
  assert(
    !recall().results.some((entry) => entry.ref === 'Consumer supervision evidence'),
    'Packaged memory must reject evidence after its accepted artifact changes'
  );
}

function runMatrix(packageRoot, variant, tempRoot, env, reference) {
  const allPacks = Object.keys(reference.packDefinitions).filter(
    (id) => !reference.packDefinitions[id].disabled
  );
  const allTools = Object.keys(reference.ideConfigs);
  assert(allTools.length > 0, 'IDE_CONFIGS must expose at least one target');
  const selections = [
    { argument: 'core', packs: ['core'] },
    { argument: 'core,osint', packs: ['core', 'osint'] },
    { argument: 'core,memory', packs: ['core', 'memory'] },
    { argument: 'all', packs: allPacks },
  ];
  const toolSelections = [...allTools.map((tool) => [tool]), allTools];
  let installations = 0;
  let files = 0;
  for (const selection of selections) {
    for (const tools of toolSelections) {
      const label = `${variant}/${selection.argument}/${tools.join(',')}`;
      const projectDir = path.join(tempRoot, `${variant}-project-${++installations}`);
      fs.mkdirSync(projectDir);
      try {
        run(
          process.execPath,
          [
            path.join(packageRoot, 'tools', 'cli', 'bmad-plus-cli.js'),
            'install',
            '--yes',
            '--lang',
            'en',
            '--directory',
            projectDir,
            '--packs',
            selection.argument,
            '--tools',
            tools.join(','),
          ],
          { cwd: projectDir, env }
        );
        files += verifyInstallation(projectDir, { ...reference, packs: selection.packs, tools });
        const expectedExitCode = 0;
        const diagnosis = run(
          process.execPath,
          [
            path.join(packageRoot, 'tools', 'cli', 'bmad-plus-cli.js'),
            'doctor',
            '--json',
            '--directory',
            projectDir,
          ],
          { cwd: projectDir, env, expectedExitCode }
        );
        verifyDiagnostics(JSON.parse(diagnosis), {
          packs: selection.packs,
          tools,
          derived: reference.derived,
          variant,
        });
        if (installations === 1) verifyNexusConsumer(packageRoot, projectDir, env);
        if (selection.packs.includes('dev-studio')) {
          const list = JSON.parse(
            run(
              process.execPath,
              [
                path.join(packageRoot, 'tools/cli/bmad-plus-cli.js'),
                'studio',
                'list',
                '--directory',
                projectDir,
                '--json',
              ],
              { cwd: projectDir, env }
            )
          );
          assert.equal(list.workflows.length, reference.derived.packs['dev-studio'].workflowCount);
          const prepared = JSON.parse(
            run(
              process.execPath,
              [
                path.join(packageRoot, 'tools/cli/bmad-plus-cli.js'),
                'studio',
                'prepare',
                'create-ux-design',
                '--request',
                'Design the sign-in flow',
                '--directory',
                projectDir,
                '--json',
              ],
              { cwd: projectDir, env }
            )
          );
          assert.equal(prepared.status, 'ready');
          assert.equal(prepared.executed, false);
          assert(prepared.instructions.some((item) => item.path.endsWith('/create-ux-design.md')));
          assert(!fs.existsSync(path.join(projectDir, prepared.outputPath)));
        }
        if (tools.length === allTools.length) {
          const output = run(
            process.execPath,
            [
              path.join(packageRoot, 'tools', 'cli', 'bmad-plus-cli.js'),
              'update-check',
              '--offline',
              '--json',
              '--directory',
              projectDir,
            ],
            { cwd: projectDir, env }
          );
          const checked = JSON.parse(output);
          assert.equal(
            checked.status,
            'unknown',
            'Offline check must not claim the latest release'
          );
          assert.equal(checked.updateAvailable, null);
          assert.equal(checked.canAutoApply, false);
        }
      } catch (error) {
        throw new Error(`${label}: ${error.message}`, { cause: error });
      }
    }
    console.log(
      `OK ${variant}: ${selection.argument} across ${toolSelections.length} tool selections`
    );
  }
  return { installations, files };
}

function main() {
  const { PACKS, DERIVED } = require('../cli/lib/packs');
  const { IDE_CONFIGS } = require('../cli/lib/ide-config');
  const { generateUserFiles } = require('./generate-adapters');
  assert(
    DERIVED && typeof generateUserFiles === 'function',
    'Generated install contract exports are missing'
  );
  const reference = {
    packDefinitions: PACKS,
    derived: DERIVED,
    ideConfigs: IDE_CONFIGS,
    renderFiles: generateUserFiles,
    requireInventory: true,
  };
  const tempParent = fs.realpathSync(os.tmpdir());
  const tempRoot = fs.mkdtempSync(path.join(tempParent, TEMP_PREFIX));
  try {
    const brain = path.join(tempRoot, 'brain');
    fs.mkdirSync(brain);
    const env = {
      ...process.env,
      BMAD_PLUS_BRAIN: brain,
      NODE_PATH: path.join(REPO_ROOT, 'node_modules'),
      NO_COLOR: '1',
      NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    };
    const source = runMatrix(REPO_ROOT, 'source', tempRoot, env, reference);
    const packageRoot = packAndExtract(tempRoot, env);
    const { checkPythonDelivery } = require('./pack-delivery');
    const { loadRegistry } = require('./generate');
    assert.deepEqual(
      checkPythonDelivery(loadRegistry(), {
        packageRoot,
        packageJson: JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')),
      }),
      [],
      'Declared Python resources must exist in the real npm archive'
    );
    const packaged = runMatrix(packageRoot, 'npm', tempRoot, env, reference);
    console.log(
      `Install contract passed: ${source.installations + packaged.installations} installs and doctor JSON reports, ${source.files + packaged.files} files compared (source + npm without registry.yaml).`
    );
    return 0;
  } finally {
    // Delete only this mkdtemp-owned direct child of the verified temp directory.
    assert(
      path.dirname(tempRoot) === tempParent && path.basename(tempRoot).startsWith(TEMP_PREFIX)
    );
    assert(fs.realpathSync(tempRoot) === tempRoot && !fs.lstatSync(tempRoot).isSymbolicLink());
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Install contract failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, resolveWithin, verifyInstallation };
