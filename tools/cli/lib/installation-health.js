/** Read-only by default; optional Python import probes never provision or repair. */
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');
const { DERIVED } = require('./packs');
const { readInstallManifest } = require('./install-manifest');
const {
  inventoryOf,
  collectManagedFiles,
  inspectProjectLock,
  MANIFEST,
  LOCK,
} = require('./update-transaction');
const { fileHash } = require('./pack-copy');
const { contentHash } = require('./installed-adapters');
const {
  safeTarget,
  GENERATED_MARKER,
  USER_CONFIG_MARKER,
} = require('../../build/generate-adapters');

const PACKAGE_ROOT = path.resolve(__dirname, '../../..');

function inspectFile(root, file) {
  try {
    return { state: 'present', bytes: fs.readFileSync(safeTarget(root, file)) };
  } catch (error) {
    return { state: error.code === 'ENOENT' ? 'missing' : 'unreadable' };
  }
}

function collectInstallationHealth({
  projectDir = process.cwd(),
  packageRoot = PACKAGE_ROOT,
  cliVersion = require('../../../package.json').version,
  nodeVersion = process.versions.node,
  verifyPython = false,
  pythonRunner,
} = {}) {
  projectDir = path.resolve(projectDir);
  const report = {
    schemaVersion: 1,
    projectDir,
    status: 'ok',
    versions: { installed: null, cli: cliVersion, published: null },
    inventory: { status: 'unknown', trackedFiles: 0 },
    packs: [],
    integrations: [],
    processExecution: DERIVED.diagnostics.processExecution
      ? {
          ...DERIVED.diagnostics.processExecution,
          availability: 'not-probed',
        }
      : null,
    runtimes: [],
    checks: [],
    summary: { passed: 0, warnings: 0, errors: 0 },
  };
  function check(code, status, message, extra = {}) {
    report.checks.push({ code, status, message, ...extra });
  }
  function finish() {
    for (const entry of report.checks) {
      report.summary[
        entry.status === 'pass' ? 'passed' : entry.status === 'warning' ? 'warnings' : 'errors'
      ]++;
    }
    report.status = report.summary.errors ? 'error' : report.summary.warnings ? 'warning' : 'ok';
    return report;
  }

  const manifestFile = inspectFile(projectDir, MANIFEST);
  if (manifestFile.state !== 'present') {
    check(
      manifestFile.state === 'missing' ? 'installation.missing' : 'manifest.unreadable',
      'error',
      manifestFile.state === 'missing'
        ? 'BMAD+ is not installed in this directory.'
        : 'Installation manifest cannot be read safely.',
      { path: MANIFEST }
    );
    return finish();
  }
  let manifest;
  try {
    manifest = readInstallManifest(safeTarget(projectDir, MANIFEST));
  } catch (error) {
    check('manifest.invalid', 'error', 'Invalid installation manifest: ' + error.message, {
      path: MANIFEST,
    });
    return finish();
  }
  report.versions.installed = manifest.version;
  check('manifest.valid', 'pass', 'Manifest found: v' + manifest.version);
  let lock = null;
  try {
    lock = inspectProjectLock(projectDir);
  } catch (error) {
    check('lock.unreadable', 'warning', 'Project lock cannot be inspected: ' + error.message, {
      path: LOCK,
    });
  }
  if (lock) {
    check(
      lock.stale ? 'lock.stale' : 'lock.active',
      lock.stale ? 'error' : 'warning',
      lock.stale
        ? 'Stale project lock blocks install and update: ' +
            lock.reason +
            ' If no BMAD+ install or update is running, delete ' +
            LOCK +
            ' and retry.'
        : 'An install or update holds the project lock (pid ' +
            (lock.pid ?? 'unknown') +
            ', since ' +
            lock.createdAt +
            ').',
      { path: LOCK }
    );
  }
  check(
    'version.cli',
    manifest.version === cliVersion ? 'pass' : 'warning',
    manifest.version === cliVersion
      ? 'Installed and executing CLI versions match.'
      : 'Version mismatch: installed v' + manifest.version + ', executing CLI v' + cliVersion + '.'
  );

  const selectedPacks = [...new Set(manifest.packs)];
  const validPacks = selectedPacks.filter((id) => Object.hasOwn(DERIVED.packs, id));
  for (const id of selectedPacks) {
    if (!validPacks.includes(id))
      check('pack.unknown', 'error', 'Unknown installed pack: ' + id, { pack: id });
  }
  if (!selectedPacks.includes('core'))
    check('pack.core-missing', 'error', 'The required Core pack is not selected.');

  if (selectedPacks.includes('dev-studio')) {
    try {
      const studio = require('./studio');
      const resolved = studio.validatePack(studio.installedPack(projectDir));
      studio.resolveConfig(projectDir);
      check(
        'studio.resources',
        'pass',
        `Dev Studio: ${resolved.catalog.workflows.length} routes and ${resolved.resources.length} resources resolved; host execution is not verified.`
      );
    } catch (error) {
      check(
        'studio.resources',
        'error',
        'Dev Studio cannot prepare its workflows: ' + error.message,
        { path: '.agents/skills/pack-dev-studio' }
      );
    }
  }

  const inventory = inventoryOf(manifest);
  const validInventory =
    inventory &&
    Object.values(inventory).every((hash) => typeof hash === 'string') &&
    typeof manifest.fileInventory.complete === 'boolean';
  report.inventory.status =
    manifest.fileInventory === undefined
      ? 'legacy'
      : !validInventory
        ? 'invalid'
        : manifest.fileInventory.complete
          ? 'complete'
          : 'incomplete';
  const owned = validInventory ? inventory : {};
  report.inventory.trackedFiles = Object.keys(owned).length;

  const expectedFiles = new Set(['_bmad/module.yaml', '_bmad/module-help.csv']);
  for (const id of validPacks) {
    const pack = DERIVED.packs[id];
    report.packs.push({ id, runtimes: pack.runtimes, requiredResources: pack.requiredResources });
    for (const file of pack.requiredResources) expectedFiles.add(file);
  }
  // Check delivery against the executing package, even if a manifest omits a file.
  try {
    for (const { file } of collectManagedFiles({ projectDir, packageRoot, packs: validPacks }))
      expectedFiles.add(file);
  } catch (error) {
    check('package.unreadable', 'error', 'Cannot inspect the executing package: ' + error.message);
  }
  const resources = new Set([...expectedFiles, ...Object.keys(owned)]);
  for (const file of [...resources].sort()) {
    if (!Object.hasOwn(owned, file) && report.inventory.status === 'complete')
      report.inventory.status = 'incomplete';
    const observed = inspectFile(projectDir, file);
    if (observed.state !== 'present') {
      check(
        'file.' + observed.state,
        'error',
        observed.state === 'missing'
          ? 'Missing required file: ' + file
          : 'File cannot be read safely: ' + file,
        { path: file }
      );
    } else if (Object.hasOwn(owned, file)) {
      const unchanged = fileHash(observed.bytes) === owned[file];
      check(
        unchanged ? 'file.unchanged' : 'file.modified',
        unchanged ? 'pass' : 'warning',
        unchanged
          ? 'Managed file unchanged.'
          : 'Managed file modified locally; review before updating.',
        { path: file }
      );
    } else {
      check('file.unowned', 'warning', 'File present without a recorded ownership hash.', {
        path: file,
      });
    }
  }
  if (manifest.fileInventory?.complete && report.inventory.status === 'incomplete') {
    check(
      'inventory.omissions',
      'warning',
      'Inventory claims completeness but omits expected files.'
    );
  }
  check(
    'inventory.' + report.inventory.status,
    report.inventory.status === 'complete'
      ? 'pass'
      : report.inventory.status === 'invalid'
        ? 'error'
        : 'warning',
    'File ownership inventory: ' + report.inventory.status + '.'
  );
  const config = inspectFile(projectDir, '_bmad/config.yaml');
  check(
    'config.' + config.state,
    config.state === 'present' ? 'pass' : 'error',
    config.state === 'present'
      ? 'Project configuration present.'
      : 'Project configuration missing or unreadable.',
    { path: '_bmad/config.yaml' }
  );

  const contract = DERIVED.diagnostics;
  const declaredTools = Object.keys(contract.integrations);
  let selectedTools = [];
  if (manifest.ides === undefined) {
    selectedTools = declaredTools.filter(
      (tool) =>
        inspectFile(projectDir, contract.integrations[tool].instructionFile).state !== 'missing'
    );
    check(
      'integrations.legacy',
      'warning',
      'IDE selection was not recorded; existing adapter paths were inspected.'
    );
  } else if (
    !Array.isArray(manifest.ides) ||
    manifest.ides.some((id) => typeof id !== 'string' || !declaredTools.includes(id))
  ) {
    check(
      'integrations.invalid',
      'error',
      'Manifest IDE selection contains invalid or unknown targets.'
    );
  } else selectedTools = [...new Set(manifest.ides)];

  const adapterPaths =
    selectedTools.length || manifest.ides === undefined
      ? [
          ...new Set([
            DERIVED.targets.spine,
            ...selectedTools.map((tool) => contract.integrations[tool].instructionFile),
          ]),
        ]
      : [];
  const ownership = new Map();
  const hashes = manifest.adapterHashes;
  const validHashes =
    hashes === undefined ||
    (hashes &&
      typeof hashes === 'object' &&
      !Array.isArray(hashes) &&
      Object.entries(hashes).every(
        ([file, hash]) =>
          [DERIVED.targets.spine, ...DERIVED.targets.adapters.map((entry) => entry.file)].includes(
            file
          ) &&
          typeof hash === 'string' &&
          /^[a-f0-9]{64}$/.test(hash)
      ));
  if (!validHashes) check('adapters.invalid', 'error', 'Adapter ownership hashes are invalid.');
  for (const file of adapterPaths) {
    const observed = inspectFile(projectDir, file);
    let state = observed.state;
    if (state === 'present') {
      const text = observed.bytes.toString('utf8');
      const previous = validHashes && hashes && Object.hasOwn(hashes, file) ? hashes[file] : null;
      state =
        text.includes(GENERATED_MARKER) && !text.includes(USER_CONFIG_MARKER)
          ? 'adopted'
          : !previous || !text.includes(USER_CONFIG_MARKER)
            ? 'unowned'
            : contentHash(text) === previous
              ? 'unchanged'
              : 'modified';
    }
    ownership.set(file, state);
    check(
      'adapter.' + state,
      ['missing', 'unreadable'].includes(state)
        ? 'error'
        : state === 'unchanged'
          ? 'pass'
          : 'warning',
      'Instruction file: ' + state + '.',
      { path: file }
    );
  }
  report.integrations = selectedTools.map((tool) => ({
    tool,
    ...contract.integrations[tool],
    ownership: ownership.get(contract.integrations[tool].instructionFile),
    hostVerified: false,
  }));

  const nodeMinimum = contract.runtimeMinimums.node;
  const nodeReady = Boolean(semver.valid(nodeVersion) && semver.gte(nodeVersion, nodeMinimum));
  report.runtimes.push({
    runtime: 'node',
    minimum: nodeMinimum,
    version: nodeVersion,
    status: nodeReady ? 'verified' : 'unsupported',
  });
  check(
    'runtime.node',
    nodeReady ? 'pass' : 'error',
    'Executing Node.js ' + nodeVersion + '; minimum ' + nodeMinimum + '.'
  );
  for (const id of validPacks.filter((pack) => DERIVED.packs[pack].runtimes.includes('python'))) {
    const requirements = DERIVED.pythonPacks[id].requirements.join('/');
    const delivery = inspectFile(packageRoot, requirements).state;
    const environmentFile = '.bmad/venv/' + id + '/pyvenv.cfg';
    const environment = inspectFile(projectDir, environmentFile).state;
    const runtime = {
      runtime: 'python',
      pack: id,
      minimum: contract.runtimeMinimums.python,
      requirements,
      packageRequirements: delivery,
      environment,
      imports: 'not-verified',
    };
    report.runtimes.push(runtime);
    check(
      'runtime.requirements',
      delivery === 'present' ? 'pass' : 'error',
      delivery === 'present'
        ? 'Python requirements are available in the executing package.'
        : 'Python requirements are missing or unreadable in the executing package.',
      { pack: id, path: requirements, scope: 'package' }
    );
    if (verifyPython) {
      const { probePythonRuntime } = require('./python-health');
      const probe = probePythonRuntime({
        projectDir,
        packId: id,
        minimum: contract.runtimeMinimums.python,
        verifyModules: DERIVED.pythonPacks[id].verifyModules,
        runner: pythonRunner,
      });
      Object.assign(runtime, probe);
      check(
        'runtime.python-probe',
        probe.status === 'verified' ? 'pass' : 'warning',
        probe.message +
          (probe.status === 'verified'
            ? ''
            : ' Use bmad-plus install --provision-python to provision selected Python packs.'),
        {
          pack: id,
          path: environmentFile,
        }
      );
    } else {
      check(
        'runtime.python-unverified',
        'warning',
        'Python environment ' +
          environment +
          '; interpreter version and imports have not been executed. Use doctor --verify-python to probe them.',
        { pack: id, path: environmentFile }
      );
    }
  }
  return finish();
}

module.exports = { collectInstallationHealth };
