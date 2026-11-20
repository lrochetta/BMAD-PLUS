/**
 * Swarm runtime: freezes a definition and its inputs into a run, deals the cards, renders one
 * brief per unit, files and checks the answers, tallies them. Bookkeeping only: never a model
 * call, never a network call, never a child process. Writes stay under .bmad-plus/swarm/.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { safeTarget } = require('../../build/generate-adapters');
const contract = require('./swarm-validate');
const { dealCards, listCards } = require('./swarm-deal');
const { tally: computeTally, renderTally } = require('./swarm-tally');
const { SWARM_DEFAULTS } = require('./swarm-defaults');

const BASE = '.bmad-plus/swarm';
const RUNS = BASE + '/runs';
const REPORTS = BASE + '/reports';
const STATE_TREE = '.bmad-plus';
const CONFIG_FILE = '_bmad/config.yaml';
const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_REPLY_BYTES = 1024 * 1024;
const MAX_REPLY_CANDIDATES = 20;
const MAX_REPLY_SCAN_FACTOR = 2;
const QUOTE = '"'.charCodeAt(0);
const BACKSLASH = '\\'.charCodeAt(0);
const OPEN_BRACE = '{'.charCodeAt(0);
const CLOSE_BRACE = '}'.charCodeAt(0);
const MAX_SEED = 2 ** 31 - 1;
const MAX_LIMIT = 1000;
const RUN_ID = /^[a-z0-9][a-z0-9-]{0,63}-[0-9]{8}-[a-z0-9]{4}$/;
const RUN_SUFFIX_LENGTH = '-yyyymmdd-abcd'.length;
const RESERVED_RUN_FILES = [
  'run.json',
  'cards.json',
  'definition.json',
  'template.md',
  'nexus-plan.json',
  'tally.json',
  'tally.md',
];
const RUN_DIRECTORIES = ['answers', 'briefs', 'context', 'checks'];
const STATUSES = ['needs-approval', 'ready', 'briefed', 'tallied'];
const SUFFIX_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

const now = () => new Date().toISOString();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fail = (message) => {
  throw new Error('Swarm: ' + message);
};
const runDir = (runId) => RUNS + '/' + runId;
const runFile = (runId, ...parts) => [runDir(runId), ...parts].join('/');

function rootOf(directory) {
  const resolved = path.resolve(directory);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
    fail('Project directory does not exist: ' + resolved);
  return fs.realpathSync.native(resolved);
}

/** A project-relative path that stays inside the project, follows no link and never reaches .git. */
function projectTarget(root, file, label = 'Path') {
  contract.portablePath(file, label);
  if (file.split('/').some((part) => part.toLowerCase() === '.git'))
    fail(label + ' may not reach .git: ' + file);
  try {
    return safeTarget(root, file);
  } catch (error) {
    return fail(label + ' refused: ' + file + ' (' + error.message + ')');
  }
}

/** A file the user names: never one the runtime or Nexus keeps under .bmad-plus/. */
function userFile(file, label) {
  contract.portablePath(file, label);
  if (file.split('/')[0].toLowerCase() === STATE_TREE)
    fail(label + ' may not come from the BMAD+ state tree: ' + file);
  return file;
}

function readInput(root, file, label, limit = MAX_INPUT_BYTES) {
  const target = projectTarget(root, file, label);
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return fail(label + ' does not exist: ' + file);
  }
  if (!stat.isFile()) fail(label + ' is not a regular file: ' + file);
  if (stat.size > limit) fail(label + ' exceeds ' + limit + ' bytes: ' + file);
  const bytes = fs.readFileSync(target);
  return { content: bytes.toString('utf8'), sha256: sha256(bytes) };
}

function readJsonInput(root, file, label) {
  const { content, sha256: digest } = readInput(root, file, label);
  try {
    return { value: JSON.parse(content), sha256: digest };
  } catch (error) {
    return fail(label + ' is not valid JSON: ' + file + ' (' + error.message + ')');
  }
}

function writeRunFile(root, file, content) {
  if (!file.startsWith(BASE + '/')) fail('refusing to write outside ' + BASE + ': ' + file);
  const target = projectTarget(root, file, 'Run file');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporaryFile = file + '.' + crypto.randomUUID() + '.tmp';
  const temporary = projectTarget(root, temporaryFile, 'Run file');
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    projectTarget(root, file, 'Run file');
    fs.renameSync(temporary, target);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return target;
}

const writeJson = (root, file, value) =>
  writeRunFile(root, file, JSON.stringify(value, null, 2) + '\n');

function readConfig(root) {
  const target = projectTarget(root, CONFIG_FILE, 'Configuration');
  if (!fs.existsSync(target)) return { ...SWARM_DEFAULTS };
  const { content } = readInput(root, CONFIG_FILE, 'Configuration', 1024 * 1024);
  let config;
  try {
    config = yaml.load(content);
  } catch (error) {
    fail(CONFIG_FILE + ' is not valid YAML: ' + error.message);
  }
  if (config === null || config === undefined) return { ...SWARM_DEFAULTS };
  if (!contract.isObject(config)) fail(CONFIG_FILE + ' must be a YAML mapping.');
  if (config.swarm === undefined) return { ...SWARM_DEFAULTS };
  const swarm = config.swarm;
  if (!contract.isObject(swarm)) fail(CONFIG_FILE + ': swarm must be a mapping.');
  const result = { ...SWARM_DEFAULTS };
  for (const key of Object.keys(swarm)) {
    if (key === 'budget' || key === 'wave') {
      if (!Number.isInteger(swarm[key]) || swarm[key] < 1 || swarm[key] > MAX_LIMIT)
        fail(CONFIG_FILE + ': swarm.' + key + ' must be an integer from 1 to ' + MAX_LIMIT + '.');
      result[key] = swarm[key];
    } else if (key === 'media_credits') {
      if (swarm[key] !== 'ask') fail(CONFIG_FILE + ': swarm.media_credits must be "ask".');
    } else fail(CONFIG_FILE + ': swarm has an unknown key "' + key + '".');
  }
  return result;
}

function count(value, label, min, max) {
  const text = String(value);
  if (!/^\d{1,10}$/.test(text) || Number(text) < min || Number(text) > max)
    fail(label + ' must be an integer from ' + min + ' to ' + max + '.');
  return Number(text);
}

function parseContexts(entries) {
  const contexts = {};
  for (const entry of entries ?? []) {
    const at = String(entry).indexOf('=');
    if (at < 1) fail('A context is written NAME=FILE: ' + entry);
    const name = entry.slice(0, at);
    if (Object.hasOwn(contexts, name)) fail('Context "' + name + '" is given twice.');
    contexts[name] = entry.slice(at + 1);
  }
  return contexts;
}

const approvalHint = ({ n, budget, seed }) =>
  `The run needs ${n} sub-agents and the budget is ${budget}: ask the user, then re-run init with --approved${seed === null ? '' : ` --seed ${seed}`}.`;

function newRunId(root, definitionId) {
  const day = now().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 16; attempt += 1) {
    let suffix = '';
    for (let k = 0; k < 4; k += 1) suffix += SUFFIX_ALPHABET[crypto.randomInt(36)];
    const id = definitionId + '-' + day + '-' + suffix;
    if (!fs.existsSync(path.join(root, runDir(id)))) return id;
  }
  return fail('could not allocate a run id for ' + definitionId + '.');
}

function init(directory, options = {}) {
  const root = rootOf(directory);
  const config = readConfig(root);
  if (!options.definition) fail('init needs --definition FILE.');
  const definitionFile = readJsonInput(
    root,
    userFile(options.definition, 'Definition'),
    'Definition'
  );
  const definition = contract.normalizeDefinition(definitionFile.value);
  if (definition.kind === 'fanout' && definition.id.length + RUN_SUFFIX_LENGTH > 64)
    fail('A fanout definition id must leave room for a Nexus run id: at most 50 characters.');
  const templatePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(options.definition), definition.brief.template)
  );
  const templateFile = readInput(root, templatePath, 'Brief template');
  const supplied = parseContexts(options.context);
  for (const name of Object.keys(supplied))
    if (!definition.brief.context.includes(name))
      fail('Context "' + name + '" is not declared by the definition.');
  const contexts = {};
  for (const name of definition.brief.context) {
    if (!Object.hasOwn(supplied, name)) fail('The definition needs --context ' + name + '=FILE.');
    contexts[name] = {
      path: supplied[name],
      ...readInput(root, userFile(supplied[name], 'Context ' + name), 'Context ' + name),
    };
  }

  const { kind } = definition;
  let cards;
  let seed = null;
  let profileFile = null;
  let unitsFile = null;
  if (kind === 'panel') {
    if (!options.profile) fail('A panel needs --profile FILE.');
    if (options.units) fail('A panel takes --profile, not --units.');
    if (options.n === undefined) fail('A panel needs --n, the number of units to deal.');
    profileFile = readJsonInput(root, userFile(options.profile, 'Profile'), 'Profile');
    const profile = contract.normalizeProfile(profileFile.value);
    const n = count(options.n, 'n', 1, contract.MAX_UNITS);
    seed =
      options.seed === undefined
        ? crypto.randomInt(0, MAX_SEED + 1)
        : count(options.seed, 'seed', 0, MAX_SEED);
    cards = dealCards(profile, n, seed, definition.units.idPrefix);
  } else {
    if (options.profile) fail('Only a panel takes --profile.');
    if (options.n !== undefined)
      fail('A ' + kind + ' has as many units as it lists; --n does not apply.');
    if (options.seed !== undefined) fail('A seed only applies to a dealt panel.');
    if (kind === 'jury') {
      if (options.units) fail('A jury lists its units in the definition, not in --units.');
      cards = listCards(definition.units.list, definition.units.idPrefix);
    } else {
      if (!options.units) fail('A fanout needs --units FILE.');
      unitsFile = readJsonInput(root, userFile(options.units, 'Units'), 'Units');
      cards = contract.normalizeUnits(unitsFile.value);
    }
  }
  contract.checkTemplate(templateFile.content, cards, definition.brief.context);
  for (const field of definition.tally.groupBy) {
    const missing = cards.find((card) => !Object.hasOwn(card, field));
    if (missing)
      fail('Tally groupBy field "' + field + '" is absent from unit ' + missing.id + '.');
  }

  const n = cards.length;
  const approved = options.approved === true;
  const needsApproval = n > config.budget && !approved;
  const runId = newRunId(root, definition.id);
  const stamp = now();
  const run = {
    schemaVersion: 1,
    id: runId,
    kind,
    pack: definition.pack,
    title: definition.title,
    definition: { path: options.definition, sha256: definitionFile.sha256 },
    template: { path: templatePath, sha256: templateFile.sha256 },
    profile: profileFile ? { path: options.profile, sha256: profileFile.sha256 } : null,
    units: unitsFile ? { path: options.units, sha256: unitsFile.sha256 } : null,
    contexts: Object.fromEntries(
      Object.entries(contexts).map(([name, file]) => [
        name,
        { path: file.path, sha256: file.sha256 },
      ])
    ),
    n,
    seed,
    wave: config.wave,
    budget: config.budget,
    mediaCredits: config.media_credits,
    approval: approved ? 'user' : needsApproval ? 'pending' : 'not-needed',
    status: needsApproval ? 'needs-approval' : 'ready',
    createdAt: stamp,
    updatedAt: stamp,
  };
  writeJson(root, runFile(runId, 'definition.json'), definition);
  writeRunFile(root, runFile(runId, 'template.md'), templateFile.content);
  writeJson(root, runFile(runId, 'cards.json'), cards);
  for (const [name, file] of Object.entries(contexts))
    writeRunFile(root, runFile(runId, 'context', name + '.md'), file.content);
  writeJson(root, runFile(runId, 'run.json'), run);
  return {
    schemaVersion: 1,
    status: run.status,
    run: runId,
    kind,
    n,
    seed,
    budget: config.budget,
    wave: config.wave,
    approval: run.approval,
    units: cards.map((card) => card.id),
    directory: path.join(root, runDir(runId)),
    next: needsApproval ? approvalHint(run) : 'bmad-plus swarm briefs ' + runId,
  };
}

function loadRun(directory, runId) {
  const root = rootOf(directory);
  if (typeof runId !== 'string' || !RUN_ID.test(runId))
    fail('A run id reads <definition>-<yyyymmdd>-<4 characters>.');
  const run = readJsonInput(root, runFile(runId, 'run.json'), 'Run').value;
  if (
    !contract.isObject(run) ||
    run.schemaVersion !== 1 ||
    run.id !== runId ||
    !STATUSES.includes(run.status)
  )
    fail('Run record is not usable: ' + runId);
  const definition = contract.normalizeDefinition(
    readJsonInput(root, runFile(runId, 'definition.json'), 'Run definition').value
  );
  const cards = readJsonInput(root, runFile(runId, 'cards.json'), 'Run cards').value;
  if (
    !Array.isArray(cards) ||
    !cards.length ||
    cards.some((card) => !contract.isObject(card) || !contract.UNIT_ID.test(String(card.id)))
  )
    fail('Run cards are not usable: ' + runId);
  const template = readInput(root, runFile(runId, 'template.md'), 'Run template').content;
  const contexts = {};
  for (const name of definition.brief.context)
    contexts[name] = readInput(
      root,
      runFile(runId, 'context', name + '.md'),
      'Run context'
    ).content;
  return { root, run, definition, cards, template, contexts };
}

function saveRun(state, changes) {
  Object.assign(state.run, changes, { updatedAt: now() });
  writeJson(state.root, runFile(state.run.id, 'run.json'), state.run);
}

const answerFile = (state, unitId) => runFile(state.run.id, 'answers', unitId + '.json');
const absolute = (state, file) => path.join(state.root, file);

/** The run-tree file at `file` when every ancestor is a plain directory inside the project. */
function runTarget(state, file) {
  try {
    return { target: projectTarget(state.root, file, 'Run file') };
  } catch (error) {
    return { refused: error.message.replace(/^Swarm: /, '') };
  }
}

function answerState(state, unitId) {
  const { target, refused } = runTarget(state, answerFile(state, unitId));
  if (refused) return { state: 'invalid', reason: 'the answer path is refused: ' + refused };
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'missing', reason: 'no answer file' };
    throw error;
  }
  if (!stat.isFile()) return { state: 'invalid', reason: 'the answer is not a regular file' };
  if (stat.size > MAX_INPUT_BYTES) return { state: 'invalid', reason: 'the answer exceeds 16 MiB' };
  let value;
  try {
    value = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return { state: 'invalid', reason: 'the answer is not valid JSON' };
  }
  const problems = contract.answerProblems(state.definition, unitId, value);
  return problems.length
    ? { state: 'invalid', reason: problems.join('; ') }
    : { state: 'valid', reason: null, answer: value };
}

function writeBrief(state, card) {
  // The sub-agent writes its answer with the host's own tools, which may not create parents.
  fs.mkdirSync(absolute(state, runFile(state.run.id, 'answers')), { recursive: true });
  const file = runFile(state.run.id, 'briefs', card.id + '.md');
  const content = contract.renderBrief(state.template, {
    card,
    contexts: state.contexts,
    answerPath: absolute(state, answerFile(state, card.id)),
    runId: state.run.id,
    disclosure: state.definition.disclosure,
  });
  writeRunFile(state.root, file, content);
  return {
    id: card.id,
    brief: absolute(state, file),
    answer: absolute(state, answerFile(state, card.id)),
  };
}

function approvalRefusal(state) {
  const { run } = state;
  return {
    schemaVersion: 1,
    status: 'needs-approval',
    run: run.id,
    n: run.n,
    budget: run.budget,
    seed: run.seed,
    next: approvalHint(run),
  };
}

function briefs(directory, runId, options = {}) {
  const state = loadRun(directory, runId);
  if (state.run.status === 'needs-approval') return approvalRefusal(state);
  const wave =
    options.wave === undefined ? state.run.wave : count(options.wave, 'wave', 1, MAX_LIMIT);
  const pending = [];
  for (const card of state.cards) {
    const current = answerState(state, card.id);
    if (current.state !== 'valid')
      pending.push({ ...writeBrief(state, card), state: current.state });
  }
  const waves = [];
  for (let start = 0; start < pending.length; start += wave)
    waves.push({ index: waves.length + 1, units: pending.slice(start, start + wave) });
  saveRun(state, { status: 'briefed' });
  return {
    schemaVersion: 1,
    status: 'briefed',
    run: runId,
    wave,
    units: state.cards.length,
    pending: pending.length,
    waves,
    instruction: 'Read the brief and follow it exactly; it is your whole instruction.',
    disclosure: state.definition.disclosure,
  };
}

function check(directory, runId) {
  const state = loadRun(directory, runId);
  const units = state.cards.map((card) => {
    const current = answerState(state, card.id);
    return { id: card.id, state: current.state, reason: current.reason };
  });
  const pending = units.filter((unit) => unit.state !== 'valid');
  return {
    schemaVersion: 1,
    status: pending.length ? 'incomplete' : 'complete',
    run: runId,
    units: units.length,
    valid: units.length - pending.length,
    pending,
  };
}

/**
 * The first balanced top-level JSON object in a printed reply, scanned with string awareness.
 * The work is bounded: at most 20 brace groups are tried and the characters scanned over all
 * of them may not exceed twice the reply, so a flood of braces costs milliseconds.
 */
function extractObject(text) {
  let candidates = 0;
  let scanned = 0;
  const budget = MAX_REPLY_SCAN_FACTOR * text.length;
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    if (++candidates > MAX_REPLY_CANDIDATES || scanned > budget) return null;
    let depth = 0;
    let quoted = false;
    let end = -1;
    let index = start;
    for (; index < text.length && end === -1; index += 1) {
      const code = text.charCodeAt(index);
      if (quoted) {
        if (code === BACKSLASH) index += 1;
        else if (code === QUOTE) quoted = false;
      } else if (code === QUOTE) quoted = true;
      else if (code === OPEN_BRACE) depth += 1;
      else if (code === CLOSE_BRACE && --depth === 0) end = index;
    }
    scanned += index - start;
    if (end === -1) continue;
    try {
      const value = JSON.parse(text.slice(start, end + 1));
      if (contract.isObject(value)) return value;
    } catch {
      // not an object: the next brace may open one
    }
  }
  return null;
}

function save(directory, runId, unitId, options = {}) {
  const state = loadRun(directory, runId);
  if (state.run.status === 'needs-approval') return approvalRefusal(state);
  if (!state.cards.some((card) => card.id === unitId))
    fail('Unknown unit ' + unitId + ' in run ' + runId + '.');
  if (answerState(state, unitId).state === 'valid')
    fail('Unit ' + unitId + ' already has a valid answer; it is kept.');
  if (!options.input) fail('save needs --input FILE, the reply the sub-agent printed.');
  const { content } = readInput(
    state.root,
    userFile(options.input, 'Reply'),
    'Reply',
    MAX_REPLY_BYTES
  );
  const value = extractObject(content);
  if (!value) fail('No JSON object found in the reply filed for unit ' + unitId + '.');
  const problems = contract.answerProblems(state.definition, unitId, value);
  if (problems.length) fail('Reply of unit ' + unitId + ' refused: ' + problems.join('; ') + '.');
  writeJson(state.root, answerFile(state, unitId), value);
  return {
    schemaVersion: 1,
    status: 'saved',
    run: runId,
    unit: unitId,
    answer: absolute(state, answerFile(state, unitId)),
  };
}

/**
 * Where --out may point: a report of this run under reports/<runId>/, or a file of this run's
 * own tree that is neither a frozen input, a state file nor inside a directory the units own.
 */
function outputFile(state, out, fallback) {
  if (out === undefined) return fallback;
  const file = contract.portablePath(String(out), '--out');
  const runId = state.run.id;
  const report = REPORTS + '/' + runId + '/';
  const own = runDir(runId) + '/';
  if (file.startsWith(report)) return file;
  if (!file.startsWith(own)) fail('--out must stay under ' + report + ' or ' + own + ': ' + file);
  const rest = file.slice(own.length);
  const head = rest.split('/')[0];
  if (RUN_DIRECTORIES.includes(head))
    fail('--out may not write inside ' + own + head + '/, which belongs to the units: ' + file);
  if (RESERVED_RUN_FILES.includes(path.posix.basename(rest)))
    fail('--out may not replace the run file ' + path.posix.basename(rest) + ': ' + file);
  return file;
}

function tally(directory, runId, options = {}) {
  const state = loadRun(directory, runId);
  if (state.run.status === 'needs-approval') return approvalRefusal(state);
  const rows = [];
  const skipped = [];
  for (const card of state.cards) {
    const current = answerState(state, card.id);
    if (current.state === 'valid') rows.push({ card, answer: current.answer });
    else skipped.push({ unit: card.id, reason: current.reason });
  }
  const result = computeTally({
    run: state.run,
    definition: state.definition,
    cards: state.cards,
    rows,
    skipped,
  });
  const jsonFile = runFile(runId, 'tally.json');
  const markdownFile = outputFile(state, options.out, runFile(runId, 'tally.md'));
  writeJson(state.root, jsonFile, result);
  writeRunFile(state.root, markdownFile, renderTally(result));
  saveRun(state, { status: 'tallied' });
  return {
    schemaVersion: 1,
    status: 'tallied',
    run: runId,
    files: { json: absolute(state, jsonFile), markdown: absolute(state, markdownFile) },
    tally: result,
  };
}

function inspect(directory, runId) {
  const state = loadRun(directory, runId);
  const counts = { units: state.cards.length, briefed: 0, valid: 0, invalid: 0, missing: 0 };
  for (const card of state.cards) {
    const brief = runTarget(state, runFile(runId, 'briefs', card.id + '.md'));
    if (brief.target && fs.existsSync(brief.target)) counts.briefed += 1;
    counts[answerState(state, card.id).state] += 1;
  }
  const { run } = state;
  return {
    schemaVersion: 1,
    status: run.status,
    run,
    counts,
    budget: {
      n: run.n,
      budget: run.budget,
      approval: run.approval,
      decision:
        run.approval === 'user'
          ? 'approved by the user'
          : run.status === 'needs-approval'
            ? 'needs approval: ' + run.n + ' units exceed the budget of ' + run.budget
            : 'within budget',
    },
    disclosure: state.definition.disclosure,
  };
}

const VERIFIER = `#!/usr/bin/env node
/** Generated by bmad-plus swarm plan. Verifies one unit's answer against the frozen definition. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { answerProblems } = require('./swarm-validate.cjs');
const flag = process.argv.find((argument) => argument.startsWith('--unit='));
const unit = flag ? flag.slice('--unit='.length) : '';
const run = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(run, file), 'utf8'));
const refuse = (message) => {
  console.error('swarm answer check: ' + message);
  process.exit(1);
};
if (!unit) refuse('--unit=<id> is required');
if (!read('cards.json').some((card) => card.id === unit)) refuse('unknown unit ' + unit);
let answer;
try {
  answer = read('answers/' + unit + '.json');
} catch (error) {
  refuse('no readable answer for ' + unit + ': ' + error.message);
}
const problems = answerProblems(read('definition.json'), unit, answer);
if (problems.length) refuse(unit + ': ' + problems.join('; '));
console.log('swarm answer check: ' + unit + ' is valid');
`;

function plan(directory, runId, options = {}) {
  const state = loadRun(directory, runId);
  const { run, definition } = state;
  if (definition.kind !== 'fanout')
    fail('Only a fanout exports a Nexus plan; run ' + runId + ' is a ' + definition.kind + '.');
  if (run.status === 'needs-approval') return approvalRefusal(state);
  const base = runDir(runId);
  const checks = [base + '/checks/answer.cjs', base + '/checks/swarm-validate.cjs'];
  writeRunFile(state.root, checks[0], VERIFIER);
  writeRunFile(state.root, checks[1], fs.readFileSync(path.join(__dirname, 'swarm-validate.js')));
  const tasks = state.cards.map((card) => {
    const brief = runFile(runId, 'briefs', card.id + '.md');
    const answer = answerFile(state, card.id);
    writeBrief(state, card);
    return {
      id: card.id,
      objective:
        'Read ' +
        brief +
        ' and follow it exactly; it is your whole instruction. Unit ' +
        card.id +
        ' of the swarm "' +
        definition.title +
        '".',
      acceptance: [answer + ' is a valid answer of unit ' + card.id + ' (check answer).'],
      dependsOn: [],
      scope: [...card.scope, answer],
      artifacts: [answer],
      resources: [brief, base + '/cards.json', base + '/definition.json', ...checks],
      checks: [
        // A flag, so a unit named like a project file is never mistaken for a file argument.
        {
          id: 'answer',
          command: 'node',
          args: [checks[0], '--unit=' + card.id],
          cwd: '.',
          timeoutMs: 30000,
        },
      ],
      maxAttempts: 2,
      deadlineMs: 3600000,
      idempotent: true,
      authorizations: ['Edit ' + card.scope.join(', ') + ' and write ' + answer + '.'],
    };
  });
  const document = {
    id: runId,
    maxParallel: Math.min(run.wave, 32),
    config: { swarm: runId, definition: definition.id },
    tasks,
  };
  const file = outputFile(state, options.out, runFile(runId, 'nexus-plan.json'));
  writeJson(state.root, file, document);
  saveRun(state, { status: 'briefed' });
  return {
    schemaVersion: 1,
    status: 'planned',
    run: runId,
    plan: absolute(state, file),
    tasks: tasks.length,
    maxParallel: document.maxParallel,
    next: 'bmad-plus nexus create --plan ' + absolute(state, file),
  };
}

module.exports = {
  BASE,
  SWARM_DEFAULTS,
  readConfig,
  extractObject,
  init,
  briefs,
  check,
  save,
  tally,
  inspect,
  plan,
};
