/**
 * BMAD+ Memory Journal — Unit Tests (Karpathy Learning Layer, Pillar 3)
 *
 * All timestamps are INJECTED — no Date.now() / Math.random() anywhere.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const mj = require('../../tools/cli/lib/memory-journal');

const T0 = '2026-07-01T10:00:00.000Z';
const T1 = '2026-07-01T11:00:00.000Z';
const T2 = '2026-07-01T12:00:00.000Z';

describe('memory-journal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-mj-'));
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── determinism contract ──────────────────────────────────────────────────

  describe('injected clock contract', () => {
    test('appendEvent throws without an injected ts', () => {
      expect(() => mj.appendEvent(tmpDir, { agent: 'forge' })).toThrow(/ts/);
    });

    test('appendEvent rejects an unparseable ts', () => {
      expect(() => mj.appendEvent(tmpDir, { ts: 'not-a-date', agent: 'forge' })).toThrow(/ts/);
    });

    test('proposePromotion throws without an injected ts', () => {
      expect(() => mj.proposePromotion({ patternId: 'p1' })).toThrow(/ts/);
    });

    test('event ids are deterministic (no Math.random)', () => {
      const a = mj.appendEvent(tmpDir, { ts: T0, agent: 'forge', task: 'same task' });
      const b = mj.appendEvent(tmpDir, { ts: T0, agent: 'forge', task: 'same task' });
      expect(a.id).toBe(b.id);
    });
  });

  // ── append + recall round-trip ────────────────────────────────────────────

  describe('appendEvent / readJournal', () => {
    test('round-trips a full event through .bmad/memory/journal.ndjson', () => {
      const event = {
        ts: T0,
        agent: 'seo-judge',
        cli: 'claude-code',
        model: 'claude',
        task: 'audit pagespeed regression on homepage',
        outcome: 'success',
        signals: { evalScore: 0.9, acceptance: true, ci: 'pass' },
        artifactHashes: ['abc123'],
      };
      const written = mj.appendEvent(tmpDir, event);

      const file = path.join(tmpDir, '.bmad', 'memory', 'journal.ndjson');
      expect(fs.existsSync(file)).toBe(true);

      const events = mj.readJournal(tmpDir);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(written);
      expect(events[0].signals.evalScore).toBe(0.9);
      expect(events[0].artifactHashes).toEqual(['abc123']);
    });

    test('validates outcome enum', () => {
      expect(() => mj.appendEvent(tmpDir, { ts: T0, agent: 'forge', outcome: 'meh' })).toThrow(
        /outcome/
      );
    });

    test('readJournal skips corrupt lines instead of throwing', () => {
      mj.appendEvent(tmpDir, { ts: T0, agent: 'forge', task: 'first' });
      const file = path.join(tmpDir, '.bmad', 'memory', 'journal.ndjson');
      fs.appendFileSync(file, '{torn write!!!\n', 'utf8');
      mj.appendEvent(tmpDir, { ts: T1, agent: 'forge', task: 'second' });

      const events = mj.readJournal(tmpDir);
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.task)).toEqual(['first', 'second']);
    });

    test('readJournal returns [] when no journal exists', () => {
      expect(mj.readJournal(tmpDir)).toEqual([]);
    });
  });

  describe('recall', () => {
    test('finds journal events by lexical match, ranked above non-matches', () => {
      mj.appendEvent(tmpDir, {
        ts: T0,
        agent: 'forge',
        task: 'refactor postgres connection pooling',
        outcome: 'success',
      });
      mj.appendEvent(tmpDir, {
        ts: T1,
        agent: 'sentinel',
        task: 'review css animations',
        outcome: 'partial',
      });

      const results = mj.recall('postgres pooling', { baseDir: tmpDir });
      expect(results.length).toBe(1);
      expect(results[0].kind).toBe('event');
      expect(results[0].event.agent).toBe('forge');
      expect(results[0].score).toBeGreaterThan(0);
    });

    test('reads human memory files from the .agents/memory layout (pack-memory reality)', () => {
      const memDir = path.join(tmpDir, '.agents', 'memory');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(
        path.join(memDir, 'decisions.md'),
        '# Decisions\n\n### 2026-06-01 — Use BullMQ for job queues\n- **Decision**: BullMQ over cron\n',
        'utf8'
      );

      const results = mj.recall('bullmq queues', { baseDir: tmpDir });
      expect(results.length).toBe(1);
      expect(results[0].kind).toBe('note');
      expect(results[0].source).toBe('decisions.md');
      expect(results[0].ref).toContain('BullMQ');
    });

    test('merges journal + human notes and respects limit', () => {
      mj.appendEvent(tmpDir, {
        ts: T0,
        agent: 'forge',
        task: 'chromadb ingestion pipeline',
        outcome: 'success',
      });
      const memDir = path.join(tmpDir, '.bmad', 'memory');
      fs.writeFileSync(
        path.join(memDir, 'patterns.md'),
        '### chromadb batch ingestion\n- **Shape**: batch upserts of 500 docs\n\n### unrelated pattern\n- **Shape**: nothing here\n',
        'utf8'
      );

      const all = mj.recall('chromadb ingestion', { baseDir: tmpDir });
      expect(all.length).toBe(2);
      const limited = mj.recall('chromadb ingestion', { baseDir: tmpDir, limit: 1 });
      expect(limited.length).toBe(1);
    });

    test('applies recency decay to journal events only when now is injected', () => {
      mj.appendEvent(tmpDir, {
        ts: '2026-01-01T00:00:00.000Z',
        agent: 'forge',
        task: 'docker compose networking fix',
      });
      mj.appendEvent(tmpDir, {
        ts: '2026-06-30T00:00:00.000Z',
        agent: 'forge',
        task: 'docker compose networking fix',
      });

      const decayed = mj.recall('docker compose networking', {
        baseDir: tmpDir,
        now: T2,
        halfLifeDays: 30,
      });
      expect(decayed).toHaveLength(2);
      // recent event must outrank the 6-month-old identical event
      expect(decayed[0].event.ts).toBe('2026-06-30T00:00:00.000Z');
      expect(decayed[0].score).toBeGreaterThan(decayed[1].score);

      // without injected now → identical scores (no hidden clock read)
      const flat = mj.recall('docker compose networking', { baseDir: tmpDir });
      expect(flat[0].score).toBe(flat[1].score);
    });

    test('portfolio scope pulls the portfolio brain memory files', () => {
      const brainDir = path.join(tmpDir, 'brain');
      fs.mkdirSync(path.join(brainDir, 'memory'), { recursive: true });
      fs.writeFileSync(
        path.join(brainDir, 'memory', 'lessons.md'),
        '### 2026-05-01 — Nextcloud sync conflicts\n- **Lesson**: never edit configs on two machines at once\n',
        'utf8'
      );

      const projectOnly = mj.recall('nextcloud sync', { baseDir: tmpDir });
      expect(projectOnly).toHaveLength(0);

      const portfolio = mj.recall('nextcloud sync', {
        baseDir: tmpDir,
        scope: 'portfolio',
        portfolioDir: brainDir,
      });
      expect(portfolio).toHaveLength(1);
      expect(portfolio[0].source).toBe('lessons.md');
    });

    test('delegates to an injected vector backend (ChromaDB seam)', () => {
      const backend = {
        search: jest
          .fn()
          .mockReturnValue([{ score: 0.99, kind: 'note', source: 'vector', ref: 'x', text: 'y' }]),
      };
      const results = mj.recall('anything at all', { baseDir: tmpDir, backend, limit: 3 });
      expect(backend.search).toHaveBeenCalledWith(
        'anything at all',
        expect.objectContaining({ baseDir: tmpDir, limit: 3 })
      );
      expect(results[0].source).toBe('vector');
    });

    test('rejects empty queries', () => {
      expect(() => mj.recall('', { baseDir: tmpDir })).toThrow(/query/);
    });
  });

  // ── reward math ───────────────────────────────────────────────────────────

  describe('computeReward', () => {
    test('full positive signals → 1', () => {
      expect(mj.computeReward({ evalScore: 1, acceptance: true, ci: 'pass' })).toBe(1);
    });

    test('full negative signals → 0', () => {
      expect(mj.computeReward({ evalScore: 0, acceptance: false, ci: 'fail' })).toBe(0);
    });

    test('weighted average with defaults (0.5/0.3/0.2)', () => {
      // 0.5*0.8 + 0.3*1 + 0.2*0 = 0.7
      expect(mj.computeReward({ evalScore: 0.8, acceptance: true, ci: 'fail' })).toBeCloseTo(
        0.7,
        10
      );
    });

    test('missing signals renormalize the remaining weights', () => {
      // only ci present → reward is exactly the ci value
      expect(mj.computeReward({ ci: 'pass' })).toBe(1);
      expect(mj.computeReward({ ci: 'fail' })).toBe(0);
      // eval + acceptance: (0.5*0.6 + 0.3*1) / 0.8 = 0.75
      expect(mj.computeReward({ evalScore: 0.6, acceptance: true })).toBeCloseTo(0.75, 10);
    });

    test('no signals → 0 (never NaN)', () => {
      expect(mj.computeReward({})).toBe(0);
      expect(mj.computeReward(null)).toBe(0);
    });

    test('out-of-range inputs are clamped', () => {
      expect(mj.computeReward({ evalScore: 42 })).toBe(1);
      expect(mj.computeReward({ evalScore: -3 })).toBe(0);
    });
  });

  describe('updatePatternScore', () => {
    test('Elo: fresh pattern at baseline, reward 1, K=32 → 1216', () => {
      const next = mj.updatePatternScore(null, 1, { ts: T0 });
      // expected vs 1200 baseline = 0.5 → 1200 + 32*(1 - 0.5) = 1216
      expect(next.elo).toBeCloseTo(1216, 10);
      expect(next.updates).toBe(1);
      expect(next.lastTs).toBe(T0);
    });

    test('Elo: reward 0 at baseline → 1184; gains shrink as rating climbs', () => {
      const down = mj.updatePatternScore(null, 0, { ts: T0 });
      expect(down.elo).toBeCloseTo(1184, 10);

      let s = mj.INITIAL_PATTERN_SCORE;
      s = mj.updatePatternScore(s, 1, { ts: T0 });
      const gain1 = s.elo - 1200;
      const s2 = mj.updatePatternScore(s, 1, { ts: T1 });
      const gain2 = s2.elo - s.elo;
      expect(gain2).toBeLessThan(gain1); // diminishing returns above baseline
    });

    test('Bayesian: posterior mean tracks rewards (decay=1 → plain Beta update)', () => {
      // start (1,1); reward 1 → (2,1) mean 2/3; reward 1 → (3,1) mean 3/4
      let s = mj.updatePatternScore(null, 1, { decay: 1, ts: T0 });
      expect(s.alpha).toBeCloseTo(2, 10);
      expect(s.beta).toBeCloseTo(1, 10);
      expect(s.mean).toBeCloseTo(2 / 3, 10);
      s = mj.updatePatternScore(s, 1, { decay: 1, ts: T1, halfLifeDays: Infinity });
      expect(s.mean).toBeCloseTo(3 / 4, 10);
    });

    test('Bayesian: per-update decay shrinks evidence toward the (1,1) prior', () => {
      // (alpha,beta) = (2,1) with decay 0.5 and reward 0:
      // alpha' = 1 + (2-1)*0.5 + 0 = 1.5 ; beta' = 1 + (1-1)*0.5 + 1 = 2
      const s1 = mj.updatePatternScore(null, 1, { decay: 1, ts: T0 });
      const s2 = mj.updatePatternScore(s1, 0, { decay: 0.5, ts: T1, halfLifeDays: Infinity });
      expect(s2.alpha).toBeCloseTo(1.5, 10);
      expect(s2.beta).toBeCloseTo(2, 10);
      expect(s2.mean).toBeCloseTo(1.5 / 3.5, 10);
    });

    test('time-based decay: one half-life halves the evidence before updating', () => {
      // build (2,1) at T0, then update 90 days later (halfLifeDays=90, decay=1, reward=1)
      const s1 = mj.updatePatternScore(null, 1, { decay: 1, ts: '2026-01-01T00:00:00.000Z' });
      const s2 = mj.updatePatternScore(s1, 1, {
        decay: 1,
        ts: '2026-04-01T00:00:00.000Z',
        halfLifeDays: 90,
      });
      // 2026-01-01 → 2026-04-01 is exactly 90 days: alpha decays 2 → 1.5, then +1 = 2.5
      expect(s2.alpha).toBeCloseTo(2.5, 10);
      expect(s2.beta).toBeCloseTo(1, 10);
    });

    test('is pure: does not mutate the input score', () => {
      const s1 = mj.updatePatternScore(null, 1, { ts: T0 });
      const frozen = Object.freeze({ ...s1 });
      expect(() => mj.updatePatternScore(frozen, 0.5, { ts: T1 })).not.toThrow();
      expect(s1.elo).toBeCloseTo(1216, 10);
    });

    test('rewards are clamped to [0,1]', () => {
      const hi = mj.updatePatternScore(null, 99, { ts: T0 });
      const one = mj.updatePatternScore(null, 1, { ts: T0 });
      expect(hi.elo).toBeCloseTo(one.elo, 10);
    });
  });

  // ── governance guard ──────────────────────────────────────────────────────

  describe('governance guard (promotions never auto-applied)', () => {
    test('proposePromotion always returns status PROPOSED, governed by shield', () => {
      const p = mj.proposePromotion({
        patternId: 'chromadb batch ingestion',
        ts: T0,
        reason: 'mean 0.82 over 12 events',
      });
      expect(p.status).toBe('PROPOSED');
      expect(p.governedBy).toBe('shield');
      expect(p.approvedBy).toBeNull();
      expect(p.fromStatus).toBe('candidate');
      expect(p.toStatus).toBe('validated');
      expect(p.id).toHaveLength(12);
    });

    test('appendPromotion forces status PROPOSED on disk even for tampered records', () => {
      const p = mj.proposePromotion({ patternId: 'p1', ts: T0 });
      const tampered = { ...p, status: 'APPROVED', approvedBy: 'evil-agent', approvedAt: T0 };
      const written = mj.appendPromotion(tmpDir, tampered);
      expect(written.status).toBe('PROPOSED');
      expect(written.approvedBy).toBeNull();

      const onDisk = mj.readPromotions(tmpDir);
      expect(onDisk).toHaveLength(1);
      expect(onDisk[0].status).toBe('PROPOSED');
      expect(onDisk[0].approvedBy).toBeNull();
    });

    test('assertPromotionApplicable throws for PROPOSED and for APPROVED-without-identity', () => {
      const p = mj.proposePromotion({ patternId: 'p1', ts: T0 });
      expect(() => mj.assertPromotionApplicable(p)).toThrow(/Governance guard/);
      expect(() => mj.assertPromotionApplicable({ ...p, status: 'APPROVED' })).toThrow(
        /approvedBy/
      );
    });

    test('assertPromotionApplicable passes only for a human-approved record', () => {
      const p = mj.proposePromotion({ patternId: 'p1', ts: T0 });
      const approved = { ...p, status: 'APPROVED', approvedBy: 'laurent', approvedAt: T1 };
      expect(mj.assertPromotionApplicable(approved)).toBe(true);
    });
  });
});
