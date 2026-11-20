#!/usr/bin/env node
/**
 * BMAD+ Build — hand-typed count drift checker (audit NS-01 / ARCH-04 / DOC-06)
 *
 * Every "N agents" / "N workflows" / "N packs" claim in a shipped surface is a
 * fact that MUST be derivable from registry.yaml (+ the files on disk). This
 * script derives the truth, scans the tracked truth surfaces for hand-typed
 * numbers that contradict it, and exits non-zero listing every drift.
 *
 * Why this exists: `- **Shield** (GRC) — 38 compliance agents` shipped into
 * every generated user config for months. 38 was not a typo — it was
 * 27 agents + 11 workflows summed into one dimension. A definition error
 * re-drifts on every pack change, so it needs a gate, not a one-off correction.
 *
 * DIMENSIONS ARE THE POINT. 38 is a legitimate number in this repo (Dev Studio
 * has 38 workflows); it is only wrong when attached to `agents`. Every rule
 * below therefore checks a (subject, dimension) pair, never a bare integer.
 *
 * Usage:
 *   node tools/build/check-counts.js            # verify (exit 1 on drift)
 *   node tools/build/check-counts.js --print    # print the derived truth and exit 0
 *
 * The test-count claim ("N tests") is the one number here that cannot be
 * derived statically — it requires running Jest. So it is gated by an env var:
 *
 *   BMAD_PLUS_TEST_COUNT unset/empty  → test claims are listed as NOT GATED and
 *                                       the run says OK (PARTIAL). Never fails:
 *                                       a local `node tools/build/check-counts.js`
 *                                       must not need a full Jest run first.
 *   BMAD_PLUS_TEST_COUNT=<integer>    → every "N tests" claim must equal it.
 *                                       CI arms this with the Jest-reported
 *                                       total, which is the only run that
 *                                       proves the README's test number.
 *   BMAD_PLUS_TEST_COUNT=<garbage>    → exit 1. A misspelled total must not
 *                                       masquerade as coverage.
 *
 * Local arming without hand-typing the total: `--jest-report <file>` reads
 * numTotalTests from a Jest JSON report (`jest --json --outputFile=<file>`),
 * exactly as CI derives it. `npm run check:counts:full` does both in one step.
 * It is an explicit flag, never an implicit default path, so a stale report
 * left on disk can never silently arm (or mis-arm) a plain run. When
 * BMAD_PLUS_TEST_COUNT is also set, the environment wins — CI is unchanged.
 * An unreadable report, or one without an integer total, exits 1.
 *
 * Author: Laurent Rochetta
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadRegistry, buildDerived, DEFAULT_REGISTRY_PATH } = require('./generate');

const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * Files whose numeric claims describe the CURRENT product. Anything not listed
 * is out of scope by construction, so the gate can never be "fixed" by quietly
 * moving a lie into an unscanned file — adding a surface is an explicit edit.
 */
const TRUTH_SURFACES = [
  'README.md',
  'README-DIST.md',
  'readme-international/README.fr.md',
  'readme-international/README.es.md',
  'readme-international/README.de.md',
  'src/bmad-plus/module.yaml',
  'src/bmad-plus/packs/pack-shield/README.md',
  'src/bmad-plus/packs/pack-shield/SKILL.md',
  'src/bmad-plus/packs/pack-shield/shield-orchestrator.md',
  'tools/cli/lib/ide-config.js',
  'tools/build/adapters.config.js',
];

/**
 * NOT scanned, deliberately:
 *   - CHANGELOG.md, audit/**, docs/research/** — historical records. They
 *     legitimately quote past and *wrong* numbers ("the advertised 38 agents")
 *     verbatim; gating them would force rewriting history to satisfy a linter.
 *   - .agents/** — gitignored local install output, not a source.
 *   - upstream/** — third-party clone.
 * Release-history table rows inside a scanned README are skipped for the same
 * reason (see isFrozenHistoryRow): v0.6.0 really did ship 30 workflows and
 * v0.12.0 really did ship 333 tests. Those are true statements about the past.
 */
const HISTORY_ROW_RE = /^\|\s*\*\*\d+\.\d+\.\d+\*\*\s*\|/;

function isFrozenHistoryRow(line) {
  return HISTORY_ROW_RE.test(line);
}

/* ── Derivation ─────────────────────────────────────────────────────────── */

/** Count *.md agent files on disk for a packaged pack's categories/ tree. */
function countAgentFilesOnDisk(packDir) {
  const root = path.join(REPO_ROOT, 'src', 'bmad-plus', 'packs', packDir, 'categories');
  if (!fs.existsSync(root)) return null;
  let n = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    // `workflows/` sits under categories/ but is NOT an agent category — it is
    // the directory whose 11 files got summed into the agent total to make 38.
    if (!entry.isDirectory() || entry.name === 'workflows') continue;
    n += fs.readdirSync(path.join(root, entry.name)).filter((f) => f.endsWith('.md')).length;
  }
  return n;
}

/** Count *.md workflow files on disk for a packaged pack. */
function countWorkflowFilesOnDisk(packDir) {
  const dir = path.join(REPO_ROOT, 'src', 'bmad-plus', 'packs', packDir, 'categories', 'workflows');
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
}

/**
 * Derive every count this gate enforces, from registry.yaml + the filesystem.
 * Cross-checks the registry against the files on disk: if they disagree, the
 * derivation itself is untrustworthy and that is reported as a drift.
 */
function deriveTruth(registryPath = DEFAULT_REGISTRY_PATH, options = {}) {
  const registry = typeof registryPath === 'string' ? loadRegistry(registryPath) : registryPath;
  const derived = buildDerived(registry, options);
  const packs = derived.packs;
  const shield = packs.shield;
  const devStudio = packs['dev-studio'];
  const { installerAgents, totalAgents } = derived;
  const shieldAgents = shield.categoryAgentCount;
  const shieldWorkflows = shield.workflowCount;
  const shieldCategories = shield.categoryCount;
  const shieldFrameworks = shield.frameworkCount;
  const devStudioSubAgents = devStudio.subAgentCount;
  const devStudioWorkflows = devStudio.workflowCount;

  const mismatches = [];
  const onDiskAgents = countAgentFilesOnDisk(registry.packs.shield.pack_dir);
  const onDiskWorkflows = countWorkflowFilesOnDisk(registry.packs.shield.pack_dir);
  if (onDiskAgents !== null && onDiskAgents !== shieldAgents) {
    mismatches.push(
      `registry.yaml declares ${shieldAgents} shield category agents but ${onDiskAgents} agent files exist on disk`
    );
  }
  if (onDiskWorkflows !== null && onDiskWorkflows !== shieldWorkflows) {
    mismatches.push(
      `registry.yaml declares ${shieldWorkflows} shield workflows but ${onDiskWorkflows} workflow files exist on disk`
    );
  }

  // Sizes of the declared per-category agent groups ("5 agents", "6 agents"…),
  // which are legitimate claims wherever a category is described.
  const perCategorySizes = new Set(shield.categoryAgentCounts);
  // Sizes of the per-pack installer rosters ("3 agents (Scout, Chief, Judge)").
  const perPackInstallerSizes = new Set(Object.values(packs).map((p) => p.installerAgentCount));

  return {
    packCount: derived.packCount,
    installerAgents,
    shieldAgents,
    shieldWorkflows,
    shieldCategories,
    shieldFrameworks,
    shieldReferenceFiles: shield.referenceFiles,
    devStudioSubAgents,
    devStudioWorkflows,
    totalAgents,
    languages: derived.languages,
    perCategorySizes,
    // The COMPLETE vocabulary of numbers that may legitimately precede "agents"
    // anywhere in the product's own copy. Default-deny: a value outside this set
    // is a number nobody can derive, so it is drift by definition. This is what
    // gates the 47s — "47 agents" stays green only while 47 is still derivable,
    // and every occurrence turns red the day the roster changes.
    agentCounts: new Set([
      installerAgents,
      shieldAgents,
      devStudioSubAgents,
      totalAgents,
      ...perCategorySizes,
      ...perPackInstallerSizes,
    ]),
    // Same idea for the workflow dimension. Anchored lines get graded against
    // the one pack they name; unanchored ones must still be *some* real total.
    workflowCounts: new Set(
      Object.values(packs)
        .map((p) => p.workflowCount)
        .filter(Boolean)
    ),
    derivationMismatches: mismatches,
  };
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

const SHIELD_ANCHOR =
  /shield|\bGRC\b|compliance[- ]agent|agents? de conformité|agentes de cumplimiento|Compliance-Agenten/i;
const DEV_STUDIO_ANCHOR = /dev[- ]studio/i;

/**
 * Lines whose agent count describes the UPSTREAM project, not this one:
 * "BMAD-METHOD ... 9 specialized agents" is a true statement about a different
 * product, so the roster rule must not grade it. Scoped to the agent dimension
 * only — a line may name BMAD-METHOD and still make a claim of its own
 * ("Fork of BMAD-METHOD — ... CLI installer in 10 languages"), and that claim
 * stays gated.
 */
const FOREIGN_SUBJECT_ANCHOR = /BMAD-METHOD/i;

/**
 * `| BMAD-METHOD | BMAD+ |` opens the upstream comparison table, whose rows
 * carry a foreign count in the left column and ours in the right ("| 9
 * specialized agents | **47 agents** across 9 packs |") without repeating the
 * marker. The rows are recognised positionally, like isFrozenHistoryRow.
 */
const FOREIGN_TABLE_HEADER_RE = /^\s*\|\s*BMAD-METHOD\s*\|/i;

/* A claim is `<number> <qualifiers…> <dimension noun>`. The three constants
 * below define what may sit between the number and the noun; every rule is
 * built from them by claimRe(), so a fix to the CLASS lands on every dimension
 * at once instead of on one hand-listed adjective. */

/**
 * What may SEPARATE the pieces of a claim: whitespace and markdown
 * emphasis/code markers — "**38** agents", "`38` agents", "**38 agents**".
 * `\s` already covers U+00A0/U+202F, which the French copy uses before
 * punctuation.
 *
 * Hyphens allow compounds such as "12-language". The leading token guard in
 * claimRe prevents digits inside identifiers such as `nist-800-53-agent` from
 * becoming counts; the separator itself need not suppress legitimate claims.
 */
const GAP = '[\\s*`-]*';

/** One qualifier word: hyphenated and accented forms included. */
const WORD = '[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ-]*';

/**
 * Maximum qualifiers echoed in diagnostics. Longer adjective runs are still
 * graded; clause/dimension boundaries below prevent cross-sentence claims.
 */
const MAX_QUALIFIERS = 4;

/**
 * Words that TERMINATE a qualifier run instead of decorating it:
 *  - dimension nouns — the number belongs to THAT dimension, not to the one
 *    further right. "11 workflow agents" is a *workflow* count (graded by the
 *    workflows rule), and summing it into the agent dimension is precisely how
 *    27 + 11 became 38.
 *  - connectives and articles — without them a single match could span two
 *    independent claims ("9 packs and 27 agents").
 */
const NOT_A_QUALIFIER = new Set(
  `agent agents agente agentes agenten workflow workflows pack packs test tests
   category categories catégorie catégories categoría categorías kategorie kategorien
   framework frameworks language languages langue langues idioma idiomas sprache sprachen
   skill skills phase phases level levels
   and or plus with across of in on for to the a an
   et ou des les la le du dans sur pour avec y con de en und oder mit für`.split(/\s+/)
);
const DIMENSION_WORDS = new Set(
  'agent agents agente agentes agenten workflow workflows pack packs test tests category categories catégorie catégories categoría categorías kategorie kategorien framework frameworks language languages langue langues idioma idiomas sprache sprachen skill skills phase phases level levels reference files'.split(
    ' '
  )
);
const CLAUSE_WORDS = new Set('why you we they should would could must can will'.split(' '));

/**
 * Quantity approximators sitting in front of the number. "over 47 agents" is
 * the same marketing hedge as "47+ agents" and must die the same way — the
 * roster is an exact, derivable integer. Deliberately excludes "about" and
 * "around", which read as "on the subject of" far too often to be safe.
 */
const APPROX_PREFIX_RE = new RegExp(
  `(?:over|more than|nearly|almost|approximately|approx\\.?|up to|~|≈` +
    `|plus de|environ|más de|mehr als)${GAP}$`,
  'i'
);

/**
 * Build a /g/ claim regex for one dimension's noun alternatives.
 *
 * The leading guard forbids a number inside a word, version or identifier.
 * Qualifier tokens require separators, so an unbounded adjective run does not
 * create ambiguous character-by-character partitions when no noun follows.
 */
function claimRe(noun) {
  return new RegExp(
    `(?<![\\w.-])(\\d+)${GAP}(\\+)?${GAP}((?:${WORD}[\\s*\u0060-]+)*?)(${noun})\\b`,
    'gi'
  );
}

const AGENTS_RE = claimRe('agents?|agentes|agenten');
const WORKFLOWS_RE = claimRe('workflows?');
const CATEGORIES_RE = claimRe('categories|catégories|categorías|Kategorien');
const PACKS_RE = claimRe('packs?');
const TESTS_RE = claimRe('tests?');
const FRAMEWORKS_RE = claimRe('frameworks?');
const LANGUAGES_RE = claimRe('languages?|langues?|idiomas?|Sprachen?');
const REFERENCE_FILES_RE = claimRe('reference files?');

/**
 * Collect every claim `re` finds on `line`.
 * `re` must be a /g/ regex; it is reset before use so it is safe to reuse.
 * Dimension/clause crossings are discarded. Connectives truncate the echoed
 * qualifiers without discarding a claim such as "38 compliance and GRC agents".
 * @returns {{value:number, plus:boolean, approx:boolean, text:string}[]}
 */
function matchAll(re, line) {
  re.lastIndex = 0;
  const out = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    const qualifiers = (m[3] || '').split(/[^A-Za-zÀ-ÖØ-öø-ÿ]+/).filter(Boolean);
    if (
      qualifiers.some(
        (w) => DIMENSION_WORDS.has(w.toLowerCase()) || CLAUSE_WORDS.has(w.toLowerCase())
      )
    )
      continue;
    const connective = qualifiers.findIndex((w) => NOT_A_QUALIFIER.has(w.toLowerCase()));
    const bounded = qualifiers.slice(
      0,
      Math.min(connective < 0 ? qualifiers.length : connective, MAX_QUALIFIERS)
    );
    out.push({
      value: Number(m[1]),
      plus: m[2] === '+',
      approx: APPROX_PREFIX_RE.test(line.slice(0, m.index)),
      // Markers are dropped from the echoed text so a bolded claim reports as
      // `38 compliance agents`, not `38** compliance agents`. file:line locates it.
      text: [m[1] + (m[2] || ''), ...bounded, m[4]].join(' '),
    });
  }
  return out;
}

/**
 * Check one line against the derived truth.
 * @param {string} line
 * @param {object} truth  output of deriveTruth()
 * @param {{foreignSubject?: boolean}} [opts]  foreignSubject suppresses the
 *   product-roster rule only (the line counts a DIFFERENT product's agents).
 * @returns {string[]} human-readable drift descriptions (empty when the line is fine)
 */
function checkLine(line, truth, { foreignSubject = false } = {}) {
  // In a comparison table only the first cell describes the upstream product.
  if (foreignSubject && line.trimStart().startsWith('|')) {
    const ownCells = line.trim().split('|').slice(2, -1).join(' | ');
    return checkLine(ownCells, truth);
  }
  const problems = [];
  const shieldLine = SHIELD_ANCHOR.test(line);
  const devStudioLine = DEV_STUDIO_ANCHOR.test(line);

  if (shieldLine) {
    for (const { value, text } of matchAll(AGENTS_RE, line)) {
      // Per-category headings ("5 agents") are legitimate; only reject the
      // values that misstate the pack-wide total. Anything that is not a
      // declared per-category size and not 27 is a conflation.
      if (value !== truth.shieldAgents && !isPerCategorySize(value, truth)) {
        problems.push(
          `"${text.trim()}" — Shield has ${truth.shieldAgents} compliance agents` +
            (value === truth.shieldAgents + truth.shieldWorkflows
              ? ` (${truth.shieldAgents} agents + ${truth.shieldWorkflows} workflows conflated into one "agents" figure)`
              : '')
        );
      }
    }
    for (const { value, text } of matchAll(WORKFLOWS_RE, line)) {
      if (value !== truth.shieldWorkflows) {
        problems.push(`"${text.trim()}" — Shield has ${truth.shieldWorkflows} workflows`);
      }
    }
    for (const { value, text } of matchAll(CATEGORIES_RE, line)) {
      if (value !== truth.shieldCategories) {
        problems.push(
          `"${text.trim()}" — Shield has ${truth.shieldCategories} agent categories` +
            (value === truth.shieldCategories + 1
              ? ' (the workflows/ directory is not a category)'
              : '')
        );
      }
    }
  }

  if (devStudioLine) {
    for (const { value, text } of matchAll(WORKFLOWS_RE, line)) {
      if (value !== truth.devStudioWorkflows) {
        problems.push(`"${text.trim()}" — Dev Studio has ${truth.devStudioWorkflows} workflows`);
      }
    }
  }

  // A "+" (or an "over"/"more than") on an agent total is always a marketing
  // approximation: the roster is an exact, derivable integer. This is the rule
  // that kills "56+ agents" — and "over 56 agents", which is the same hedge
  // wearing a different hat.
  for (const { plus, approx, text } of matchAll(AGENTS_RE, line)) {
    if (!plus && !approx) continue;
    problems.push(
      `"${text.trim()}" — agent totals are exact and derivable, not approximate` +
        ` (the roster is ${truth.totalAgents}; "56+" came from Dev Studio's *skills* count)`
    );
  }

  // The roster rule. Shield-anchored lines are graded by the stricter rule
  // above; everywhere else, any number attached to "agents" must be one this
  // repo can actually derive. Default-deny is the point: it is what makes the
  // tracked "47 agents" claims fail the day the roster stops being 47, and what
  // catches a number ("999") that corresponds to nothing at all.
  if (!shieldLine && !foreignSubject) {
    for (const { value, plus, approx, text } of matchAll(AGENTS_RE, line)) {
      if (plus || approx) continue; // already reported as an approximation
      if (!truth.agentCounts.has(value)) {
        problems.push(
          `"${text.trim()}" — no derived agent count equals ${value} (roster: ` +
            `${truth.totalAgents} total = ${truth.installerAgents} installer + ` +
            `${truth.shieldAgents} shield + ${truth.devStudioSubAgents} dev-studio sub-agents)`
        );
      }
    }
  }

  // Same default-deny for the workflow dimension. Anchored lines are graded
  // against the one pack they name; an unanchored line must still quote a real
  // total (this is what catches a pack description whose own name sits on the
  // line above it).
  if (!shieldLine && !devStudioLine) {
    for (const { value, text } of matchAll(WORKFLOWS_RE, line)) {
      if (!truth.workflowCounts.has(value)) {
        problems.push(
          `"${text.trim()}" — no pack has ${value} workflows (Shield ${truth.shieldWorkflows},` +
            ` Dev Studio ${truth.devStudioWorkflows})`
        );
      }
    }
  }

  // Packs and languages are exact derivable integers, so — like the agent
  // roster — they get no hedge. Modelling each hedge's arithmetic instead would
  // mean conceding that "10+ languages" (>= 10, true) and "more than 10
  // languages" (> 10, false) are different claims about the same 10; the honest
  // rule is that a number you can derive is simply stated.
  for (const { value, plus, approx, text } of matchAll(PACKS_RE, line)) {
    if (plus || approx) {
      problems.push(
        `"${text.trim()}" — the pack count is exact and derivable, not approximate` +
          ` (the registry declares ${truth.packCount})`
      );
    } else if (value !== truth.packCount) {
      problems.push(`"${text.trim()}" — the registry declares ${truth.packCount} packs`);
    }
  }

  for (const { value, plus, approx, text } of matchAll(LANGUAGES_RE, line)) {
    if (plus || approx) {
      problems.push(
        `"${text.trim()}" — the language count is exact and derivable, not approximate` +
          ` (tools/cli/i18n.js declares ${truth.languages.length})`
      );
    } else if (value !== truth.languages.length) {
      problems.push(
        `"${text.trim()}" — tools/cli/i18n.js declares ${truth.languages.length} languages` +
          ` (${truth.languages.join(', ')})`
      );
    }
  }

  // Frameworks are the one dimension gated as a LOWER BOUND. Unlike the rosters
  // above, the exact claims are per-category groupings ("AI Governance (3
  // frameworks)") that are NOT derivable — registry categories carry agents,
  // not compliance_tags — so an equality rule would fire on true statements.
  // The defect that remains checkable is the overclaim: promising more
  // frameworks than the pack actually tags. "25+" stays honest while 26 exist.
  for (const { value, text } of matchAll(FRAMEWORKS_RE, line)) {
    if (value > truth.shieldFrameworks) {
      problems.push(
        `"${text.trim()}" — Shield tags ${truth.shieldFrameworks} compliance frameworks`
      );
    }
  }

  for (const { value, plus, approx, text } of matchAll(REFERENCE_FILES_RE, line)) {
    if (value !== truth.shieldReferenceFiles || plus || approx) {
      problems.push(`"${text}" — Shield has ${truth.shieldReferenceFiles} reference files on disk`);
    }
  }

  return problems;
}

/** Per-category agent-group sizes that may legitimately appear near "agents". */
function isPerCategorySize(value, truth) {
  return truth.perCategorySizes.has(value);
}

/* ── Scan ───────────────────────────────────────────────────────────────── */

/** Files tracked by git, restricted to the declared truth surfaces. */
function trackedTruthSurfaces() {
  let tracked;
  try {
    tracked = new Set(
      execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    );
  } catch {
    tracked = null; // not a git checkout (e.g. an npm tarball) → scan what exists
  }
  return TRUTH_SURFACES.filter((f) => {
    if (tracked && !tracked.has(f)) return false;
    return fs.existsSync(path.join(REPO_ROOT, f));
  });
}

/**
 * Scan the truth surfaces.
 * @returns {{ ok: boolean, drifts: string[], unverified: string[], truth: object }}
 */
function check({ registryPath = DEFAULT_REGISTRY_PATH, testCount = null } = {}) {
  const truth = deriveTruth(registryPath);
  const drifts = [...truth.derivationMismatches];
  const unverified = [];

  for (const file of trackedTruthSurfaces()) {
    const lines = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8').split(/\r?\n/);
    let inForeignTable = false;
    lines.forEach((line, i) => {
      if (isFrozenHistoryRow(line)) return;
      if (FOREIGN_TABLE_HEADER_RE.test(line)) {
        inForeignTable = true;
        return;
      }
      if (inForeignTable && !line.trimStart().startsWith('|')) inForeignTable = false;

      const foreignSubject = inForeignTable || FOREIGN_SUBJECT_ANCHOR.test(line);
      for (const problem of checkLine(line, truth, { foreignSubject })) {
        drifts.push(`${file}:${i + 1}: ${problem}`);
      }
      for (const { value, text } of matchAll(TESTS_RE, line)) {
        if (testCount === null) {
          unverified.push(`${file}:${i + 1}: "${text.trim()}"`);
        } else if (value !== testCount) {
          drifts.push(`${file}:${i + 1}: "${text.trim()}" — the suite reports ${testCount} tests`);
        }
      }
    });
  }

  return { ok: drifts.length === 0, drifts, unverified, truth };
}

/**
 * Read the test-count rule's arming variable.
 * Unset/empty means "not armed" (never a failure). Anything else must be a
 * plain non-negative integer: `Number(" ")` is 0 and `Number("-1")` is an
 * integer, so a bare Number()+isInteger check would silently gate against a
 * garbage total.
 * @returns {{armed: boolean, testCount: number|null, error: string|null}}
 */
function readTestCountEnv(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { armed: false, testCount: null, error: null };
  }
  if (!/^\d+$/.test(raw.trim())) {
    return {
      armed: true,
      testCount: null,
      error: `BMAD_PLUS_TEST_COUNT must be a non-negative integer (got "${raw}")`,
    };
  }
  return { armed: true, testCount: Number(raw.trim()), error: null };
}

/**
 * Read the suite total from a Jest `--json` report.
 * @returns {{armed: boolean, testCount: number|null, error: string|null}}
 */
function readJestReport(file) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return {
      armed: true,
      testCount: null,
      error: `--jest-report: cannot read a Jest JSON report at ${file} (${error.message})`,
    };
  }
  const total = report && report.numTotalTests;
  if (!Number.isInteger(total) || total < 0) {
    return {
      armed: true,
      testCount: null,
      error: `--jest-report: ${file} has no integer numTotalTests (got ${JSON.stringify(total)})`,
    };
  }
  return { armed: true, testCount: total, error: null };
}

/** Resolve the arming source: BMAD_PLUS_TEST_COUNT first, then --jest-report. */
function resolveTestCount(args, env = process.env) {
  const fromEnv = readTestCountEnv(env.BMAD_PLUS_TEST_COUNT);
  if (fromEnv.armed) return fromEnv;
  const at = args.indexOf('--jest-report');
  if (at === -1) return fromEnv;
  const file = args[at + 1];
  if (!file || file.startsWith('--')) {
    return { armed: true, testCount: null, error: '--jest-report needs a file path' };
  }
  return readJestReport(file);
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

function main(argv) {
  const args = argv.slice(2);
  const { armed, testCount, error } = resolveTestCount(args);
  if (error) {
    console.error(error);
    return 1;
  }

  const result = check({ testCount });

  if (args.includes('--print')) {
    const { derivationMismatches, ...facts } = result.truth;
    void derivationMismatches;
    const asArray = (_k, v) => (v instanceof Set ? [...v].sort((a, b) => a - b) : v);
    console.log(JSON.stringify(facts, asArray, 2));
    return 0;
  }

  const partial = result.unverified.length > 0;

  if (result.ok) {
    console.log(
      `${partial ? 'OK (PARTIAL)' : 'OK'} — no count drift. Derived from registry.yaml + files on disk: ` +
        `${result.truth.shieldAgents} shield agents + ${result.truth.shieldWorkflows} shield workflows, ` +
        `${result.truth.devStudioWorkflows} dev-studio workflows, ${result.truth.totalAgents} agents total, ` +
        `${result.truth.packCount} packs, ${result.truth.languages.length} languages.`
    );
  } else {
    console.error('COUNT DRIFT DETECTED — hand-typed numbers contradict registry.yaml:');
    for (const d of result.drifts) console.error(`  - ${d}`);
    console.error(
      'Fix the claim (or registry.yaml if the registry is what is wrong), then re-run:'
    );
    console.error('  node tools/build/check-counts.js');
  }

  // Reported on BOTH paths, on purpose. A green run with the variable unset
  // must not read as full coverage — and a red run must not bury the fact that
  // the test claims went unchecked on top of whatever else broke.
  if (partial) {
    console.warn('');
    console.warn(
      `!! NOT GATED — ${result.unverified.length} test-count claim(s) were NOT checked ` +
        `(BMAD_PLUS_TEST_COUNT unset):`
    );
    for (const u of result.unverified) console.warn(`     ${u}`);
    console.warn('   This run does not cover those numbers. To gate them, pass the');
    console.warn('   Jest-reported total:');
    console.warn('     BMAD_PLUS_TEST_COUNT=<total> node tools/build/check-counts.js');
    console.warn('   or derive it from a local run: npm run check:counts:full');
  } else if (armed) {
    console.log(
      `Test-count claims gated against ${testCount} tests (from ${
        process.env.BMAD_PLUS_TEST_COUNT ? 'BMAD_PLUS_TEST_COUNT' : 'the --jest-report file'
      }).`
    );
  }

  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  REPO_ROOT,
  TRUTH_SURFACES,
  deriveTruth,
  checkLine,
  isFrozenHistoryRow,
  readTestCountEnv,
  readJestReport,
  resolveTestCount,
  trackedTruthSurfaces,
  check,
  main,
};
