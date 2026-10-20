/** Inspect installed Dev Studio routes and prepare actual host instructions. */
const path = require('node:path');
const { installedPack, validatePack, prepare } = require('../lib/studio');

module.exports = {
  command: 'studio <action> [workflow]',
  description: 'List Dev Studio workflows or prepare read-only execution context',
  options: [
    ['-d, --directory <path>', 'Installed project directory'],
    ['--request <text>', 'Task scope for the host assistant'],
    [
      '--input <file>',
      'Project-relative input file (repeatable)',
      (file, files) => [...files, file],
      [],
    ],
    ['--json', 'Print machine-readable context and evidence'],
  ],
  action: (action, workflow, options = {}) => {
    try {
      const projectDir = path.resolve(options.directory || process.cwd());
      let result;
      if (action === 'list' && !workflow) {
        const { catalog, resources } = validatePack(installedPack(projectDir));
        result = {
          schemaVersion: 1,
          execution: 'host-managed',
          ...catalog,
          validatedResources: resources.length,
        };
      } else if (action === 'prepare' && workflow) {
        result = prepare({ projectDir, workflow, request: options.request, inputs: options.input });
      } else throw new Error('Use studio list or studio prepare WORKFLOW.');
      process.exitCode = result.status === 'needs-input' ? 2 : 0;
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else if (action === 'list')
        console.log(
          result.workflows.map((w) => `${w.id} (${w.agent}; input: ${w.input})`).join('\n')
        );
      else
        console.log(
          [
            `${result.workflow}: ${result.status} — prepared for the host, not executed.`,
            `Project: ${result.projectDir}`,
            `Request: ${result.request || '(none supplied)'}`,
            `Resolved configuration:\n${JSON.stringify(result.config.values, null, 2)}`,
            `Defaulted fields: ${result.config.defaultsUsed.join(', ') || '(none)'}`,
            `Proposed report: ${result.outputPath}`,
            ...result.missingInputs,
            ...result.instructions.map(
              (item) => `\n--- ${item.path} (${item.sha256}) ---\n${item.content}`
            ),
            ...result.inputs.map(
              (item) => `\n--- Project input: ${item.path} (${item.sha256}) ---\n${item.content}`
            ),
            result.previousReport
              ? `\n--- Continue existing report ---\n${result.previousReport.content}`
              : '',
          ].join('\n')
        );
    } catch (error) {
      process.exitCode = 1;
      if (options.json)
        console.log(JSON.stringify({ schemaVersion: 1, status: 'error', error: error.message }));
      else console.error('Dev Studio: ' + error.message);
    }
  },
};
