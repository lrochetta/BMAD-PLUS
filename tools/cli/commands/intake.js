/** Validate, plan, record and render a pack intake; the host asks, the user answers. */
'use strict';

const path = require('node:path');
const intake = require('../lib/intake');

const collect = (value, list) => [...list, value];

function describePlan(result) {
  const lines = [
    `${result.intake} (${result.pack}): ${result.ready ? 'ready' : 'not ready'} — ` +
      `${result.counts.answered} answered, ${result.counts.defaulted} defaulted, ` +
      `${result.counts.unknown} unknown, ${result.counts.pending} not asked yet.`,
  ];
  if (result.missing.length) lines.push(`Must-haves still open: ${result.missing.join(', ')}`);
  if (result.next.length) {
    lines.push(`Ask next (at most ${result.maxPerMessage} per message):`);
    for (const question of result.next) {
      const hints = [];
      if (question.mustHave) hints.push('must-have');
      if (question.choices) hints.push(`choices: ${question.choices.join(', ')}`);
      if (question.default !== undefined)
        hints.push(`default: ${JSON.stringify(question.default)}`);
      lines.push(
        `  - ${question.id} [${question.kind}] ${question.ask}${hints.length ? ` (${hints.join('; ')})` : ''}`
      );
    }
  }
  for (const unknown of result.unknowns) {
    lines.push(`Unknown: ${unknown.id}${unknown.risk ? ` — risk: ${unknown.risk}` : ''}`);
  }
  return lines;
}

module.exports = {
  command: 'intake <action> [file]',
  description:
    'Pack intake: check a file, plan the next questions, record answers, render the brief',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['--intake <file>', 'Intake file, relative to the project'],
    ['--answers <file>', 'Answers file, relative to the project (created by record)'],
    [
      '--set <id=VALUE>',
      'Record an answer, or id=UNKNOWN to mark it unknown (repeatable)',
      collect,
      [],
    ],
    ['--default <id>', 'Record the proposed default of a question (repeatable)', collect, []],
    ['--reset', 'Start the answers file again, empty, for this intake (record)'],
    ['--out <file>', 'Brief to write (render)'],
    ['--json', 'Machine-readable output'],
  ],
  action: (action, file, options = {}) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const needs = (name) => {
      if (!options[name]) throw new Error(`--${name} is required for intake ${action}`);
      return options[name];
    };
    try {
      let result;
      let lines;
      if (action === 'check') {
        if (!file) throw new Error('Use intake check FILE.');
        result = intake.check({ projectDir, file });
        process.exitCode = result.ok ? 0 : 1;
        lines = result.ok
          ? [
              `${result.file}: valid intake ${result.id} (${result.pack}), ${result.questions} questions, ${result.mustHave} must-have.`,
            ]
          : [
              `${result.file}: not a valid intake`,
              ...result.problems.map((problem) => `  - ${problem}`),
            ];
        result = { status: result.ok ? 'valid' : 'invalid', ...result };
      } else if (action === 'plan') {
        result = intake.plan({
          projectDir,
          intakeFile: needs('intake'),
          answersFile: needs('answers'),
        });
        process.exitCode = result.ready ? 0 : 2;
        lines = describePlan(result);
        result = { status: result.ready ? 'ready' : 'needs-answers', ...result };
      } else if (action === 'record') {
        result = intake.record({
          projectDir,
          intakeFile: needs('intake'),
          answersFile: needs('answers'),
          sets: options.set,
          defaults: options.default,
          reset: options.reset === true,
        });
        process.exitCode = 0;
        lines = [
          result.reset
            ? `Reset ${result.answersFile}${result.recorded.length ? `, recorded ${result.recorded.join(', ')}` : ''}.`
            : `Recorded ${result.recorded.join(', ')} in ${result.answersFile}.`,
          ...describePlan(result),
        ];
        result = { status: 'recorded', ...result };
      } else if (action === 'render') {
        result = intake.render({
          projectDir,
          intakeFile: needs('intake'),
          answersFile: needs('answers'),
          out: needs('out'),
        });
        process.exitCode = 0;
        lines = [
          `Brief written to ${result.out} (${result.bytes} bytes); ${result.ready ? 'the intake is ready' : 'a must-have is still open'}.`,
        ];
        result = { status: 'rendered', ...result };
      } else throw new Error('Use intake check FILE, plan, record or render.');
      if (options.json) console.log(JSON.stringify({ schemaVersion: 1, ...result }, null, 2));
      else for (const line of lines) console.log(line);
    } catch (error) {
      process.exitCode = 1;
      if (options.json)
        console.log(JSON.stringify({ schemaVersion: 1, status: 'error', error: error.message }));
      else console.error('Intake: ' + error.message);
    }
  },
};
