const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const http = require('node:http');
const https = require('node:https');
const { collectInstallationHealth } = require('../../tools/cli/lib/installation-health');
const { collectManagedFiles, MANIFEST } = require('../../tools/cli/lib/update-transaction');
const { DERIVED } = require('../../tools/cli/lib/packs');
const { fileHash } = require('../../tools/cli/lib/pack-copy');
const { contentHash } = require('../../tools/cli/lib/installed-adapters');
const {
  generateUserFiles,
  GENERATED_MARKER,
  USER_CONFIG_MARKER,
} = require('../../tools/build/generate-adapters');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const SKILL = '.agents/skills/agent-strategist/SKILL.md';
let temporary, projectDir, manifest;

function write(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function saveManifest() {
  write(projectDir, MANIFEST, JSON.stringify(manifest));
}
function inspect(options = {}) {
  return collectInstallationHealth({ projectDir, ...options });
}
function resultFor(report, code, file) {
  return report.checks.find((check) => check.code === code && (!file || check.path === file));
}
function installFixture({ packs = ['core'], tools = ['claude-code'] } = {}) {
  manifest = {
    version: DERIVED.product.version,
    installed: '2026-09-08T12:00:00Z',
    packs,
    ides: tools,
    user: 'Fixture',
    language: 'en',
    adapterHashes: {},
    fileInventory: { schemaVersion: 1, complete: true, files: {} },
  };
  for (const { file, content } of collectManagedFiles({ projectDir, packs })) {
    write(projectDir, file, content);
    manifest.fileInventory.files[file] = fileHash(content);
  }
  if (tools.length) {
    for (const { file, content } of generateUserFiles(DERIVED, {
      packs,
      tools,
      userName: 'Fixture',
      language: 'en',
    })) {
      write(projectDir, file, content);
      manifest.adapterHashes[file] = contentHash(content);
    }
  }
  write(projectDir, '_bmad/config.yaml', 'user_name: Fixture\n');
  saveManifest();
}

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bmad-health-'));
  projectDir = path.join(temporary, 'project');
  installFixture();
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(temporary, { recursive: true, force: true });
});

test('healthy Core installation reports verified ownership and host capabilities remain unverified', () => {
  const report = inspect();
  expect(report).toMatchObject({
    schemaVersion: 1,
    status: 'ok',
    versions: { installed: DERIVED.product.version, published: null },
    inventory: {
      status: 'complete',
      trackedFiles: Object.keys(manifest.fileInventory.files).length,
    },
    summary: { errors: 0, warnings: 0 },
  });
  expect(report.integrations).toEqual([
    {
      tool: 'claude-code',
      instructionFile: 'CLAUDE.md',
      execution: 'host-managed',
      lifecycleEvents: 'not-integrated',
      ownership: 'unchanged',
      hostVerified: false,
    },
  ]);
  expect(resultFor(report, 'file.unchanged', SKILL)).toBeDefined();
});

test('reports an active lock as a warning and a stale lock as an error with its remedy', () => {
  write(
    projectDir,
    '.bmad/update.lock',
    JSON.stringify({
      id: 'x',
      pid: process.pid,
      hostname: os.hostname(),
      createdAt: new Date().toISOString(),
    })
  );
  expect(resultFor(inspect(), 'lock.active').status).toBe('warning');
  write(
    projectDir,
    '.bmad/update.lock',
    JSON.stringify({
      id: 'x',
      pid: 42,
      hostname: 'another-host',
      createdAt: '2020-01-01T00:00:00Z',
    })
  );
  const stale = resultFor(inspect(), 'lock.stale');
  expect(stale.status).toBe('error');
  expect(stale.message).toMatch(/delete \.bmad\/update\.lock and retry/);
});

test('distinguishes the executing CLI version from an unknown published version', () => {
  const report = inspect({ cliVersion: '99.0.0' });
  expect(report.versions).toEqual({
    installed: DERIVED.product.version,
    cli: '99.0.0',
    published: null,
  });
  expect(resultFor(report, 'version.cli').status).toBe('warning');
});

test.each(['18.0.0', 'invalid'])('rejects unsupported Node evidence %s', (nodeVersion) => {
  expect(resultFor(inspect({ nodeVersion }), 'runtime.node').status).toBe('error');
});

test.each(['modified', 'missing', 'unreadable'])('reports a managed file as %s', (state) => {
  const target = path.join(projectDir, SKILL);
  if (state === 'modified') fs.appendFileSync(target, '\nLocal instructions.');
  else {
    fs.unlinkSync(target);
    if (state === 'unreadable') fs.mkdirSync(target);
  }
  const report = inspect();
  expect(resultFor(report, 'file.' + state, SKILL).status).toBe(
    state === 'modified' ? 'warning' : 'error'
  );
  expect(report.status).toBe(state === 'modified' ? 'warning' : 'error');
});

test('legacy inventory leaves present files unowned without inventing hash evidence', () => {
  delete manifest.fileInventory;
  saveManifest();
  const report = inspect();
  expect(report.inventory).toEqual({ status: 'legacy', trackedFiles: 0 });
  expect(resultFor(report, 'file.unowned', SKILL).status).toBe('warning');
  expect(report.summary.errors).toBe(0);
});

test.each([
  [
    'null inventory',
    () => {
      manifest.fileInventory = null;
    },
  ],
  [
    'array of files',
    () => {
      manifest.fileInventory.files = [];
    },
  ],
  [
    'array hash',
    () => {
      manifest.fileInventory.files[SKILL] = [manifest.fileInventory.files[SKILL]];
    },
  ],
  [
    'short hash',
    () => {
      manifest.fileInventory.files[SKILL] = '0123';
    },
  ],
  [
    'nonboolean completeness',
    () => {
      manifest.fileInventory.complete = 'yes';
    },
  ],
  [
    'unsupported schema',
    () => {
      manifest.fileInventory.schemaVersion = 2;
    },
  ],
  [
    'traversal',
    () => {
      manifest.fileInventory.files['.agents/skills/../../../outside.md'] = 'a'.repeat(64);
    },
  ],
  [
    'foreign path',
    () => {
      manifest.fileInventory.files['private.md'] = 'a'.repeat(64);
    },
  ],
])('rejects invalid inventory metadata: %s', (_name, mutate) => {
  mutate();
  saveManifest();
  const report = inspect();
  expect(report.inventory).toEqual({ status: 'invalid', trackedFiles: 0 });
  expect(resultFor(report, 'inventory.invalid').status).toBe('error');
  expect(report.checks.some((check) => check.path?.includes('../'))).toBe(false);
});

test.each([true, false])(
  'detects an omitted expected hash when the target exists=%s',
  (present) => {
    delete manifest.fileInventory.files[SKILL];
    if (!present) fs.unlinkSync(path.join(projectDir, SKILL));
    saveManifest();
    const report = inspect();
    expect(report.inventory.status).toBe('incomplete');
    expect(resultFor(report, 'inventory.omissions')).toBeDefined();
    expect(resultFor(report, present ? 'file.unowned' : 'file.missing', SKILL)).toBeDefined();
  }
);

test('does not require adapters when the installer explicitly selected no tools', () => {
  fs.unlinkSync(path.join(projectDir, 'CLAUDE.md'));
  fs.unlinkSync(path.join(projectDir, 'AGENTS.md'));
  manifest.ides = [];
  manifest.adapterHashes = {};
  saveManifest();
  const report = inspect();
  expect(report.integrations).toEqual([]);
  expect(report.summary.errors).toBe(0);
});

test('normalizes adapter line endings without changing managed-file byte hashing', () => {
  const file = path.join(projectDir, 'CLAUDE.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
  expect(resultFor(inspect(), 'adapter.unchanged', 'CLAUDE.md')).toBeDefined();
});

test.each(['adopted', 'modified', 'unowned', 'missing'])(
  'reports adapter ownership as %s',
  (state) => {
    const target = path.join(projectDir, 'CLAUDE.md');
    if (state === 'adopted')
      write(projectDir, 'CLAUDE.md', GENERATED_MARKER + '\nProject instructions');
    else if (state === 'modified') fs.appendFileSync(target, '\nCustom additions');
    else if (state === 'unowned')
      write(projectDir, 'CLAUDE.md', 'Custom instructions without an ownership marker');
    else fs.unlinkSync(target);
    const report = inspect();
    expect(resultFor(report, 'adapter.' + state, 'CLAUDE.md')).toBeDefined();
    expect(report.integrations[0].ownership).toBe(state);
  }
);

test.each([[], { 'CLAUDE.md': ['a'.repeat(64)] }, { '../outside.md': 'a'.repeat(64) }])(
  'rejects malformed adapter ownership %p',
  (hashes) => {
    manifest.adapterHashes = hashes;
    saveManifest();
    expect(resultFor(inspect(), 'adapters.invalid').status).toBe('error');
  }
);

test('does not treat a matching hash without the installed marker as ownership', () => {
  const content = GENERATED_MARKER + '\nAdopted project';
  expect(content).not.toContain(USER_CONFIG_MARKER);
  write(projectDir, 'CLAUDE.md', content);
  manifest.adapterHashes['CLAUDE.md'] = contentHash(content);
  saveManifest();
  expect(resultFor(inspect(), 'adapter.adopted', 'CLAUDE.md')).toBeDefined();
});

test.each(['.agents/skills/agent-strategist', '.cursor'])(
  'does not follow a junction at %s',
  (linked) => {
    const outside = path.join(temporary, 'outside');
    const target = path.join(projectDir, linked);
    fs.mkdirSync(outside);
    if (fs.existsSync(target)) fs.renameSync(target, path.join(outside, 'original'));
    write(outside, 'SKILL.md', 'External private instructions');
    write(outside, 'rules/bmad-plus.mdc', 'External adapter');
    if (linked === '.cursor') {
      manifest.ides = ['cursor'];
      saveManifest();
    }
    fs.symlinkSync(outside, target, 'junction');
    const before = fs.readFileSync(path.join(outside, 'SKILL.md'));
    const file = linked === '.cursor' ? '.cursor/rules/bmad-plus.mdc' : SKILL;
    expect(
      resultFor(inspect(), linked === '.cursor' ? 'adapter.unreadable' : 'file.unreadable', file)
    ).toBeDefined();
    expect(fs.readFileSync(path.join(outside, 'SKILL.md'))).toEqual(before);
  }
);

test('reports source Python requirements without executing an interpreter or claiming imports work', () => {
  installFixture({ packs: ['core', 'seo'] });
  write(projectDir, '.bmad/venv/seo/pyvenv.cfg', 'version = 3.12.0\n');
  const report = inspect();
  expect(report.runtimes.find((entry) => entry.pack === 'seo')).toMatchObject({
    runtime: 'python',
    packageRequirements: 'present',
    environment: 'present',
    imports: 'not-verified',
  });
  expect(resultFor(report, 'runtime.python-unverified').status).toBe('warning');
  expect(report.summary.errors).toBe(0);
});

test('reports missing Python requirements in an incomplete package', () => {
  installFixture({ packs: ['core', 'seo'] });
  const packageRoot = path.join(temporary, 'npm-package');
  for (const file of ['module.yaml', 'module-help.csv']) {
    write(
      packageRoot,
      'src/bmad-plus/' + file,
      fs.readFileSync(path.join(PACKAGE_ROOT, 'src/bmad-plus', file))
    );
  }
  const report = inspect({ packageRoot });
  expect(
    resultFor(report, 'runtime.requirements', 'src/bmad-plus/packs/pack-seo/requirements.txt')
  ).toMatchObject({
    status: 'error',
    pack: 'seo',
    scope: 'package',
  });
  expect(report.runtimes.find((entry) => entry.pack === 'seo').packageRequirements).toBe('missing');
});

test('opt-in Python verification reports a missing environment as a warning without claiming imports', () => {
  installFixture({ packs: ['core', 'seo'] });
  const pythonRunner = jest.fn(() => {
    throw new Error('Must not run without an environment');
  });
  const report = inspect({ verifyPython: true, pythonRunner });
  expect(pythonRunner).not.toHaveBeenCalled();
  expect(report.runtimes.find((entry) => entry.pack === 'seo')).toMatchObject({
    status: 'missing',
    imports: 'not-verified',
  });
  expect(resultFor(report, 'runtime.python-probe')).toMatchObject({ status: 'warning' });
  expect(resultFor(report, 'runtime.python-probe').message).toContain('--provision-python');
  expect(report.summary.errors).toBe(0);
});

test('validates the installed Dev Studio graph and exposes a deleted UX resource', () => {
  installFixture({ packs: ['core', 'dev-studio'] });
  expect(inspect().summary.errors).toBe(0);
  expect(resultFor(inspect(), 'studio.resources').status).toBe('pass');
  fs.unlinkSync(
    path.join(
      projectDir,
      '.agents/skills/pack-dev-studio/categories/planning/steps/step-01-init.md'
    )
  );
  const report = inspect();
  expect(resultFor(report, 'studio.resources').status).toBe('error');
  expect(
    resultFor(
      report,
      'file.missing',
      '.agents/skills/pack-dev-studio/categories/planning/steps/step-01-init.md'
    )
  ).toBeDefined();
});

test('returns pure serializable evidence without writes, processes, network requests or terminal output', () => {
  const blocked = () => {
    throw new Error('Unexpected diagnostic side effect');
  };
  const spies = [
    ...['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync'].map(
      (key) => jest.spyOn(fs, key).mockImplementation(blocked)
    ),
    ...['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync'].map((key) =>
      jest.spyOn(childProcess, key).mockImplementation(blocked)
    ),
    jest.spyOn(http, 'request').mockImplementation(blocked),
    jest.spyOn(https, 'request').mockImplementation(blocked),
    jest.spyOn(global, 'fetch').mockImplementation(blocked),
    jest.spyOn(process, 'exit').mockImplementation(blocked),
    jest.spyOn(console, 'log').mockImplementation(blocked),
  ];
  const report = inspect();
  expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  expect(report.summary.errors).toBe(0);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

test.each(['missing', 'invalid'])('reports an installation manifest that is %s', (state) => {
  if (state === 'missing') fs.unlinkSync(path.join(projectDir, MANIFEST));
  else write(projectDir, MANIFEST, '{bad json');
  expect(
    resultFor(inspect(), state === 'missing' ? 'installation.missing' : 'manifest.invalid').status
  ).toBe('error');
});

test.each([false, true])(
  'doctor emits only JSON with an evidence-based exit code when broken=%s',
  async (broken) => {
    if (broken) fs.unlinkSync(path.join(projectDir, SKILL));
    const clack = require('@clack/prompts');
    const doctor = require('../../tools/cli/commands/doctor');
    const previousExitCode = process.exitCode;
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    const presentation = ['intro', 'note', 'outro'].map((key) =>
      jest.spyOn(clack, key).mockImplementation(() => {})
    );
    try {
      await doctor.action({ directory: projectDir, json: true });
      expect(output).toHaveBeenCalledTimes(1);
      expect(JSON.parse(output.mock.calls[0][0])).toEqual(inspect());
      expect(process.exitCode).toBe(broken ? 1 : 0);
      for (const spy of presentation) expect(spy).not.toHaveBeenCalled();
    } finally {
      process.exitCode = previousExitCode;
    }
  }
);
