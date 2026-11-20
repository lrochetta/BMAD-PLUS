const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nexus = require('../../tools/cli/lib/nexus');
const { finalMessage } = require('../../tools/cli/lib/nexus-process');
const {
  executeReview,
  inspectReview,
  preflightReview,
} = require('../../tools/cli/lib/ghostwriter-nexus');
const { digest, writeOnce } = require('../../tools/cli/lib/ghostwriter-project');
const { prepare } = require('../../tools/cli/lib/ghostwriter-manifest');

// This executable is an explicit protocol fixture. It does not exercise a model
// or authenticate with a provider. Its two processes independently read stdin.
const provider = String.raw`#!/usr/bin/env node
const body = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const stage = body.candidate === undefined ? 'edit' : 'review';
const fixture = body.brief.text;
const draft = body.draft.text;
const thread = fixture === 'same-thread' ? 'shared' : 'fixture-' + stage;
const semantic = {
  fidelity: 'pass', quality: 'pass', facts: 'not_run', findings: [], sources: [],
  units: [
    { id: 'p1', quote: draft, assessment: 'The original qualification is retained.' },
    { id: 'out1', quote: body.candidate, assessment: 'The candidate preserves the qualification.' },
  ],
};
if (fixture === 'partial') semantic.units.pop();
if (fixture === 'invented-source') {
  semantic.facts = 'supported_by_provided_sources';
  semantic.sources = [{ path: 'unknown', quote: 'not observed', claim: draft }];
}
if (fixture === 'uncovered-fact') {
  semantic.units = [
    ...draft.split('\n\n').map((text,i)=>({id:'p'+(i+1),quote:text,assessment:'Preserved.'})),
    ...draft.split('\n\n').map((text,i)=>({id:'out'+(i+1),fact_status:'supported',quote:text,assessment:'Reviewed.'})),
  ];
  semantic.sources = [{unit_id:'out1',path:'source.txt',quote:'37 claims',claim:'37 claims'}];
  semantic.facts = 'supported_by_provided_sources';
}
const output = stage === 'edit' ? (fixture === 'changed-quantity' ? draft.replace('37','73') : draft) : JSON.stringify(semantic);
for (const event of [
  {type:'thread.started',thread_id:thread},{type:'turn.started'},
  {type:'item.completed',item:{type:'agent_message',text:output}},{type:'turn.completed'},
]) console.log(JSON.stringify(event));
`;

let project;
let manifest;
let attempt;
let binary;

function fixture(mode = 'normal') {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-ghostwriter-nexus-'));
  function resource(file, content) {
    fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
    fs.writeFileSync(path.join(project, file), content);
  }
  resource(
    'draft.txt',
    mode === 'oversize'
      ? 'word '.repeat(32000)
      : 'We may review 37 claims.' + (mode === 'uncovered-fact' ? '\n\nWe employ 500 people.' : '')
  );
  resource('brief.txt', mode);
  fs.cpSync(
    path.resolve(__dirname, '../../src/bmad-plus/packs/pack-ghostwriter'),
    path.join(project, '.agents/skills/pack-ghostwriter'),
    { recursive: true }
  );
  const sources = [];
  const skills = path.resolve(__dirname, '../../src/bmad-plus/skills');
  for (const name of fs.readdirSync(skills).filter((entry) => entry.startsWith('ghostwriter-')))
    fs.cpSync(path.join(skills, name), path.join(project, '.agents/skills', name), {
      recursive: true,
    });
  if (mode === 'uncovered-fact') {
    resource('source.txt', 'They received 37 claims.');
    resource(
      '.bmad-plus/ghostwriter/config.yaml',
      'schema_version: 1\nmode: orchestrated\nverification:\n  facts: provided-sources\n'
    );
    sources.push('source.txt');
  }
  manifest = prepare(project, {
    workflow: 'agent-output-review',
    mode: 'orchestrated',
    locale: 'en',
    contentType: 'report',
    input: 'draft.txt',
    brief: 'brief.txt',
    source: sources,
  }).manifest;
  const directory = manifest.expected_outputs.directory + '/attempt-1';
  attempt = {
    id: 'attempt-1',
    number: 1,
    output_path: directory + '/edit/revised.txt',
    review_path: directory + '/review/semantic.json',
  };
  writeOnce(project, '.bmad-plus/ghostwriter/runs/' + manifest.run_id + '/attempt-1.json', attempt);
  binary = path.join(project, 'fixture-codex');
  fs.writeFileSync(binary, provider, { mode: 0o700 });
}

afterEach(() => {
  if (project) fs.rmSync(project, { recursive: true, force: true });
  project = undefined;
});

const posix = process.platform === 'win32' ? test.skip : test;
posix(
  'a selected delivery needs two observed sessions and current byte-identical artifacts',
  async () => {
    fixture();
    const before = inspectReview(project, manifest, attempt);
    expect(before.complete).toBe(false);
    const report = await executeReview(project, manifest, attempt, { codex: binary });
    expect(report).toMatchObject({
      executed: true,
      complete: true,
      passes: true,
      reviewer_session_id: 'fixture-review',
      producer_session_id: 'fixture-edit',
      semantic_review: { coverage: { total_units: 2, completed_units: 2, missing_units: [] } },
    });
    const reviewRun = 'gw-' + digest([manifest.run_id, 1]).slice(0, 32) + '-review';
    expect(nexus.inspectRun(project, reviewRun).observations[0].evidenceEligible).toBe(true);
    const superseding = '.bmad-plus/ghostwriter/runs/' + manifest.run_id + '/attempt-2.json';
    writeOnce(project, superseding, { id: 'attempt-2' });
    expect(nexus.inspectRun(project, reviewRun).observations[0].evidenceEligible).toBe(false);
    fs.unlinkSync(path.join(project, superseding));
    fs.appendFileSync(path.join(project, attempt.output_path), ' changed');
    expect(nexus.inspectRun(project, reviewRun).observations[0].evidenceEligible).toBe(false);
    expect(inspectReview(project, manifest, attempt).complete).toBe(false);
  },
  30000
);

posix(
  'even an independent semantic pass cannot accept a changed protected quantity',
  async () => {
    fixture('changed-quantity');
    const report = await executeReview(project, manifest, attempt, { codex: binary });
    expect(report).toMatchObject({ complete: true, passes: false, retryable: true });
    const reviewRun = 'gw-' + digest([manifest.run_id, 1]).slice(0, 32) + '-review';
    expect(() => nexus.acceptTask(project, reviewRun, 'review')).toThrow(/findings/);
  },
  30000
);

for (const scenario of ['same-thread', 'partial', 'invented-source', 'uncovered-fact']) {
  posix(
    'rejects ' + scenario + ' even when both workers returned exit zero',
    async () => {
      fixture(scenario);
      await expect(executeReview(project, manifest, attempt, { codex: binary })).rejects.toThrow();
      expect(inspectReview(project, manifest, attempt)).toMatchObject({
        complete: false,
        retryable: scenario !== 'same-thread',
      });
    },
    30000
  );
}

test('packet size preflight also measures the expanded review context', () => {
  fixture('oversize');
  expect(() => preflightReview(project, manifest)).toThrow(/256 KiB/);
});

test('tool calls and extra provider turns cannot produce a captured final message', () => {
  function receipt(extra) {
    return {
      provider: { threadId: 'a' },
      output: {
        stdout: {
          complete: true,
          text: [
            { type: 'thread.started', thread_id: 'a' },
            { type: 'turn.started' },
            extra,
            { type: 'item.completed', item: { type: 'agent_message', text: 'looks fine' } },
            { type: 'turn.completed' },
          ]
            .map(JSON.stringify)
            .join('\n'),
        },
      },
    };
  }
  expect(() => finalMessage(receipt({ type: 'turn.completed' }))).toThrow();
  expect(() =>
    finalMessage(receipt({ type: 'item.completed', item: { type: 'command_execution' } }))
  ).toThrow();
});
