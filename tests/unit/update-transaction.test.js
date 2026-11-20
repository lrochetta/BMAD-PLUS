const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  planUpdate,
  applyPlan,
  restoreUpdate,
  acquireProjectLock,
  inspectProjectLock,
  evaluateUpdateReadiness,
  inventoryOf,
  MANIFEST,
  LOCK,
} = require('../../tools/cli/lib/update-transaction');
const { fileHash } = require('../../tools/cli/lib/pack-copy');
const { generateUserFiles } = require('../../tools/build/generate-adapters');
const { DERIVED } = require('../../tools/cli/lib/packs');
const { contentHash } = require('../../tools/cli/lib/installed-adapters');

let temporary, projectDir, packageRoot, manifest;
const SKILL = '.agents/skills/agent-strategist/SKILL.md';
function write(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function read(file) {
  return fs.readFileSync(path.join(projectDir, file), 'utf8');
}
function saveManifest() {
  write(projectDir, MANIFEST, JSON.stringify(manifest));
}
function plan(options = {}) {
  return planUpdate({ projectDir, packageRoot, version: '0.12.3', ...options });
}
function receipt(result) {
  return JSON.parse(fs.readFileSync(result.receiptPath, 'utf8'));
}

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-transaction-'));
  projectDir = path.join(temporary, 'project');
  packageRoot = path.join(temporary, 'package');
  manifest = {
    version: '0.12.2',
    installed: '2026-01-01T00:00:00Z',
    packs: ['core'],
    ides: [],
    executionMode: 'hybrid',
    fileInventory: { schemaVersion: 1, complete: true, files: {} },
  };
  for (const [file, source] of [
    [SKILL, 'agents/agent-strategist/SKILL.md'],
    ['_bmad/module.yaml', 'module.yaml'],
    ['_bmad/module-help.csv', 'module-help.csv'],
  ]) {
    const old = 'old ' + file;
    write(projectDir, file, old);
    write(packageRoot, 'src/bmad-plus/' + source, 'new ' + file);
    manifest.fileInventory.files[file] = fileHash(Buffer.from(old));
  }
  write(projectDir, '.agents/memory/decisions.md', 'Keep all memory');
  write(projectDir, '.agents/skills/agent-strategist/notes.md', 'Keep unknown notes');
  write(projectDir, '_bmad/config.yaml', 'execution_mode: hybrid');
  saveManifest();
});
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(temporary, { recursive: true, force: true });
});

test('plans without writing, commits exact inventory, and restores original bytes and version', () => {
  const before = read(MANIFEST);
  const prepared = plan();
  expect(read(MANIFEST)).toBe(before);
  expect(fs.existsSync(path.join(projectDir, '.bmad'))).toBe(false);
  const result = applyPlan(prepared);
  expect(result.manifest.version).toBe('0.12.3');
  expect(result.manifest.executionMode).toBe('hybrid');
  expect(result.manifest.fileInventory.files[SKILL]).toBe(fileHash(Buffer.from(read(SKILL))));
  expect(receipt(result).status).toBe('committed');
  expect(fs.existsSync(path.join(projectDir, LOCK))).toBe(false);
  expect(read('.agents/memory/decisions.md')).toBe('Keep all memory');
  expect(read('.agents/skills/agent-strategist/notes.md')).toBe('Keep unknown notes');
  expect(read('_bmad/config.yaml')).toBe('execution_mode: hybrid');
  const restored = restoreUpdate({ projectDir, receiptId: result.receiptId });
  expect(restored.restoredVersion).toBe('0.12.2');
  expect(read(SKILL)).toBe('old ' + SKILL);
  expect(read(MANIFEST)).toBe(before);
});

test('preserves an edited skill and its original ownership; automatic mode refuses before mutation', () => {
  write(projectDir, SKILL, 'My custom skill');
  const before = read(MANIFEST);
  expect(() => plan({ auto: true })).toThrow(/conflicts/);
  expect(read(MANIFEST)).toBe(before);
  expect(evaluateUpdateReadiness({ projectDir }).ready).toBe(false);
  const prepared = plan();
  expect(prepared.conflicts).toContainEqual({ file: SKILL, reason: 'modified-managed-file' });
  const result = applyPlan(prepared);
  expect(read(SKILL)).toBe('My custom skill');
  expect(result.manifest.fileInventory.files[SKILL]).toBe(manifest.fileInventory.files[SKILL]);
});

test('backs up legacy bytes for manual migration but rejects legacy automatic application', () => {
  delete manifest.fileInventory;
  saveManifest();
  expect(evaluateUpdateReadiness({ projectDir })).toMatchObject({ ready: false, legacy: true });
  expect(() => plan({ auto: true })).toThrow(/legacy/);
  const result = applyPlan(plan());
  const entry = receipt(result).entries.find((item) => item.file === SKILL);
  expect(read(entry.backup)).toBe('old ' + SKILL);
  expect(result.manifest.fileInventory.complete).toBe(true);
});

test('preserves unknown collisions and keeps partial ownership blocked for automatic mode', () => {
  delete manifest.fileInventory.files[SKILL];
  saveManifest();
  const result = applyPlan(plan());
  expect(read(SKILL)).toBe('old ' + SKILL);
  expect(result.manifest.fileInventory.complete).toBe(false);
  expect(inventoryOf(result.manifest)).not.toBeNull();
  expect(evaluateUpdateReadiness({ projectDir }).ready).toBe(false);
  expect(plan().conflicts).toContainEqual({ file: SKILL, reason: 'unowned-file' });
});

test('missing destinations can be recreated without losing ownership', () => {
  fs.unlinkSync(path.join(projectDir, SKILL));
  expect(evaluateUpdateReadiness({ projectDir }).ready).toBe(true);
  const result = applyPlan(plan({ auto: true }), { reauthorize: () => {} });
  expect(read(SKILL)).toBe('new ' + SKILL);
  restoreUpdate({ projectDir, receiptId: result.receiptId });
  expect(fs.existsSync(path.join(projectDir, SKILL))).toBe(false);
});

test('rejects downgrades and malformed versions', () => {
  expect(() => plan({ version: '0.12.1' })).toThrow(/Downgrade/);
  expect(() => plan({ version: 'not-a-version' })).toThrow(/semantic/);
});

test.each(['.agents/skills/agent-strategist', '.cursor'])(
  'preflights a junction at %s before framework mutations',
  (linked) => {
    manifest.ides = ['cursor'];
    saveManifest();
    const outside = path.join(temporary, 'outside');
    const target = path.join(projectDir, linked);
    fs.mkdirSync(outside);
    if (fs.existsSync(target)) fs.renameSync(target, path.join(outside, 'old'));
    fs.symlinkSync(outside, target, 'junction');
    const before = read(MANIFEST);
    expect(() => plan()).toThrow(/junction|symbolic/);
    expect(read(MANIFEST)).toBe(before);
    expect(fs.existsSync(path.join(projectDir, '.bmad'))).toBe(false);
  }
);

test('refuses an active project lock without changing files', () => {
  const prepared = plan();
  const release = acquireProjectLock(projectDir);
  try {
    expect(() => applyPlan(prepared)).toThrow(/in progress/);
    expect(evaluateUpdateReadiness({ projectDir }).ready).toBe(false);
    expect(read(SKILL)).toBe('old ' + SKILL);
  } finally {
    release();
  }
});

test('revalidates both files and manifest after planning', () => {
  const prepared = plan();
  write(projectDir, SKILL, 'Changed after approval');
  expect(() => applyPlan(prepared)).toThrow(/after preflight/);
  expect(read(SKILL)).toBe('Changed after approval');
  expect(JSON.parse(read(MANIFEST)).version).toBe('0.12.2');
  expect(fs.existsSync(path.join(projectDir, LOCK))).toBe(false);
  manifest.executionMode = 'manual';
  expect(() => plan({ manifest })).toThrow(/manifest changed/);
});

test('reauthorizes automatic policy under lock before any backup or content write', () => {
  const prepared = plan({ auto: true });
  expect(() => applyPlan(prepared)).toThrow(/reauthorization/);
  const reauthorize = () => {
    expect(fs.existsSync(path.join(projectDir, LOCK))).toBe(true);
    throw new Error('Policy revoked');
  };
  expect(() => applyPlan(prepared, { reauthorize })).toThrow('Policy revoked');
  expect(read(SKILL)).toBe('old ' + SKILL);
});

test('a mid-write failure rolls back changed files and never promotes the manifest', () => {
  const originalRename = fs.renameSync;
  let failed = false;
  jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (!failed && to === path.join(projectDir, '_bmad/module.yaml')) {
      failed = true;
      throw new Error('simulated disk failure');
    }
    return originalRename(from, to);
  });
  expect(() => applyPlan(plan())).toThrow(/simulated disk failure.*rolled-back.*--restore/);
  expect(read(SKILL)).toBe('old ' + SKILL);
  expect(JSON.parse(read(MANIFEST)).version).toBe('0.12.2');
  const ids = fs.readdirSync(path.join(projectDir, '.bmad/updates'));
  expect(JSON.parse(read('.bmad/updates/' + ids[0] + '/receipt.json')).status).toBe('rolled-back');
  expect(fs.existsSync(path.join(projectDir, LOCK))).toBe(false);
});

test('a corrupt backup refuses recovery before any file is restored', () => {
  const result = applyPlan(plan());
  const data = receipt(result);
  write(projectDir, data.entries.find((entry) => entry.file === SKILL).backup, 'corrupt backup');
  expect(() => restoreUpdate({ projectDir, receiptId: result.receiptId })).toThrow(/corrupt/);
  expect(read('_bmad/module.yaml')).toBe('new _bmad/module.yaml');
  expect(read(SKILL)).toBe('new ' + SKILL);
  expect(JSON.parse(read(MANIFEST)).version).toBe('0.12.3');
});

test('refuses recovery after local edits or a later installation', () => {
  const result = applyPlan(plan());
  write(projectDir, SKILL, 'New custom notes');
  expect(() => restoreUpdate({ projectDir, receiptId: result.receiptId })).toThrow(/changed since/);
  expect(read('_bmad/module.yaml')).toBe('new _bmad/module.yaml');
  manifest.version = '0.12.4';
  saveManifest();
  expect(() => restoreUpdate({ projectDir, receiptId: result.receiptId })).toThrow(
    /Installation changed/
  );
});

test('recovery rejects scope traversal into project memory', () => {
  const result = applyPlan(plan());
  const data = receipt(result);
  data.entries[0].file = '.agents/skills/../memory/decisions.md';
  fs.writeFileSync(result.receiptPath, JSON.stringify(data));
  expect(() => restoreUpdate({ projectDir, receiptId: result.receiptId })).toThrow(
    /Invalid recovery/
  );
  expect(read('.agents/memory/decisions.md')).toBe('Keep all memory');
  expect(() => restoreUpdate({ projectDir, receiptId: '../outside' })).toThrow(
    /Invalid update receipt/
  );
});

test('legacy adapter migration is backed up while adopted root instructions are preserved', () => {
  manifest.ides = ['claude-code'];
  const files = generateUserFiles(DERIVED, { packs: ['core'], tools: ['claude-code'] });
  manifest.adapterHashes = Object.fromEntries(
    files.map((entry) => [entry.file, contentHash(entry.content)])
  );
  for (const entry of files) write(projectDir, entry.file, entry.content);
  write(
    projectDir,
    'AGENTS.md',
    '<!-- AUTO-GENERATED by tools/build/generate-adapters.js -->\nRepository notes'
  );
  write(projectDir, 'CLAUDE.md', 'BMAD+ — AI Agent Configuration\nLegacy notes');
  saveManifest();
  expect(evaluateUpdateReadiness({ projectDir }).ready).toBe(false);
  const result = applyPlan(plan());
  expect(read('CLAUDE.md.bak')).toContain('Legacy notes');
  expect(read('AGENTS.md')).toContain('Repository notes');
  expect(result.conflicts).toContainEqual({ file: 'AGENTS.md', reason: 'repository-adopted' });
});

describe('files removed from the new version', () => {
  const RETIRED = '.agents/skills/retired-skill/SKILL.md';
  function ownRetired(content = 'retired skill') {
    write(projectDir, RETIRED, content);
    manifest.fileInventory.files[RETIRED] = fileHash(Buffer.from('retired skill'));
    saveManifest();
  }

  test('deletes an unchanged orphan with a receipt backup and restores it', () => {
    ownRetired();
    const prepared = plan();
    expect(prepared.files).toContainEqual(
      expect.objectContaining({ file: RETIRED, afterHash: null })
    );
    const result = applyPlan(prepared);
    expect(result.removedFiles).toEqual([RETIRED]);
    expect(fs.existsSync(path.join(projectDir, RETIRED))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, '.agents/skills/retired-skill'))).toBe(false);
    expect(result.manifest.fileInventory.files[RETIRED]).toBeUndefined();
    const entry = receipt(result).entries.find((item) => item.file === RETIRED);
    expect(read(entry.backup)).toBe('retired skill');
    restoreUpdate({ projectDir, receiptId: result.receiptId });
    expect(read(RETIRED)).toBe('retired skill');
  });

  test('keeps and reports a locally modified orphan, then stops owning it', () => {
    ownRetired('my edited retired skill');
    const prepared = plan();
    expect(prepared.conflicts).toContainEqual({ file: RETIRED, reason: 'modified-orphaned-file' });
    const result = applyPlan(prepared);
    expect(read(RETIRED)).toBe('my edited retired skill');
    expect(result.manifest.fileInventory.files[RETIRED]).toBeUndefined();
    expect(evaluateUpdateReadiness({ projectDir }).ready).toBe(true);
  });

  test('drops ownership of an orphan the user already deleted', () => {
    manifest.fileInventory.files[RETIRED] = fileHash(Buffer.from('retired skill'));
    saveManifest();
    const result = applyPlan(plan());
    expect(result.removedFiles).toEqual([]);
    expect(result.manifest.fileInventory.files[RETIRED]).toBeUndefined();
  });
});

describe('stale project locks', () => {
  function writeLock(lock) {
    write(projectDir, LOCK, JSON.stringify(lock));
  }

  test('a lock held by a live process is reported as active with a remedy', () => {
    const release = acquireProjectLock(projectDir);
    try {
      expect(inspectProjectLock(projectDir)).toMatchObject({
        pid: process.pid,
        pidAlive: true,
        stale: false,
      });
      expect(() => acquireProjectLock(projectDir)).toThrow(/in progress.*bmad-plus doctor/);
    } finally {
      release();
    }
    expect(inspectProjectLock(projectDir)).toBeNull();
  });

  test('a lock left by a dead local process is recovered and kept as evidence', () => {
    writeLock({
      id: 'dead',
      pid: 99999999,
      hostname: os.hostname(),
      createdAt: new Date().toISOString(),
    });
    jest.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('gone'), { code: 'ESRCH' });
    });
    expect(inspectProjectLock(projectDir)).toMatchObject({
      stale: true,
      recoverable: true,
      pidAlive: false,
    });
    const release = acquireProjectLock(projectDir);
    expect(JSON.parse(read(LOCK)).pid).toBe(process.pid);
    release();
    expect(
      fs
        .readdirSync(path.join(projectDir, '.bmad'))
        .some((name) => name.startsWith('update.lock.stale-'))
    ).toBe(true);
  });

  test('an old lock from another machine is stale but needs a manual remedy', () => {
    writeLock({
      id: 'remote',
      pid: 42,
      hostname: 'another-host',
      createdAt: '2020-01-01T00:00:00Z',
    });
    expect(inspectProjectLock(projectDir)).toMatchObject({
      stale: true,
      recoverable: false,
      pidAlive: null,
    });
    expect(() => acquireProjectLock(projectDir)).toThrow(
      /older than 60 minutes.*delete .*update\.lock and retry/
    );
    expect(JSON.parse(read(LOCK)).id).toBe('remote');
  });

  test('a recent unreadable lock is not stale yet', () => {
    write(projectDir, LOCK, '');
    expect(inspectProjectLock(projectDir)).toMatchObject({ stale: false, recoverable: false });
    expect(inspectProjectLock(projectDir, { now: Date.now() + 2 * 60 * 1000 }).stale).toBe(true);
  });
});
