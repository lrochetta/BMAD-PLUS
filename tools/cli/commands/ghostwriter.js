'use strict';

const path = require('node:path');
const ghostwriter = require('../lib/ghostwriter');

const append = (value, entries) => [...entries, value];

module.exports = {
  command: 'ghostwriter <action> [run-id]',
  description: 'Prepare an editorial revision, execute it through Nexus, and check its evidence',
  options: [
    ['-d, --directory <path>', 'Installed project directory'],
    ['--workflow <id>', 'Editorial workflow'],
    ['--input <path>', 'One selected project-relative prose file'],
    ['--source <path>', 'Additional factual source (repeatable)', append, []],
    ['--brief <path>', 'Project-relative editorial brief'],
    ['--profile <id>', 'Versioned voice profile (default preserves the draft voice)'],
    ['--locale <locale>', 'Target locale'],
    ['--source-locale <locale>', 'Locale of the source text'],
    ['--content-type <type>', 'Editorial genre (default documentation)'],
    [
      '--field <pointer>',
      'Editable RFC 6901 field in a JSON or YAML input (repeatable)',
      append,
      [],
    ],
    ['--mode <mode>', 'manual, host_policy or orchestrated'],
    ['--attempt <id>', 'Exact current execution attempt for collection'],
    ['--retry', 'Create a new attempt after a terminal execution'],
    ['--codex <path>', 'Absolute path to the Codex CLI for the orchestrated backend'],
    ['--model <id>', 'Request a model for the observed Codex sessions'],
    ['--json', 'Print the machine-readable result'],
  ],
  action: async (action, id, options = {}) => {
    const root = path.resolve(options.directory || process.cwd());
    try {
      let result;
      if (action === 'prepare' && !id && options.input && options.workflow) {
        result = ghostwriter.prepare(root, options);
      } else if (action === 'run' && id) {
        result = await ghostwriter.run(root, id, options);
      } else if (['collect', 'check', 'gate'].includes(action) && id) {
        if (action === 'collect' && !options.attempt)
          throw new Error('collect requires --attempt attempt-N.');
        result = await ghostwriter.evaluate(root, id, action, options.attempt);
      } else {
        throw new Error(
          'Use prepare --workflow ID --input FILE, run ID, collect ID --attempt ATTEMPT, check ID or gate ID.'
        );
      }
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else if (result.status === 'prepared')
        console.log(
          'Prepared ' + result.run_id + '\n' + result.manifest_path + '\nExecution has not started.'
        );
      else
        console.log(
          [result.run_id + ': ' + result.gate.verdict, ...result.gate.reasons, result.receipt_path]
            .filter(Boolean)
            .join('\n')
        );
      // Running a worker and recording evidence are distinct actions; only gate/check assign delivery exit codes.
      if (action === 'run' && result.collection_required === true) process.exitCode = 0;
      else
        process.exitCode = result.gate
          ? { accepted: 0, findings: 1, incomplete: 2 }[result.gate.verdict]
          : 0;
    } catch (error) {
      const verdict = ['check', 'collect', 'gate', 'run'].includes(action) ? 'incomplete' : 'error';
      process.exitCode = verdict === 'error' ? 1 : 2;
      if (options.json)
        console.log(JSON.stringify({ schema_version: 1, status: verdict, error: error.message }));
      else console.error('Ghostwriter: ' + error.message);
    }
  },
};
