/** Review run records: stop reasons, observed usage and the three-strikes rule. */
const review = require('../../tools/cli/lib/review');

const scope = {
  sha256: 's'.repeat(64),
  selected: [{ path: 'src/a.js' }, { path: 'src/b.js' }, { path: 'lib/c.js' }],
  units: [
    { id: 'u1', paths: ['lib/c.js'] },
    { id: 'u2', paths: ['src/a.js', 'src/b.js'] },
  ],
  plan: { passes: 2 },
};
const allCompleted = scope.selected.map((item) => ({ path: item.path, outcome: 'completed' }));
const coverage = (run, items = allCompleted) => ({
  schema: review.COVERAGE_SCHEMA,
  scopeSha256: scope.sha256,
  items,
  ...(run === undefined ? {} : { run }),
});
const findings = { schema: review.FINDINGS_SCHEMA, scopeSha256: scope.sha256, findings: [] };
const gate = (cov) =>
  review.reviewGate({ scope, findings, coverage: cov, anchored: { findings: [] } });
const done = (unit) => ({ unit, outcome: 'completed' });
const failed = (unit, reason = 'context overflow') => ({ unit, outcome: 'failed', reason });

describe('the run record', () => {
  it('is optional, and a finished run reports what it observed', () => {
    expect(gate(coverage()).status).toBe('clean');
    expect(gate(coverage()).usage).toBeNull();
    const verdict = gate(
      coverage({
        stop: 'completed',
        passes: 2,
        attempts: [done('u1'), failed('u2'), done('u2')],
        tokens: 48210,
        durationMs: 91000,
      })
    );
    expect(verdict.status).toBe('clean');
    expect(verdict.stop).toBe('completed');
    expect(verdict.usage).toEqual({
      passes: 2,
      plannedPasses: 2,
      units: 2,
      unitsAttempted: 2,
      attempts: 3,
      failedAttempts: 1,
      tokens: 48210,
      durationMs: 91000,
    });
  });

  it('keeps a review that stopped early incomplete, even with every file listed', () => {
    for (const stop of ['budget', 'time-limit', 'interrupted']) {
      const verdict = gate(
        coverage({ stop, detail: 'host limit reached', passes: 1, attempts: [] })
      );
      expect(verdict.status).toBe('incomplete');
      expect(verdict.reasons).toContain(
        `the review stopped before the end (${stop}): host limit reached`
      );
    }
  });

  it('refuses unknown stop reasons, a stop without its detail and estimated usage', () => {
    const errors = (run) => review.validateRun(run, scope, allCompleted);
    expect(errors({ stop: 'done', passes: 1, attempts: [] })[0]).toContain('stop "done"');
    expect(errors({ stop: 'budget', passes: 1, attempts: [] })[0]).toContain('says why in detail');
    expect(errors({ stop: 'completed', passes: 0, attempts: [] })[0]).toContain(
      'at least one pass'
    );
    expect(errors({ stop: 'completed', passes: 1, attempts: [], tokens: 1.5 })[0]).toContain(
      'tokens is a non-negative integer'
    );
    expect(errors({ stop: 'completed', passes: 1, attempts: [], cost: 3 })[0]).toContain(
      'unknown key "cost"'
    );
    expect(errors({ stop: 'completed', passes: 1 })[0]).toContain('attempts lists every');
    expect(
      errors({ stop: 'completed', passes: 1, attempts: [{ unit: 'u9', outcome: 'x' }] })
    ).toEqual([
      'run: attempt 1: unit "u9" is not in the scope',
      'run: attempt 1: outcome "x" is not one of completed|failed',
    ]);
    expect(
      errors({ stop: 'completed', passes: 1, attempts: [{ unit: 'u1', outcome: 'failed' }] })[0]
    ).toContain('a failed attempt needs a reason');
    // Free text is text: an object would reach the verdict as "[object Object]".
    expect(errors({ stop: 'budget', detail: { a: 1 }, passes: 1, attempts: [] })).toEqual([
      'run: detail is text',
    ]);
    expect(
      errors({
        stop: 'completed',
        passes: 1,
        attempts: [{ unit: 'u1', outcome: 'failed', reason: ['x'] }],
      })
    ).toEqual(['run: attempt 1: reason is text']);
  });

  it('abandons a unit after three consecutive failures and refuses a fourth attempt', () => {
    expect(review.strikeLedger([failed('u1'), failed('u1'), done('u1')]).exhausted.size).toBe(0);
    const ledger = review.strikeLedger([failed('u1'), failed('u1'), failed('u1'), done('u1')]);
    expect([...ledger.exhausted]).toEqual(['u1']);
    expect(ledger.violations).toEqual([{ index: 3, unit: 'u1' }]);

    const items = [
      { path: 'lib/c.js', outcome: 'failed', reason: 'three failed attempts' },
      { path: 'src/a.js', outcome: 'completed' },
      { path: 'src/b.js', outcome: 'completed' },
    ];
    const struck = gate(
      coverage(
        {
          stop: 'failure-streak',
          detail: 'u1 failed three times',
          passes: 1,
          attempts: [failed('u1'), done('u2'), failed('u1'), failed('u1')],
        },
        items
      )
    );
    expect(struck.status).toBe('incomplete');
    expect(struck.reasons).toContain('unit u1 abandoned after 3 consecutive failed attempts');

    const retried = review.validateRun(
      {
        stop: 'completed',
        passes: 1,
        attempts: [failed('u1'), failed('u1'), failed('u1'), done('u1'), done('u2')],
      },
      scope,
      allCompleted
    );
    expect(retried).toContain(
      'run: attempt 4 retries unit u1 after 3 consecutive failures — it is abandoned in this review'
    );
    expect(
      review.validateRun(
        { stop: 'failure-streak', detail: 'x', passes: 1, attempts: [failed('u1')] },
        scope,
        items
      )
    ).toContain('run: failure-streak needs a unit with 3 consecutive failed attempts');
  });

  it('refuses a file marked completed when the attempt log never completed its unit', () => {
    const errors = review.validateRun(
      { stop: 'completed', passes: 1, attempts: [done('u2'), failed('u1')] },
      scope,
      allCompleted
    );
    expect(errors).toEqual([
      'lib/c.js: completed in coverage, but unit u1 was not completed — as a whole or in every rule group',
    ]);
    expect(gate(coverage({ stop: 'completed', passes: 1, attempts: [done('u2')] })).status).toBe(
      'incomplete'
    );
  });
});

describe('reviewers split by rule group', () => {
  const grouped = {
    ...scope,
    units: [
      {
        id: 'u1',
        paths: ['lib/c.js'],
        rules: ['general', 'sql-and-migrations'],
        groups: [
          { id: 'code', rules: ['general'] },
          { id: 'data', rules: ['sql-and-migrations'] },
        ],
      },
      {
        id: 'u2',
        paths: ['src/a.js', 'src/b.js'],
        rules: ['general'],
        groups: [{ id: 'code', rules: ['general'] }],
      },
    ],
  };
  const byGroup = (unit, group, outcome = 'completed') => ({
    unit,
    group,
    outcome,
    ...(outcome === 'failed' ? { reason: 'the reviewer timed out' } : {}),
  });
  const check = (attempts) =>
    review.validateRun({ stop: 'completed', passes: 1, attempts }, grouped, allCompleted);

  it('completes a unit only when every rule group of it completed, or the unit as a whole', () => {
    expect(check([byGroup('u1', 'code'), byGroup('u1', 'data'), done('u2')])).toEqual([]);
    expect(check([byGroup('u1', 'code'), done('u2')])).toEqual([
      'lib/c.js: completed in coverage, but unit u1 was not completed — as a whole or in every rule group',
    ]);
    expect(check([done('u1'), byGroup('u2', 'code')])).toEqual([]);
    expect(check([byGroup('u2', 'data')])[0]).toBe(
      'run: attempt 1: group "data" is not a rule group of unit u2'
    );
  });

  it('counts strikes per group, and an exhausted group blocks its whole unit', () => {
    const strikes = [1, 2, 3].map(() => byGroup('u1', 'data', 'failed'));
    const ledger = review.strikeLedger([...strikes, byGroup('u1', 'code'), done('u1')]);
    expect([...ledger.exhausted]).toEqual(['u1/data']);
    expect([...ledger.units]).toEqual(['u1']);
    expect(ledger.violations).toEqual([{ index: 4, unit: 'u1' }]);

    const packet = review.remainingWork({
      scope: grouped,
      coverage: {
        items: [
          { path: 'src/a.js', outcome: 'completed' },
          { path: 'lib/c.js', outcome: 'failed', reason: 'data group failed three times' },
        ],
        run: { stop: 'interrupted', detail: 'x', passes: 1, attempts: [...strikes, done('u2')] },
      },
    });
    expect(packet.abandoned).toEqual([{ path: 'lib/c.js', unit: 'u1', state: 'failed' }]);
    expect(packet.units).toEqual([
      {
        id: 'u2',
        paths: ['src/b.js'],
        rules: ['general'],
        groups: [{ id: 'code', rules: ['general'] }],
      },
    ]);
  });

  it('hands out only the rule groups not yet completed', () => {
    const packet = review.remainingWork({
      scope: grouped,
      coverage: {
        items: [
          { path: 'src/a.js', outcome: 'completed' },
          { path: 'src/b.js', outcome: 'completed' },
        ],
        run: {
          stop: 'time-limit',
          detail: 'x',
          passes: 1,
          attempts: [byGroup('u1', 'code'), done('u2')],
        },
      },
    });
    expect(packet.units).toEqual([
      {
        id: 'u1',
        paths: ['lib/c.js'],
        rules: ['general', 'sql-and-migrations'],
        groups: [{ id: 'data', rules: ['sql-and-migrations'] }],
      },
    ]);
  });
});
