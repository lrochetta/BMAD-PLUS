/** Persist host-owned work, reconcile interruptions and verify current artifacts. */
const fs = require('node:fs');
const path = require('node:path');
const nexus = require('../lib/nexus');

function inputFile(file, option) {
  if (!file) throw new Error(option + ' requires a JSON file.');
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) {
    throw new Error(option + ' must name a regular JSON file no larger than 1 MiB.');
  }
  const value = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(option + ' must contain a JSON object.');
  }
  return value;
}

function summary(result) {
  if (!result.tasks) return JSON.stringify(result, null, 2);
  return [
    `Nexus run ${result.id} — durable task coordination`,
    ...result.tasks.map((task) => {
      const attempt = task.attempts.at(-1);
      const observation = result.observations?.find((item) => item.taskId === task.id);
      return (
        `${task.id}: ${attempt?.execution || 'not started'}; verification=${attempt?.verification.status || 'pending'}; acceptance=${task.integration}` +
        (attempt
          ? `\n  Attempt: ${attempt.id}; ${attempt.backend.kind}: ${attempt.backend.id}/${attempt.backend.sessionId}`
          : '') +
        (observation
          ? `\n  ${observation.hint}${observation.stale ? ' STALE: ' + observation.staleReason : ''}`
          : '')
      );
    }),
    'Use inspect --json for recorded evidence and reconciliation observations.',
  ].join('\n');
}

module.exports = {
  command: 'nexus <action> [run] [task]',
  description:
    'Launch or coordinate attempts, recover interrupted work and verify current artifacts',
  options: [
    ['-d, --directory <path>', 'Project directory'],
    ['--plan <file>', 'JSON task plan for create'],
    ['--input <file>', 'JSON observation or host identity for a mutation'],
    ['--json', 'Print durable state and evidence as JSON'],
  ],
  action: async (action, runId, taskId, options = {}) => {
    try {
      const directory = path.resolve(options.directory || process.cwd());
      let result;
      if (action === 'create' && !runId && !taskId) {
        if (options.input) throw new Error('create uses --plan.');
        result = nexus.createRun(directory, inputFile(options.plan, '--plan'));
      } else if (action === 'recover-lock' && !runId && !taskId) {
        if (options.plan) throw new Error('recover-lock uses --input.');
        result = nexus.recoverLock(directory, inputFile(options.input, '--input'));
      } else if (action === 'inspect' && !taskId) {
        if (options.input || options.plan)
          throw new Error('inspect is read-only and takes no input file.');
        result = nexus.inspectRun(directory, runId);
      } else {
        const mutations = {
          start: nexus.startTask,
          launch: nexus.launchTask,
          collect: nexus.collectTask,
          record: nexus.recordAttempt,
          reconcile: nexus.reconcileAttempt,
          verify: nexus.verifyTask,
          retry: nexus.retryTask,
          cancel: nexus.cancelTask,
          accept: nexus.acceptTask,
        };
        if (!Object.hasOwn(mutations, action) || !runId || !taskId || options.plan) {
          throw new Error(
            'Use nexus create --plan FILE, inspect RUN, or start|launch|collect|record|reconcile|verify|retry|cancel|accept RUN TASK.'
          );
        }
        const needsInput = !['verify', 'accept'].includes(action);
        if (!needsInput && options.input)
          throw new Error(action + ' executes its recorded contract and takes no input file.');
        result = await mutations[action](
          directory,
          runId,
          taskId,
          action === 'launch' && !options.input
            ? {}
            : needsInput
              ? inputFile(options.input, '--input')
              : undefined
        );
      }
      const latest = result.tasks?.find((task) => task.id === taskId)?.attempts.at(-1);
      process.exitCode =
        (action === 'verify' && latest?.verification.status !== 'passed') ||
        (action === 'launch' && latest?.process?.receipt?.outcome !== 'completed') ||
        (action === 'collect' && latest?.execution !== 'completed')
          ? 1
          : 0;
      console.log(options.json ? JSON.stringify(result, null, 2) : summary(result));
    } catch (error) {
      process.exitCode = 1;
      if (options.json)
        console.log(JSON.stringify({ schemaVersion: 1, status: 'error', error: error.message }));
      else console.error('Nexus: ' + error.message);
    }
  },
};
