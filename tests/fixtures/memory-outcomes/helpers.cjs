'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nexus = require('../../../tools/cli/lib/nexus');
const outcomes = require('../../../tools/cli/lib/memory-outcomes');

const NOW = '2026-09-11T12:00:00.000Z';
const MEMORY = '.agents/memory/patterns.md';

function write(project, file, text) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function initialize(
  project,
  notes = '### Cache contract\nPreserve false and zero cache values.\n'
) {
  write(project, MEMORY, notes);
  write(project, 'work/result.json', JSON.stringify({ verified: true }));
  write(
    project,
    'checks/accepted.cjs',
    "const fs = require('node:fs'); const assert = require('node:assert/strict'); assert.equal(JSON.parse(fs.readFileSync('work/result.json', 'utf8')).verified, true); console.log('fixture artifact accepted');\n"
  );
}

async function source(project, id = 'one', { accept = true, outcome = 'completed' } = {}) {
  const backend = { kind: 'host', id: 'memory-fixture', sessionId: id };
  nexus.createRun(project, {
    id,
    tasks: [
      {
        id: 'task',
        objective: 'Verify the controlled memory corpus artifact',
        scope: ['work'],
        artifacts: ['work/result.json'],
        resources: ['checks/accepted.cjs'],
        checks: [{ id: 'artifact', command: process.execPath, args: ['checks/accepted.cjs'] }],
        maxAttempts: 1,
        idempotent: true,
      },
    ],
  });
  const started = nexus.startTask(project, id, 'task', { backend });
  const attemptId = started.tasks[0].attempts.at(-1).id;
  nexus.recordAttempt(project, id, 'task', {
    backend,
    attemptId,
    outcome,
    summary: 'Synthetic corpus fixture execution, not an LLM task.',
    exitCode: outcome === 'completed' ? 0 : 1,
  });
  if (outcome !== 'completed') return;
  await nexus.verifyTask(project, id, 'task');
  if (accept) nexus.acceptTask(project, id, 'task');
}

function observation(id = 'one', heading = 'Cache contract', extra = {}) {
  return {
    runId: id,
    taskId: 'task',
    memory: { file: MEMORY, heading },
    scope: ['work'],
    interpretation:
      'The operator associates this lesson with the accepted fixture; causal benefit has not been measured.',
    ...extra,
  };
}

function observe(project, id = 'one', heading = 'Cache contract', extra = {}) {
  return outcomes.observeOutcome(project, observation(id, heading, extra), { now: NOW });
}

module.exports = { write, initialize, source, observation, observe, NOW, MEMORY };
