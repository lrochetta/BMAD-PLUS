const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const outcomes = require('../../tools/cli/lib/memory-outcomes');
const mj = require('../../tools/cli/lib/memory-journal');
const store = require('../../tools/cli/lib/memory-store');
const cmd = require('../../tools/cli/commands/memory-journal-cmd');
const fixture = require('../fixtures/memory-outcomes/helpers.cjs');
// These cases execute real verifiers and concurrent CLIs, including on Windows.
const { spawnTimeout, removeTree } = require('../helpers/process-budget');
// Source fixtures run real Nexus verifiers plus concurrent CLI observers.
jest.setTimeout(spawnTimeout(10, { floor: 30000 }));

const MODULE = require.resolve('../../tools/cli/lib/memory-outcomes');
const CLI = require.resolve('../../tools/cli/bmad-plus-cli');
let project;

function recall(query = 'cache values', options = {}) {
  return mj.recall(query, {
    baseDir: project,
    ranking: 'evidence',
    contextScope: ['work'],
    ...options,
  });
}
function child(code, args = []) {
  const process = spawn(global.process.execPath, ['-e', code, ...args], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderr = '';
  process.stdout.on('data', (data) => {
    stdout += data;
  });
  process.stderr.on('data', (data) => {
    stderr += data;
  });
  return new Promise((resolve, reject) => {
    process.on('error', reject);
    process.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-memory-outcomes-'));
  fixture.initialize(project);
});
afterEach(() => {
  const resolved = path.resolve(project);
  if (
    !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(resolved).startsWith('bmad-memory-outcomes-')
  )
    throw new Error('Unsafe fixture cleanup.');
  removeTree(resolved, { force: true });
});

test('accepted receipt binds exact task, attempt, artifacts, verifier and memory section', async () => {
  await fixture.source(project);
  const written = fixture.observe(project);
  expect(written.id).toMatch(/^[a-f0-9]{64}$/);
  expect(written.source.attemptId).toBeTruthy();
  expect(written.source.verificationId).toBeTruthy();
  expect(written.source.verificationSha256).toHaveLength(64);
  expect(written.source.artifactHashes['work/result.json']).toMatch(/^[a-f0-9]{64}$/);
  expect(written.verification).toEqual({
    status: 'passed',
    acceptance: 'accepted',
    lessonCausality: 'unmeasured',
  });
  expect(outcomes.inspectOutcomes(project)[0].eligible).toBe(true);
  expect(recall()[0].evidence.status).toBe('accepted-current');
});

test.each(['failed', 'unaccepted', 'missing'])(
  '%s sources cannot be recorded as successful outcomes',
  async (mode) => {
    if (mode !== 'missing')
      await fixture.source(
        project,
        'one',
        mode === 'failed' ? { outcome: 'failed' } : { accept: false }
      );
    expect(() => fixture.observe(project)).toThrow();
    expect(outcomes.readOutcomes(project)).toEqual([]);
  }
);

test('changed artifact cannot acquire new evidence and invalidates existing recall', async () => {
  await fixture.source(project);
  fixture.observe(project);
  fixture.write(project, 'work/result.json', '{"verified":false}');
  expect(outcomes.inspectOutcomes(project)[0].eligible).toBe(false);
  expect(recall()).toEqual([]);
  expect(mj.recall('cache', { baseDir: project })).toHaveLength(1);
});

test.each(['section', 'missing-note', 'missing-run', 'verifier'])(
  '%s drift is visible and removes the affected evidence candidate',
  async (change) => {
    await fixture.source(project);
    fixture.observe(project);
    if (change === 'section')
      fixture.write(project, fixture.MEMORY, '### Cache contract\nDiscard zero cache values.\n');
    if (change === 'missing-note') fs.unlinkSync(path.join(project, fixture.MEMORY));
    if (change === 'missing-run')
      fs.unlinkSync(path.join(project, '.bmad-plus/nexus/runs/one.json'));
    if (change === 'verifier') fixture.write(project, 'checks/accepted.cjs', 'process.exit(0);');
    expect(outcomes.inspectOutcomes(project)[0].eligible).toBe(false);
    expect(recall()).toEqual([]);
  }
);

test('source and scope validation prevents ambiguous anchors and root widening', async () => {
  await fixture.source(project);
  expect(() => fixture.observe(project, 'one', 'Cache contract', { scope: ['other'] })).toThrow(
    /scope/
  );
  expect(() => fixture.observe(project, 'one', 'Cache contract', { scope: ['../work'] })).toThrow(
    /scope/
  );
  expect(() =>
    fixture.observe(project, 'one', 'Cache contract', {
      memory: { file: '../brain/patterns.md', heading: 'Cache contract' },
    })
  ).toThrow(/source/);
  fixture.write(project, fixture.MEMORY, '### Cache contract\na\n### Cache contract\nb\n');
  expect(() => fixture.observe(project)).toThrow(/exactly one/);
});

test('duplicate task attempts cannot supply repeated support even for another note', async () => {
  await fixture.source(project);
  fixture.observe(project);
  expect(() => fixture.observe(project)).toThrow(/Duplicate/);
  expect(outcomes.readOutcomes(project)).toHaveLength(1);
});

test('explicit unresolved contradiction suppresses both sides; a new accepted resolution supersedes both', async () => {
  fixture.write(
    project,
    fixture.MEMORY,
    '### Cache contract\nPreserve zero cache values.\n### Cache alternative\nDiscard zero cache values.\n### Cache resolution\nInspect the cache caller contract for values.\n'
  );
  for (const id of ['one', 'two', 'three']) await fixture.source(project, id);
  const first = fixture.observe(project);
  const second = fixture.observe(project, 'two', 'Cache alternative', { contradicts: [first.id] });
  expect(
    outcomes.inspectOutcomes(project).every((record) => record.reason === 'contradictory')
  ).toBe(true);
  expect(recall().map((item) => item.ref)).toEqual(['Cache resolution']);
  const third = fixture.observe(project, 'three', 'Cache resolution', {
    supersedes: [first.id, second.id],
  });
  expect(recall().map((item) => item.evidence.receiptIds)).toEqual([[third.id]]);
  expect(outcomes.inspectOutcomes(project).map((record) => record.reason)).toEqual([
    'superseded',
    'superseded',
    null,
  ]);
});

test('relationships reject missing IDs and incompatible declarations', async () => {
  await fixture.source(project);
  expect(() =>
    fixture.observe(project, 'one', 'Cache contract', { supersedes: ['missing'] })
  ).toThrow(/must exist/);
  const first = fixture.observe(project);
  await fixture.source(project, 'two');
  expect(() =>
    fixture.observe(project, 'two', 'Cache contract', {
      supersedes: [first.id],
      contradicts: [first.id],
    })
  ).toThrow(/both/);
});

test('re-observing the same section from another accepted task cannot bypass its unresolved contradiction', async () => {
  fixture.write(
    project,
    fixture.MEMORY,
    '### Cache contract\nPreserve zero cache values.\n### Cache alternative\nDiscard zero cache values.\n'
  );
  for (const id of ['one', 'two', 'three']) await fixture.source(project, id);
  const first = fixture.observe(project);
  fixture.observe(project, 'two', 'Cache alternative', { contradicts: [first.id] });
  fixture.observe(project, 'three', 'Cache contract');
  expect(
    outcomes.inspectOutcomes(project).every((record) => record.reason === 'contradictory')
  ).toBe(true);
  expect(recall()).toEqual([]);
});

test('evidence recall refuses linked project notes before reading their contents', () => {
  fs.renameSync(path.join(project, '.agents/memory'), path.join(project, 'separate-memory'));
  fs.symlinkSync(
    path.join(project, 'separate-memory'),
    path.join(project, '.agents/memory'),
    'junction'
  );
  expect(() => recall()).toThrow(/links|junctions/);
});

test('evidence boosts only relevant matches in the requested scope and never uses legacy self-reported rewards', async () => {
  fixture.write(
    project,
    fixture.MEMORY,
    '### Cache contract\nPreserve false and zero cache values.\n### Cache shortcut\nReuse cache values without inspection.\n### Billing export\nExport annual invoices.\n'
  );
  await fixture.source(project);
  fixture.observe(project);
  cmd._internal.runReinforce({
    baseDir: project,
    patternId: 'Cache shortcut',
    signals: { acceptance: true, evalScore: 1, ci: 'pass' },
    now: fixture.NOW,
    log: () => {},
  });
  const baseline = mj.recall('cache values', { baseDir: project });
  expect(baseline[0].ref).toBe('Cache shortcut');
  const ranked = recall();
  expect(ranked[0].ref).toBe('Cache contract');
  expect(ranked[0].score).toBeCloseTo(baseline[1].score * 1.25);
  expect(ranked.map((item) => item.ref)).not.toContain('Billing export');
  expect(recall('cache values', { contextScope: ['other'] }).map((item) => item.ref)).toEqual([
    'Cache shortcut',
  ]);
});

test('empty memory is harmless, evidence mode needs a scope and cannot follow portfolio or optional backends', () => {
  fixture.write(project, fixture.MEMORY, '');
  expect(recall()).toEqual([]);
  expect(() => recall('cache', { contextScope: undefined })).toThrow(/scope/);
  expect(() => recall('cache', { scope: 'portfolio', portfolioDir: '../brain' })).toThrow(
    /project-local/
  );
  expect(() =>
    recall('cache', {
      backend: {
        search() {
          throw new Error('must not be called');
        },
      },
    })
  ).toThrow(/project-local/);
});

test('tampered and incomplete outcome receipts fail closed without silently discarding evidence', async () => {
  await fixture.source(project);
  const receipt = fixture.observe(project);
  fixture.write(
    project,
    outcomes.OUTCOMES,
    JSON.stringify({ ...receipt, interpretation: 'tampered' }) + '\n'
  );
  expect(() => recall()).toThrow(/integrity/);
  fixture.write(project, outcomes.OUTCOMES, JSON.stringify(receipt));
  expect(() => recall()).toThrow(/incomplete/);
});

test('linked memory directories cannot redirect writes outside the project', () => {
  const outside = path.join(project, 'separate');
  fs.mkdirSync(outside);
  fs.mkdirSync(path.join(project, '.bmad'));
  fs.symlinkSync(outside, path.join(project, '.bmad/memory'), 'junction');
  expect(() => mj.appendEvent(project, { ts: fixture.NOW, agent: 'forge' })).toThrow(
    /links|junctions/
  );
  expect(fs.readdirSync(outside)).toEqual([]);
});

test('two real processes observing the same attempt create exactly one complete receipt', async () => {
  await fixture.source(project);
  const code =
    'try { const written = require(process.argv[1]).observeOutcome(process.argv[2], JSON.parse(process.argv[3]), { now: process.argv[4] }); console.log(written.id); } catch (error) { console.error(error.message); process.exitCode = 2; }';
  const args = [MODULE, project, JSON.stringify(fixture.observation()), fixture.NOW];
  const results = await Promise.all([child(code, args), child(code, args)]);
  expect(results.map((result) => result.status).sort()).toEqual([0, 2]);
  expect(results.find((result) => result.status === 2).stderr).toMatch(/Duplicate/);
  expect(outcomes.readOutcomes(project)).toHaveLength(1);
  expect(fs.existsSync(path.join(project, store.LOCK))).toBe(false);
});

test('concurrent legacy journal, score and promotion writers keep every update', async () => {
  const module = require.resolve('../../tools/cli/commands/memory-journal-cmd');
  const code =
    "const c=require(process.argv[1])._internal; for(let i=0;i<5;i++){c.runWrite({baseDir:process.argv[2], agent:process.argv[3], task:'controlled write '+i, now:'2026-09-11T12:00:00Z', log:()=>{}});c.runReinforce({baseDir:process.argv[2], patternId:'shared',signals:{ci:'pass'},now:'2026-09-11T12:00:00Z',log:()=>{}});}";
  const results = await Promise.all(
    ['one', 'two', 'three'].map((id) => child(code, [module, project, id]))
  );
  expect(results.map((result) => result.stderr)).toEqual(['', '', '']);
  expect(results.every((result) => result.status === 0)).toBe(true);
  expect(mj.readJournal(project)).toHaveLength(15);
  expect(cmd._internal.readScores(project).shared.updates).toBe(15);
  expect(mj.readPromotions(project).every((promotion) => promotion.status === 'PROPOSED')).toBe(
    true
  );
});

test('an interrupted writer leaves an inspectable lock and cannot silently be stolen', () => {
  const module = require.resolve('../../tools/cli/lib/memory-store');
  const stopped = spawnSync(
    process.execPath,
    [
      '-e',
      'require(process.argv[1]).withMemoryLock(process.argv[2], () => process.exit(9));',
      module,
      project,
    ],
    { windowsHide: true }
  );
  expect(stopped.status).toBe(9);
  const owner = JSON.parse(fs.readFileSync(path.join(project, store.LOCK), 'utf8'));
  expect(owner.pid).toBe(stopped.pid);
  expect(() => mj.appendEvent(project, { ts: fixture.NOW, agent: 'forge' })).toThrow(
    /lock is occupied/
  );
  expect(JSON.parse(fs.readFileSync(path.join(project, store.LOCK), 'utf8'))).toEqual(owner);
});

test('real CLI observe, outcomes and evidence recall return traceable JSON and reject duplicate observation', async () => {
  await fixture.source(project);
  fixture.write(project, 'observation.json', JSON.stringify(fixture.observation()));
  const invoke = (args) =>
    spawnSync(process.execPath, [CLI, 'mem', ...args, '--directory', project, '--json'], {
      encoding: 'utf8',
      windowsHide: true,
    });
  const observed = invoke(['observe', '--input', 'observation.json']);
  expect(observed.status).toBe(0);
  const id = JSON.parse(observed.stdout).written.id;
  const inspected = invoke(['outcomes']);
  expect(JSON.parse(inspected.stdout).results[0].eligible).toBe(true);
  const recalled = invoke(['recall', 'cache', '--ranking', 'evidence', '--context-scope', 'work']);
  expect(JSON.parse(recalled.stdout).results[0].evidence.receiptIds).toEqual([id]);
  const duplicate = invoke(['observe', '--input', 'observation.json']);
  expect(duplicate.status).toBe(1);
  expect(JSON.parse(duplicate.stdout).error).toMatch(/Duplicate/);
});
