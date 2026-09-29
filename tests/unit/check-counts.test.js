/**
 * BMAD+ Build — hand-typed count drift checker tests
 *
 * Proves that tools/build/check-counts.js:
 *   - derives every count it enforces from registry.yaml + the files on disk,
 *   - catches a claim wearing ANY run of qualifiers ("38 expert compliance
 *     agents"), any markdown dressing, and any approximation hedge,
 *   - asserts every derived count it computes (roster, languages, packs,
 *     workflows, frameworks) instead of computing some of them for decoration,
 *   - does NOT fire on agent identifiers (`iso27001-agent`), on a count that
 *     belongs to another dimension ("11 workflow agents"), or on the upstream
 *     project's own agent count,
 *   - gates the test-count claim only when BMAD_PLUS_TEST_COUNT is armed.
 *
 * The regression this file exists for: AGENTS_RE once allowed exactly ONE
 * optional qualifier, so `**38 expert compliance agents**` shipped in
 * pack-shield/README.md while the gate reported OK. The table below is the
 * contract — a future regex tweak that reopens the blind spot fails here.
 *
 * Run: npx jest tests/unit/check-counts.test.js
 */

const fs = require('node:fs');
const path = require('node:path');
const counts = require('../../tools/build/check-counts');

const truth = counts.deriveTruth();
const checkLine = (line, opts) => counts.checkLine(line, truth, opts);

describe('derivation from registry.yaml + files on disk', () => {
  test('the registry and the on-disk pack agree (otherwise nothing below is trustworthy)', () => {
    expect(truth.derivationMismatches).toEqual([]);
  });

  test('shield agents and workflows are separate dimensions, never summed', () => {
    expect(truth.shieldAgents).toBe(27);
    expect(truth.shieldWorkflows).toBe(11);
    // 38 is the sum that caused the bug. It must not be an agent count.
    expect(truth.agentCounts.has(truth.shieldAgents + truth.shieldWorkflows)).toBe(false);
  });

  test('totalAgents is the sum of the three rosters, not a hand-typed number', () => {
    expect(truth.totalAgents).toBe(
      truth.installerAgents + truth.shieldAgents + truth.devStudioSubAgents
    );
    expect(truth.agentCounts.has(truth.totalAgents)).toBe(true);
  });

  test('languages come from the CLI i18n module', () => {
    const { LANGUAGES } = require('../../tools/cli/i18n.js');
    expect(truth.languages).toEqual(Object.keys(LANGUAGES));
  });
});

/* ── B3: the gate must catch its own motivating example ─────────────────── */

describe('a Shield agent-count lie is caught through any amount of dressing', () => {
  // Every entry states 38 (= 27 agents + 11 workflows) against the agent
  // dimension. All must fail; the middle rows are the ones the old regex missed.
  const lies = [
    '38 agents',
    '38 compliance agents',
    '38 GRC agents',
    '38 expert compliance agents', // <- shipped in pack-shield/README.md
    '38 specialized compliance agents',
    '38 expert GRC compliance agents',
    '38 world-class expert compliance agents',
    '**38** compliance agents',
    '**38 expert compliance agents**',
    '`38` agents',
    '38 Compliance-Agenten',
    '38 expert Compliance-Agenten',
    '38 agentes de cumplimiento',
  ];

  test.each(lies)('Shield — %s', (claim) => {
    const problems = checkLine(`> **Shield** — ${claim} covering GDPR, ISO 27001`);
    expect(problems).not.toEqual([]);
    expect(problems.join('\n')).toContain(`Shield has ${truth.shieldAgents} compliance agents`);
  });

  test('the conflation is named in the message, not just flagged', () => {
    expect(checkLine('Shield — 38 expert compliance agents').join('\n')).toContain(
      '27 agents + 11 workflows conflated into one "agents" figure'
    );
  });

  // The exotic spaces are built from escapes on purpose: a literal U+00A0 in
  // this file is one "helpful" editor normalization away from silently becoming
  // a plain space, which would turn the assertion into a tautology.
  const NBSP = '\u00a0'; // no-break space
  const NNBSP = '\u202f'; // narrow no-break space, used by the French copy

  test.each([
    ['U+00A0 before the noun', `Shield - 38${NBSP}compliance agents`],
    ['U+202F before the noun', `Shield - 38${NNBSP}compliance agents`],
    ['U+00A0 between two qualifiers', `Shield - 38 expert${NBSP}compliance agents`],
    ['U+00A0 straight after the number', `Shield - 38${NBSP}agents`],
  ])('a %s does not smuggle the lie through', (_name, claim) => {
    // \s already covers U+00A0/U+202F. Pinned so that nobody
    // "simplifies" \s into a literal space and reopens the hole.
    expect(claim).toMatch(new RegExp(`[${NBSP}${NNBSP}]`)); // guard: it really is exotic
    expect(checkLine(claim)).not.toEqual([]);
  });
});

describe('approximation hedges on an exact roster', () => {
  test.each([
    '47+ agents',
    'over 47 agents',
    'more than 47 agents',
    'nearly 47 agents',
    'up to 47 agents',
    '~47 agents',
    'plus de 47 agents',
  ])('BMAD+ ships %s', (claim) => {
    expect(checkLine(`BMAD+ ships ${claim}`).join('\n')).toContain(
      'agent totals are exact and derivable, not approximate'
    );
  });

  test('the exact same number without the hedge is fine', () => {
    expect(checkLine(`BMAD+ ships ${truth.totalAgents} agents`)).toEqual([]);
  });
});

/* ── B4: every derived count is asserted ────────────────────────────────── */

describe('the roster total is asserted, not just computed', () => {
  test('a number nobody can derive is drift', () => {
    expect(checkLine('BMAD+ ships 999 agents across 9 packs').join('\n')).toContain(
      'no derived agent count equals 999'
    );
  });

  test('the tracked "47 agents" claims are gated: they fail if the roster moves', () => {
    // This is the whole point of asserting totalAgents. Simulate one more
    // installer agent and every "47 agents" line in the repo must turn red.
    const moved = { ...truth, totalAgents: 48, agentCounts: new Set([...truth.agentCounts]) };
    moved.agentCounts.delete(47);
    moved.agentCounts.add(48);
    expect(counts.checkLine('BMAD+ — 47 agents across 9 packs', moved)).not.toEqual([]);
    expect(counts.checkLine('BMAD+ — 48 agents across 9 packs', moved)).toEqual([]);
  });

  test.each([
    ['installerAgents', truth.installerAgents],
    ['shieldAgents', truth.shieldAgents],
    ['devStudioSubAgents', truth.devStudioSubAgents],
    ['totalAgents', truth.totalAgents],
  ])('%s (%i) is a legitimate agent count', (_name, value) => {
    expect(truth.agentCounts.has(value)).toBe(true);
  });
});

describe('the language count is asserted', () => {
  const n = truth.languages.length;

  test.each([
    `CLI installer in ${n + 1} languages`,
    `Installateur CLI en ${n + 1} langues`,
    `Instalador CLI en ${n + 1} idiomas`,
    `CLI-Installer in ${n + 1} Sprachen`,
  ])('%s is drift', (claim) => {
    expect(checkLine(claim).join('\n')).toContain(`${n} languages`);
  });

  test.each([`${n}+ languages`, `more than ${n} languages`, `over ${n} langues`])(
    '%s is drift even though the number is right — the count is exact',
    (claim) => {
      // "10+ languages" (>= 10) is true of 10 and "more than 10 languages"
      // (> 10) is false of 10. Rather than adjudicate hedge arithmetic, a
      // derivable count is simply stated.
      expect(checkLine(claim).join('\n')).toContain('exact and derivable');
    }
  );

  test('the true count in every localized wording is green', () => {
    for (const claim of [
      `CLI installer in ${n} languages`,
      `Installateur CLI en ${n} langues`,
      `Instalador CLI en ${n} idiomas`,
      `CLI-Installer in ${n} Sprachen`,
    ]) {
      expect(checkLine(claim)).toEqual([]);
    }
  });
});

describe('packs, workflows and frameworks are asserted', () => {
  test('a wrong pack count is drift', () => {
    expect(checkLine('BMAD+ has 12 packs').join('\n')).toContain(
      `the registry declares ${truth.packCount} packs`
    );
    expect(checkLine(`BMAD+ has ${truth.packCount} modular packs`)).toEqual([]);
  });

  test('an unanchored workflow total must still be a real one', () => {
    // The live defect this catches: a pack description whose own name sits on
    // the line above it, so no anchor fires on the claim's line.
    expect(
      checkLine('"6 specialized agents + 30 workflows covering Analysis"').join('\n')
    ).toContain('no pack has 30 workflows');
    expect(checkLine('"6 specialized agents + 38 workflows covering Analysis"')).toEqual([]);
  });

  test('an anchored workflow total is graded against the pack it names', () => {
    expect(checkLine('Dev Studio — 30 workflows').join('\n')).toContain(
      `Dev Studio has ${truth.devStudioWorkflows} workflows`
    );
    expect(checkLine('Shield GRC — 38 workflows').join('\n')).toContain(
      `Shield has ${truth.shieldWorkflows} workflows`
    );
  });

  test('frameworks are gated as a lower bound: overclaims fail, honest hedges pass', () => {
    expect(
      checkLine(`Shield covers ${truth.shieldFrameworks + 5}+ frameworks`).join('\n')
    ).toContain(`Shield tags ${truth.shieldFrameworks} compliance frameworks`);
    expect(checkLine('Shield covers 25+ regulatory frameworks')).toEqual([]);
    expect(checkLine('### AI Governance (3 frameworks)')).toEqual([]);
  });
});

/* ── The rules that keep the gate honest (no false positives) ───────────── */

describe('claims that must NOT fire', () => {
  test.each([
    // Agent identifiers: the digits belong to a standard's number, not a count.
    '| `iso27001-agent` | ISO/IEC 27001 ISMS | International |',
    '| `iso27701-agent` | ISO/IEC 27701 PIMS | International |',
    '| `nist-800-53-agent` | NIST SP 800-53 Rev. 5 | US Federal |',
    '| `section508-agent` | Section 508 | US Federal |',
    '| `iso42001-agent` | ISO/IEC 42001:2023 | International |',
    '| `soc2-agent` | SOC 2 Type I/II | US |',
    // Per-category group sizes are legitimate wherever a category is described.
    '### 🔐 Data Privacy (5 agents)',
    '### 🛡️ Cybersecurity (6 agents)',
    '### 🔒 Defense & Export Control (4 agents)',
    '### 🤖 AI Governance (3 agents)',
    // Per-pack installer rosters.
    'Core — 4 multi-role agents',
    'SEO Engine — 3 agents (Scout, Chief, Judge), 6 phases',
    // Real lines from the truth surfaces.
    'Shield GRC — 27 agents de conformité + 11 workflows (GDPR, ISO 27001)',
    '🏗️ Dev Studio — 6 agents + 38 workflows SDLC complet',
    '- **Shield** (GRC) — 27 compliance agents + 11 workflows',
    '27 GRC-Compliance-Agenten + 11 Workflows',
    '| 🛡️ **Shield** | 27 GRC agents + 11 workflows | GRC acronyms |',
    'EU AI Act — 25+ frameworks | 27 agents + 11 workflows (Shield Pack)',
  ])('green: %s', (line) => {
    expect(checkLine(line)).toEqual([]);
  });

  test('a count belonging to another dimension is read as that dimension', () => {
    // "11 workflow agents" is a WORKFLOW count (11 == shieldWorkflows). Reading
    // it as an agent count is exactly the arithmetic that produced 38, so the
    // qualifier run must stop at a dimension noun rather than skip over it.
    expect(checkLine('### GDPR & AI Act Workflows (11 workflow agents)')).toEqual([]);
    expect(checkLine('You understand 25+ compliance frameworks and 11 workflow agents.')).toEqual(
      []
    );
    // ...and it is still graded: a wrong workflow number in that shape fails.
    expect(checkLine('Shield — 30 workflow agents')).not.toEqual([]);
  });

  test('a qualifier run cannot walk across a sentence and invent a claim', () => {
    expect(checkLine('5 reasons why you should hire agents')).toEqual([]);
    expect(checkLine('9 packs and 27 agents')).toEqual([]);
  });

  test.each(['Section508 agents', 'ISO27701 agentes', 'the iso42001 agents list'])(
    'a digit welded into a word is not a count: %s',
    (line) => {
      expect(checkLine(line)).toEqual([]);
    }
  );

  test('a standalone number IS a count, even one that looks like a standard', () => {
    // The counterpart to the case above: `iso27001-agent` is an identifier, but
    // "27001 agents" with the number as its own token is a claim, and a wrong one.
    expect(checkLine('The 27001 agents of ISO fame')).not.toEqual([]);
  });

  test('"E2E tests" is not a claim of "2 tests"', () => {
    // Caught by this suite on its first run: the qualifier run bridged the
    // stray "2" of "E2E" through the "E" into a claim of "2 tests", so every
    // README mentioning E2E tests drifted. The repo really does contain those
    // lines, so this asserts against the live scan rather than a fixture.
    const armed = counts.check({ testCount: 360 });
    expect(armed.drifts.join('\n')).not.toMatch(/2E/i);
    const unarmed = counts.check({ testCount: null });
    expect(unarmed.unverified.join('\n')).not.toMatch(/2E/i);
  });
});

describe('the upstream comparison is not our claim', () => {
  const row = '| 9 specialized agents | **47 agents** across 9 packs |';

  test('a foreign-subject line does not have its agent count graded as ours', () => {
    expect(checkLine('BMAD-METHOD is a great framework with 9 specialized agents.')).not.toEqual(
      []
    );
    expect(
      checkLine('BMAD-METHOD is a great framework with 9 specialized agents.', {
        foreignSubject: true,
      })
    ).toEqual([]);
  });

  test('the skip is load-bearing: without it the comparison row is a false positive', () => {
    expect(checkLine(row)).not.toEqual([]);
    expect(checkLine(row, { foreignSubject: true })).toEqual([]);
  });

  test('the skip is scoped to agents only — a foreign line still gates its own claims', () => {
    // README.es.md:12 names BMAD-METHOD and claims a language count in the same
    // breath. The language claim must stay gated.
    const line = `Fork inteligente de [BMAD-METHOD](x) — instalador CLI en ${truth.languages.length + 1} idiomas.`;
    expect(checkLine(line, { foreignSubject: true }).join('\n')).toContain('languages');
  });
});

describe('frozen history rows', () => {
  test('a release row states what a past version really shipped', () => {
    expect(counts.isFrozenHistoryRow('| **0.6.0** | 2026-05-17 | 30 workflows, 333 tests |')).toBe(
      true
    );
    expect(counts.isFrozenHistoryRow('| 🛡️ **Shield** | 27 agents |')).toBe(false);
  });
});

/* ── B5: the test-count rule ────────────────────────────────────────────── */

describe('BMAD_PLUS_TEST_COUNT arming', () => {
  test.each([
    [undefined, { armed: false, testCount: null }],
    ['', { armed: false, testCount: null }],
    ['   ', { armed: false, testCount: null }],
    ['360', { armed: true, testCount: 360 }],
    [' 360 ', { armed: true, testCount: 360 }],
    ['0', { armed: true, testCount: 0 }],
  ])('%p → %p', (raw, expected) => {
    const { armed, testCount, error } = counts.readTestCountEnv(raw);
    expect({ armed, testCount }).toEqual(expected);
    expect(error).toBeNull();
  });

  test.each(['abc', '-1', '3.5', '1e3', '360 tests'])('%p is rejected, not coerced', (raw) => {
    // Number(" ") === 0 and Number("-1") is an integer: a bare Number()+isInteger
    // check would gate the README against a garbage total.
    const { error, testCount } = counts.readTestCountEnv(raw);
    expect(error).toMatch(/non-negative integer/);
    expect(testCount).toBeNull();
  });

  test('unarmed: test claims are reported unverified and never fail the run', () => {
    const result = counts.check({ testCount: null });
    expect(result.unverified.length).toBeGreaterThan(0);
    expect(result.drifts.join('\n')).not.toMatch(/tests/);
  });

  test('armed with the true total: the same claims pass and nothing is left unverified', () => {
    const unarmed = counts.check({ testCount: null });
    // Derive the number the README actually claims, then arm the rule with it.
    const claimed = Number(unarmed.unverified[0].match(/"(\d+)/)[1]);
    const result = counts.check({ testCount: claimed });
    expect(result.unverified).toEqual([]);
    expect(result.drifts.join('\n')).not.toMatch(/the suite reports/);
  });

  test('armed with a different total: every test claim is drift', () => {
    const unarmed = counts.check({ testCount: null });
    const claimed = Number(unarmed.unverified[0].match(/"(\d+)/)[1]);
    const result = counts.check({ testCount: claimed + 1 });
    expect(result.ok).toBe(false);
    expect(result.drifts.join('\n')).toContain(`the suite reports ${claimed + 1} tests`);
  });
});

/* ── Scan surface & CLI ─────────────────────────────────────────────────── */

describe('truth surfaces', () => {
  test('every declared surface exists on disk', () => {
    for (const file of counts.TRUTH_SURFACES) {
      expect(fs.existsSync(path.join(counts.REPO_ROOT, file))).toBe(true);
    }
  });

  test('the pack that motivated the gate is scanned', () => {
    // The 38-agent lie shipped from pack-shield/README.md. A gate that derives
    // Shield's truth but never reads Shield's own README is theatre.
    expect(counts.TRUTH_SURFACES).toContain('src/bmad-plus/packs/pack-shield/README.md');
    expect(counts.trackedTruthSurfaces()).toContain('src/bmad-plus/packs/pack-shield/README.md');
  });

  test('the lie that shipped is caught against the real file it shipped from', () => {
    // Proof that the surface list, the scanner and the rules compose, done in
    // memory: this replays check()'s per-line loop over the REAL contents of
    // pack-shield/README.md with the exact string that shipped appended.
    // Deliberately not written to disk — the repo file is shared, and a test
    // that mutates it races anyone else editing and leaves the tree dirty if it
    // throws.
    const rel = 'src/bmad-plus/packs/pack-shield/README.md';
    const lines = fs.readFileSync(path.join(counts.REPO_ROOT, rel), 'utf8').split(/\r?\n/);
    const lie = '> **38 expert compliance agents** + 1 orchestrator covering Data Privacy.';

    const drifts = [...lines, lie]
      .filter((l) => !counts.isFrozenHistoryRow(l))
      .flatMap((l) => checkLine(l));

    expect(drifts.join('\n')).toContain('Shield has 27 compliance agents');
    // ...and the file as it currently stands contributes nothing to that.
    expect(lines.filter((l) => !counts.isFrozenHistoryRow(l)).flatMap((l) => checkLine(l))).toEqual(
      []
    );
  });
});

describe('CLI', () => {
  const silence = () => ({
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  });

  test('--print emits the derived facts as JSON, with the sets expanded', () => {
    const spies = silence();
    try {
      expect(counts.main(['node', 'x', '--print'])).toBe(0);
      const facts = JSON.parse(spies.log.mock.calls[0][0]);
      expect(facts.totalAgents).toBe(truth.totalAgents);
      expect(facts.agentCounts).toContain(truth.shieldAgents);
      expect(facts.languages).toEqual(truth.languages);
      expect(facts.derivationMismatches).toBeUndefined();
    } finally {
      Object.values(spies).forEach((s) => s.mockRestore());
    }
  });

  test('an unarmed run says so loudly, whether the rest of the gate is green or red', () => {
    // Asserted across all three streams and independent of the tree's verdict:
    // the notice must survive a red run too, or a drift elsewhere would bury
    // the fact that the test claims went unchecked on top of it.
    const spies = silence();
    const saved = process.env.BMAD_PLUS_TEST_COUNT;
    delete process.env.BMAD_PLUS_TEST_COUNT;
    try {
      const code = counts.main(['node', 'x']);
      const out = [...spies.log.mock.calls, ...spies.warn.mock.calls, ...spies.error.mock.calls]
        .flat()
        .join('\n');
      expect(out).toContain('NOT GATED');
      expect(out).toContain('BMAD_PLUS_TEST_COUNT=<total>');
      // A reader must not be able to mistake this run for full coverage.
      expect(out).toMatch(/OK \(PARTIAL\)|COUNT DRIFT/);
      expect(out).not.toMatch(/^OK — no count drift/m);
      expect([0, 1]).toContain(code);
    } finally {
      if (saved !== undefined) process.env.BMAD_PLUS_TEST_COUNT = saved;
      Object.values(spies).forEach((s) => s.mockRestore());
    }
  });

  describe('--jest-report arming', () => {
    const os = require('node:os');
    let dir;
    const report = (value) => {
      const file = path.join(dir, 'jest-report.json');
      fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
      return file;
    };
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-check-counts-'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    test('arms from numTotalTests when the environment is unset', () => {
      const file = report({ numTotalTests: 1234 });
      expect(counts.resolveTestCount(['--jest-report', file], {})).toEqual({
        armed: true,
        testCount: 1234,
        error: null,
      });
    });

    test('the environment wins over the report, so CI behavior is unchanged', () => {
      const file = report({ numTotalTests: 1 });
      expect(
        counts.resolveTestCount(['--jest-report', file], { BMAD_PLUS_TEST_COUNT: '42' }).testCount
      ).toBe(42);
    });

    test('no flag stays unarmed: a report on disk is never read implicitly', () => {
      expect(counts.resolveTestCount([], {})).toEqual({
        armed: false,
        testCount: null,
        error: null,
      });
    });

    test.each([
      ['missing file', null],
      ['invalid JSON', '{not json'],
      ['non-integer total', { numTotalTests: '12' }],
      ['absent total', {}],
    ])('%s fails instead of passing unarmed', (_name, content) => {
      const file = content === null ? path.join(dir, 'absent.json') : report(content);
      const result = counts.resolveTestCount(['--jest-report', file], {});
      expect(result.armed).toBe(true);
      expect(result.testCount).toBeNull();
      expect(result.error).toMatch(/--jest-report/);
    });

    test('a flag without a path is an error', () => {
      expect(counts.resolveTestCount(['--jest-report'], {}).error).toMatch(/needs a file path/);
    });
  });

  test('a garbage BMAD_PLUS_TEST_COUNT fails the run', () => {
    const spies = silence();
    const saved = process.env.BMAD_PLUS_TEST_COUNT;
    process.env.BMAD_PLUS_TEST_COUNT = 'not-a-number';
    try {
      expect(counts.main(['node', 'x'])).toBe(1);
      expect(spies.error.mock.calls.flat().join('\n')).toMatch(/non-negative integer/);
    } finally {
      if (saved === undefined) delete process.env.BMAD_PLUS_TEST_COUNT;
      else process.env.BMAD_PLUS_TEST_COUNT = saved;
      Object.values(spies).forEach((s) => s.mockRestore());
    }
  });
});

describe('residual count escape classes', () => {
  test('a connective within qualifiers does not discard the count', () => {
    expect(checkLine('Shield — 38 compliance and governance agents').join('\n')).toContain(
      '27 compliance agents'
    );
  });

  test('comparison tables grade the BMAD+ cell independently', () => {
    const problems = checkLine('| 9 specialized agents | 999 agents |', {
      foreignSubject: true,
    }).join('\n');
    expect(problems).toContain('999');
    expect(problems).not.toContain('equals 9 ');
  });

  test('hyphenated counts are claims, embedded standard identifiers are not', () => {
    expect(checkLine('12-language CLI installer').join('\n')).toContain('10 languages');
    expect(checkLine('nist-800-53-agent and iso27001-agent')).toEqual([]);
  });

  test('long adjective runs cannot pad a false count past the qualifier bound', () => {
    expect(
      checkLine('Shield — 38 world-class expert senior compliance GRC agents').join('\n')
    ).toContain('27 compliance agents');
  });

  test('reference files are a derived, exact dimension', () => {
    expect(checkLine('85 regulatory reference files').join('\n')).toContain('79 reference files');
    expect(checkLine('79 regulatory reference files')).toEqual([]);
  });
});
