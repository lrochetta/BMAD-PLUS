'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const fixture = require('./helpers.cjs');
const corpus = require('./corpus.json');
const memory = require('../../../tools/cli/lib/memory-journal');
const outcomes = require('../../../tools/cli/lib/memory-outcomes');
const command = require('../../../tools/cli/commands/memory-journal-cmd');

const root = path.resolve(__dirname, '../../..');
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex');
const inputPaths = [
  'tests/fixtures/memory-outcomes/corpus.json',
  'tests/fixtures/memory-outcomes/helpers.cjs',
  'tests/fixtures/memory-outcomes/run-comparison.cjs',
  'tools/cli/lib/memory-journal.js',
  'tools/cli/lib/memory-outcomes.js',
  'tools/cli/lib/memory-store.js',
  'tools/cli/lib/nexus.js',
];
const hashes = () =>
  Object.fromEntries(
    inputPaths.map((file) => [file, digest(fs.readFileSync(path.join(root, file)))])
  );
const section = (note) => `### ${note.heading}\n${note.text}\n`;

async function measure(language, words, scenario) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-memory-corpus-'));
  // The cleanup target is checked here, before any work: a throw inside `finally`
  // would hide the original failure instead of reporting it.
  const target = path.resolve(project);
  if (
    !target.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(target).startsWith('bmad-memory-corpus-')
  )
    throw new Error('Unsafe corpus cleanup.');
  let rejected = 0;
  try {
    const notes =
      scenario.id === 'empty'
        ? ''
        : scenario.id === 'relevant-boost' ||
            scenario.id.startsWith('contradiction') ||
            scenario.id === 'supersession'
          ? section(words.legacy) + section(words.correct)
          : scenario.id === 'unrelated-high-reward'
            ? section(words.correct) + section(words.unrelated)
            : section(words.correct);
    fixture.initialize(project, notes);
    if (!['empty', 'repeated-failure'].includes(scenario.id)) {
      await fixture.source(project);
      const firstHeading =
        scenario.id.startsWith('contradiction') || scenario.id === 'supersession'
          ? words.legacy.heading
          : scenario.id === 'unrelated-high-reward'
            ? words.unrelated.heading
            : words.correct.heading;
      const first = fixture.observe(project, 'one', firstHeading);
      if (scenario.id.startsWith('contradiction') || scenario.id === 'supersession') {
        await fixture.source(project, 'two');
        fixture.observe(project, 'two', words.correct.heading, {
          [scenario.id.startsWith('contradiction') ? 'contradicts' : 'supersedes']: [first.id],
        });
      }
      if (scenario.id === 'contradiction-repeated-anchor') {
        await fixture.source(project, 'three');
        fixture.observe(project, 'three', firstHeading);
      }
      if (scenario.id === 'stale-artifact')
        fixture.write(project, 'work/result.json', '{"verified":false}');
      if (scenario.id === 'missing-source')
        fs.unlinkSync(path.join(project, '.bmad-plus/nexus/runs/one.json'));
      if (scenario.id === 'missing-memory') fs.unlinkSync(path.join(project, fixture.MEMORY));
      if (scenario.id === 'unrelated-high-reward')
        for (let i = 0; i < 4; i++)
          command._internal.runReinforce({
            baseDir: project,
            patternId: words.unrelated.heading,
            signals: { evalScore: 1, acceptance: true, ci: 'pass' },
            now: fixture.NOW,
            log: () => {},
          });
      if (scenario.id === 'duplicate')
        for (let i = 0; i < 3; i++) {
          try {
            fixture.observe(project, 'one', firstHeading);
          } catch (error) {
            if (!error.message.includes('Duplicate')) throw error;
            rejected++;
          }
        }
    }
    if (scenario.id === 'repeated-failure')
      for (const id of ['failure-one', 'failure-two', 'failure-three']) {
        await fixture.source(project, id, { outcome: 'failed' });
        try {
          fixture.observe(project, id, words.correct.heading);
        } catch (error) {
          if (!error.message.includes('accepted task')) throw error;
          rejected++;
        }
      }
    const baseline = memory.recall(words.query, { baseDir: project });
    const evidence = memory.recall(words.query, {
      baseDir: project,
      ranking: 'evidence',
      contextScope: ['work'],
    });
    const expected = scenario.expected === null ? null : words[scenario.expected].heading;
    const summarize = (results) => ({
      top: results[0]?.ref || null,
      correct: (results[0]?.ref || null) === expected,
      results: results.map((item) => ({
        ref: item.ref,
        score: item.score,
        evidence: item.evidence || null,
      })),
    });
    return {
      language,
      case: scenario.id,
      query: words.query,
      expected,
      baseline: summarize(baseline),
      evidence: summarize(evidence),
      rejectedObservations: rejected,
      receipts: outcomes.inspectOutcomes(project),
    };
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

async function main() {
  const output = process.argv[2];
  if (!output)
    throw new Error('Usage: node tests/fixtures/memory-outcomes/run-comparison.cjs OUTPUT.json');
  const inputs = hashes();
  const observations = [];
  for (const [language, words] of Object.entries(corpus.languages)) {
    for (const scenario of corpus.cases)
      observations.push(await measure(language, words, scenario));
  }
  if (JSON.stringify(inputs) !== JSON.stringify(hashes()))
    throw new Error('Comparison inputs changed during execution; rerun on stable source.');
  const subset = (values) => ({
    cases: values.length,
    baselineCorrect: values.filter((item) => item.baseline.correct).length,
    evidenceCorrect: values.filter((item) => item.evidence.correct).length,
  });
  const report = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    method:
      'Fixed synthetic EN/FR corpus; baseline lexical ranking versus opt-in currently verified outcome ranking. Real local Nexus verifier commands executed against controlled artifact fixtures. No LLM execution or task-quality measurement.',
    inputSha256: inputs,
    summary: {
      ...subset(observations),
      positiveQueries: subset(observations.filter((item) => item.expected !== null)),
      abstentionQueries: subset(observations.filter((item) => item.expected === null)),
      improved: observations.filter((item) => !item.baseline.correct && item.evidence.correct)
        .length,
      regressed: observations.filter((item) => item.baseline.correct && !item.evidence.correct)
        .length,
      unchanged: observations.filter((item) => item.baseline.correct === item.evidence.correct)
        .length,
      rejectedDuplicateOrFailedObservations: observations.reduce(
        (sum, item) => sum + item.rejectedObservations,
        0
      ),
      downstreamTaskQuality: null,
    },
    observations,
  };
  const destination = path.resolve(output);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
