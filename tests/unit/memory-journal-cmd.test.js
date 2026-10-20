/**
 * BMAD+ `mem` Command — Unit Tests (Pillar 3 CLI surface)
 *
 * Drives the injected action handlers (runRecall / runWrite / runReinforce)
 * against a tmp dir with an INJECTED clock — no Date.now() in assertions,
 * no network, no model calls.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const cmd = require('../../tools/cli/commands/memory-journal-cmd');
const mj = require('../../tools/cli/lib/memory-journal');

const { runRecall, runWrite, runReinforce, parseSignals, readScores } = cmd._internal;

const T0 = '2026-07-01T10:00:00.000Z';
const T1 = '2026-07-01T11:00:00.000Z';
const T2 = '2026-07-01T12:00:00.000Z';

describe('memory-journal-cmd (mem)', () => {
  let tmpDir;
  let lines;
  let log;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-mem-cmd-'));
    lines = [];
    log = (...args) => lines.push(args.join(' '));
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  // ── module contract ────────────────────────────────────────────────────────

  describe('command module shape', () => {
    test('exports the { command, description, options, action } contract', () => {
      expect(cmd.command).toMatch(/^mem /);
      expect(typeof cmd.description).toBe('string');
      expect(Array.isArray(cmd.options)).toBe(true);
      expect(typeof cmd.action).toBe('function');
    });

    test('does not collide with the existing `memory` brain-scanner command', () => {
      const memory = require('../../tools/cli/commands/memory');
      expect(cmd.command.split(' ')[0]).toBe('mem');
      expect(memory.command.split(' ')[0]).toBe('memory');
    });
  });

  // ── write ──────────────────────────────────────────────────────────────────

  describe('runWrite', () => {
    test('appends a structured event with the injected clock as ts', () => {
      const event = runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        cli: 'gemini-cli',
        model: 'gemini',
        task: 'migrate postgres schema',
        outcome: 'success',
        signals: { ci: 'pass' },
        now: T0,
        log,
      });

      expect(event.ts).toBe(T0);
      expect(event.agent).toBe('forge');
      expect(event.cli).toBe('gemini-cli');
      expect(event.model).toBe('gemini');
      expect(event.outcome).toBe('success');

      const onDisk = mj.readJournal(tmpDir);
      expect(onDisk).toHaveLength(1);
      expect(onDisk[0]).toEqual(event);
      expect(fs.existsSync(path.join(tmpDir, '.bmad', 'memory', 'journal.ndjson'))).toBe(true);
    });

    test('rejects a missing agent (validation delegated to memory-journal)', () => {
      expect(() => runWrite({ baseDir: tmpDir, task: 'no agent', now: T0, log })).toThrow(/agent/);
    });

    test('rejects an invalid outcome', () => {
      expect(() =>
        runWrite({ baseDir: tmpDir, agent: 'forge', outcome: 'meh', now: T0, log })
      ).toThrow(/outcome/);
    });

    test('json mode emits the persisted event as parseable JSON', () => {
      runWrite({
        baseDir: tmpDir,
        agent: 'zecher',
        task: 'consolidate context',
        now: T0,
        json: true,
        log,
      });
      const parsed = JSON.parse(lines.join('\n'));
      expect(parsed.written.agent).toBe('zecher');
      expect(parsed.written.ts).toBe(T0);
    });
  });

  // ── recall ─────────────────────────────────────────────────────────────────

  describe('runRecall', () => {
    test('returns ranked entries from the journal and prints them', () => {
      runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        task: 'refactor postgres connection pooling',
        outcome: 'success',
        now: T0,
        log: () => {},
      });
      runWrite({
        baseDir: tmpDir,
        agent: 'sentinel',
        task: 'review css animations',
        outcome: 'partial',
        now: T1,
        log: () => {},
      });

      const results = runRecall('postgres pooling', { baseDir: tmpDir, log });
      expect(results).toHaveLength(1);
      expect(results[0].kind).toBe('event');
      expect(results[0].event.agent).toBe('forge');
      expect(lines.some((l) => l.includes('1 match'))).toBe(true);
    });

    test('merges human memory notes and honors limit', () => {
      const memDir = path.join(tmpDir, '.agents', 'memory');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(
        path.join(memDir, 'patterns.md'),
        '### chromadb batch ingestion\n- batch upserts of 500 docs\n',
        'utf8'
      );
      runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        task: 'chromadb ingestion pipeline',
        now: T0,
        log: () => {},
      });

      const all = runRecall('chromadb ingestion', { baseDir: tmpDir, log });
      expect(all).toHaveLength(2);
      const limited = runRecall('chromadb ingestion', { baseDir: tmpDir, limit: 1, log });
      expect(limited).toHaveLength(1);
    });

    test('injected now enables recency decay (recent event ranks first)', () => {
      runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        task: 'docker compose networking fix',
        now: '2026-01-01T00:00:00.000Z',
        log: () => {},
      });
      runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        task: 'docker compose networking fix',
        now: '2026-06-30T00:00:00.000Z',
        log: () => {},
      });

      const results = runRecall('docker compose networking', { baseDir: tmpDir, now: T2, log });
      expect(results[0].event.ts).toBe('2026-06-30T00:00:00.000Z');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    test('json mode emits a parseable envelope with count + results', () => {
      runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        task: 'bullmq worker retries',
        now: T0,
        log: () => {},
      });
      runRecall('bullmq retries', { baseDir: tmpDir, json: true, log });
      const parsed = JSON.parse(lines.join('\n'));
      expect(parsed.count).toBe(1);
      expect(parsed.results[0].event.task).toBe('bullmq worker retries');
    });

    test('reports zero matches without throwing', () => {
      const results = runRecall('nothing indexed here', { baseDir: tmpDir, log });
      expect(results).toEqual([]);
      expect(lines.some((l) => l.includes('no matches'))).toBe(true);
    });
  });

  // ── reinforce ──────────────────────────────────────────────────────────────

  describe('runReinforce', () => {
    test('fresh pattern + full-positive signals → reward 1, elo 1216, store persisted', () => {
      const res = runReinforce({
        baseDir: tmpDir,
        patternId: 'chromadb batch ingestion',
        signals: { evalScore: 1, acceptance: true, ci: 'pass' },
        now: T0,
        log,
      });

      expect(res.reward).toBe(1);
      expect(res.previous).toBeNull();
      expect(res.next.elo).toBeCloseTo(1216, 10); // 1200 + 32 * (1 - 0.5)
      expect(res.next.updates).toBe(1);
      expect(res.next.lastTs).toBe(T0);

      const stored = readScores(tmpDir);
      expect(stored['chromadb batch ingestion'].elo).toBeCloseTo(1216, 10);
    });

    test('requires --pattern', () => {
      expect(() =>
        runReinforce({ baseDir: tmpDir, signals: { ci: 'pass' }, now: T0, log })
      ).toThrow(/pattern/);
    });

    test('accumulates across calls by reloading the persisted score', () => {
      runReinforce({
        baseDir: tmpDir,
        patternId: 'p1',
        signals: { ci: 'pass' },
        now: T0,
        log: () => {},
      });
      const res2 = runReinforce({
        baseDir: tmpDir,
        patternId: 'p1',
        signals: { ci: 'pass' },
        now: T1,
        log: () => {},
      });
      expect(res2.previous.updates).toBe(1);
      expect(res2.next.updates).toBe(2);
      expect(res2.next.elo).toBeGreaterThan(res2.previous.elo);
    });

    test('below thresholds → no promotion proposed', () => {
      const res = runReinforce({
        baseDir: tmpDir,
        patternId: 'p1',
        signals: { ci: 'pass' },
        now: T0,
        log,
      });
      expect(res.promotion).toBeNull();
      expect(mj.readPromotions(tmpDir)).toHaveLength(0);
      expect(lines.some((l) => l.includes('none proposed'))).toBe(true);
    });

    test('crossing thresholds proposes a promotion that is PROPOSED, never applied', () => {
      let res;
      for (const ts of [T0, T1, T2]) {
        res = runReinforce({
          baseDir: tmpDir,
          patternId: 'chromadb batch ingestion',
          signals: { evalScore: 1, acceptance: true, ci: 'pass' },
          evidence: ['ev1', 'ev2'],
          now: ts,
          log,
        });
      }

      expect(res.next.updates).toBe(3);
      expect(res.next.mean).toBeGreaterThanOrEqual(0.7);
      expect(res.promotion).not.toBeNull();
      expect(res.promotion.status).toBe('PROPOSED');
      expect(res.promotion.approvedBy).toBeNull();
      expect(res.promotion.governedBy).toBe('shield');
      expect(res.promotion.evidence).toEqual(['ev1', 'ev2']);

      const onDisk = mj.readPromotions(tmpDir);
      expect(onDisk.length).toBeGreaterThanOrEqual(1);
      for (const p of onDisk) {
        expect(p.status).toBe('PROPOSED');
        expect(p.approvedBy).toBeNull();
      }
      // and the governance gate still refuses to apply it
      expect(() => mj.assertPromotionApplicable(res.promotion)).toThrow(/Governance guard/);
    });

    test('survives a corrupt pattern-scores.json (restarts from priors)', () => {
      const file = path.join(tmpDir, '.bmad', 'memory', 'pattern-scores.json');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '{not json!!', 'utf8');
      const res = runReinforce({
        baseDir: tmpDir,
        patternId: 'p1',
        signals: { ci: 'pass' },
        now: T0,
        log,
      });
      expect(res.previous).toBeNull();
      expect(res.next.updates).toBe(1);
    });
  });

  // ── flag parsing ───────────────────────────────────────────────────────────

  describe('parseSignals', () => {
    test('maps --eval / --accept / --ci to the memory-journal signals shape', () => {
      expect(parseSignals({ eval: '0.8', accept: 'true', ci: 'pass' })).toEqual({
        evalScore: 0.8,
        acceptance: true,
        ci: 'pass',
      });
      expect(parseSignals({ accept: 'false', ci: 'fail' })).toEqual({
        acceptance: false,
        ci: 'fail',
      });
      expect(parseSignals({ accept: '0.5', ci: '0.25' })).toEqual({ acceptance: 0.5, ci: 0.25 });
      expect(parseSignals({})).toEqual({});
    });
  });

  // ── commander action dispatch (real wiring, clock read at call time) ───────

  describe('action dispatch', () => {
    test('recall via the commander-facing action with --json prints valid JSON', async () => {
      runWrite({
        baseDir: tmpDir,
        agent: 'forge',
        task: 'hetzner self-host provisioning',
        now: T0,
        log: () => {},
      });

      const logged = [];
      const spy = jest
        .spyOn(console, 'log')
        .mockImplementation((...args) => logged.push(args.join(' ')));
      try {
        await cmd.action('recall', ['hetzner', 'provisioning'], { directory: tmpDir, json: true });
      } finally {
        spy.mockRestore();
      }
      const parsed = JSON.parse(logged.join('\n'));
      expect(parsed.query).toBe('hetzner provisioning');
      expect(parsed.count).toBe(1);
      expect(process.exitCode).toBeUndefined();
    });

    test('write via the action injects a call-time clock into the event', async () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await cmd.action('write', [], {
          directory: tmpDir,
          agent: 'forge',
          task: 'wired through commander',
          outcome: 'success',
        });
      } finally {
        spy.mockRestore();
      }
      const events = mj.readJournal(tmpDir);
      expect(events).toHaveLength(1);
      expect(Number.isNaN(Date.parse(events[0].ts))).toBe(false);
    });

    test('unknown action sets exitCode 1 without throwing', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await cmd.action('frobnicate', [], { directory: tmpDir });
        expect(process.exitCode).toBe(1);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('unknown action'));
      } finally {
        spy.mockRestore();
      }
    });

    test('handler errors are reported, not thrown (missing --agent on write)', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await cmd.action('write', [], { directory: tmpDir });
        expect(process.exitCode).toBe(1);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('agent'));
      } finally {
        spy.mockRestore();
      }
    });
  });
});
