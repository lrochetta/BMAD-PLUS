/** Run a swarm of sub-agents under a budget: deal, brief, check, file, tally; the host launches. */
'use strict';

const path = require('node:path');
const swarm = require('../lib/swarm');

const USAGE =
  'Use swarm init --definition FILE [--profile FILE | --units FILE] [--context NAME=FILE] [--n N] [--seed N] [--approved], ' +
  'briefs RUN [--wave N], check RUN, save RUN UNIT --input FILE, tally RUN [--out FILE], inspect RUN, or plan RUN [--out FILE].';

function lines(action, result) {
  if (result.status === 'needs-approval') return [`${result.run}: needs approval. ${result.next}`];
  switch (action) {
    case 'init':
      return [
        `${result.run}: ${result.kind} of ${result.n} units, budget ${result.budget}, approval ${result.approval}.`,
        result.seed === null
          ? 'Units listed, no seed.'
          : `Seed ${result.seed} (same seed, same cards).`,
        `Next: ${result.next}`,
      ];
    case 'briefs':
      return [
        `${result.run}: ${result.pending} of ${result.units} units need a sub-agent, in waves of ${result.wave}.`,
        ...result.waves.flatMap((wave) => [
          `Wave ${wave.index}:`,
          ...wave.units.map((unit) => `  ${unit.id}  ${unit.brief}`),
        ]),
        `Each sub-agent: ${result.instruction}`,
        `Disclosure: ${result.disclosure}`,
      ];
    case 'check':
      return [
        `${result.run}: ${result.valid} of ${result.units} valid answers.`,
        ...result.pending.map(
          (unit) => `  ${unit.id}  ${unit.state}${unit.reason ? `: ${unit.reason}` : ''}`
        ),
      ];
    case 'save':
      return [`${result.run}: answer of ${result.unit} filed at ${result.answer}`];
    case 'tally': {
      const { valid, total, skipped } = result.tally.units;
      return [
        result.files.markdown,
        `${valid} of ${total} units counted; ${skipped.length} skipped.`,
        `Disclosure: ${result.tally.disclosure}`,
      ];
    }
    case 'inspect': {
      const { counts } = result;
      return [
        `${result.run.id}: ${result.status} (${result.run.kind}, ${result.budget.decision})`,
        `units ${counts.units}, briefed ${counts.briefed}, valid ${counts.valid}, invalid ${counts.invalid}, missing ${counts.missing}`,
        `Disclosure: ${result.disclosure}`,
      ];
    }
    case 'plan':
      return [
        `${result.plan}: ${result.tasks} tasks, ${result.maxParallel} in parallel.`,
        `Next: ${result.next}`,
      ];
    default:
      return [JSON.stringify(result)];
  }
}

module.exports = {
  command: 'swarm <action> [run] [unit]',
  description:
    'Deal, brief, check, file and tally a swarm of sub-agents within the configured budget',
  options: [
    ['-d, --directory <path>', 'Project directory'],
    ['--definition <file>', 'Swarm definition (project-relative JSON) for init'],
    ['--profile <file>', 'Panel profile (project-relative JSON) for init'],
    ['--units <file>', 'Fanout units (project-relative JSON) for init'],
    [
      '--context <name=file>',
      'Context file included verbatim in the briefs (repeatable)',
      (value, all) => [...all, value],
      [],
    ],
    ['--n <count>', 'Units to deal for a panel'],
    ['--seed <number>', 'Dealing seed; drawn once and recorded when absent'],
    ['--approved', 'Record that the user agreed to exceed the budget'],
    ['--wave <count>', 'Sub-agents launched together (default: the configured wave)'],
    ['--input <file>', 'Printed reply to file with save (project-relative)'],
    ['--out <file>', 'Output file for tally or plan, under .bmad-plus/swarm/'],
    ['--json', 'Machine-readable output'],
  ],
  action: (action, runId, unitId, options = {}) => {
    const directory = path.resolve(options.directory || process.cwd());
    try {
      let result;
      if (action === 'init' && !runId) result = swarm.init(directory, options);
      else if (action === 'briefs' && runId && !unitId)
        result = swarm.briefs(directory, runId, options);
      else if (action === 'check' && runId && !unitId) result = swarm.check(directory, runId);
      else if (action === 'save' && runId && unitId)
        result = swarm.save(directory, runId, unitId, options);
      else if (action === 'tally' && runId && !unitId)
        result = swarm.tally(directory, runId, options);
      else if (action === 'inspect' && runId && !unitId) result = swarm.inspect(directory, runId);
      else if (action === 'plan' && runId && !unitId)
        result = swarm.plan(directory, runId, options);
      else throw new Error(USAGE);
      process.exitCode =
        result.status === 'needs-approval' ? 2 : result.status === 'incomplete' ? 1 : 0;
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else for (const line of lines(action, result)) console.log(line);
    } catch (error) {
      process.exitCode = 1;
      if (options.json)
        console.log(
          JSON.stringify({ schemaVersion: 1, status: 'error', error: error.message }, null, 2)
        );
      else console.error('Swarm: ' + error.message.replace(/^Swarm: /, ''));
    }
  },
};
