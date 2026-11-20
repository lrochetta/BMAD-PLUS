/** Read, plan, record and render a pack intake inside one project; the contract decides. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { safeTarget } = require('../../build/generate-adapters');
const contract = require('../../build/intake-contract');

const MAX_FILE = 1024 * 1024;
// Trees the intake never writes into, wherever they sit in the project.
const RESERVED_DIRS = new Set(['.git', '_bmad', '.bmad-plus', 'node_modules']);

/** A user-supplied path, kept inside the project and free of symlinks. */
function projectFile(projectDir, file) {
  if (typeof file !== 'string' || file.trim() === '') throw new Error('a file path is required');
  const root = path.resolve(projectDir);
  const relative = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../'))
    throw new Error(`${file}: outside the project directory ${root}`);
  return { relative, absolute: safeTarget(root, relative) };
}

/** A path the intake may write: outside the reserved trees, and never through a link. */
function writableFile(projectDir, file) {
  const target = projectFile(projectDir, file);
  const reserved = target.relative.split('/').find((part) => RESERVED_DIRS.has(part));
  if (reserved) throw new Error(`${target.relative}: the intake never writes under ${reserved}/`);
  return target;
}

function readBounded(absolute, label) {
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile()) throw new Error(`${label}: not a regular file`);
  if (stat.size > MAX_FILE) throw new Error(`${label}: larger than ${MAX_FILE} bytes`);
  return fs.readFileSync(absolute, 'utf8');
}

function describe(problems) {
  return problems.map((problem) => `  - ${problem}`).join('\n');
}

/** Parse and validate an intake file; throws listing every problem. */
function loadIntake(projectDir, file) {
  const target = projectFile(projectDir, file);
  let parsed;
  try {
    parsed = yaml.load(readBounded(target.absolute, target.relative), { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    throw new Error(`${target.relative}: ${error.message}`, { cause: error });
  }
  const result = contract.validateIntake(parsed);
  if (!result.ok)
    throw new Error(`${target.relative} is not a valid intake:\n${describe(result.problems)}`);
  return { file: target.relative, intake: parsed };
}

/** The parsed JSON of an existing answers file when it belongs to this intake; else throws. */
function ownedAnswers(target, intake) {
  let parsed;
  try {
    parsed = JSON.parse(readBounded(target.absolute, target.relative));
  } catch (error) {
    throw new Error(
      `${target.relative}: exists and is not an answers file of intake "${intake.id}" (${error.message}); move it away or pick another path`,
      { cause: error }
    );
  }
  if (!parsed || typeof parsed !== 'object' || parsed.intake !== intake.id) {
    throw new Error(
      `${target.relative}: exists and belongs to ${JSON.stringify(parsed && parsed.intake)}, not to intake "${intake.id}"; move it away or pick another path`
    );
  }
  return parsed;
}

/** Parse and validate an answers file; an absent file means no answer yet. */
function loadAnswers(projectDir, file, intake) {
  const target = writableFile(projectDir, file);
  if (!fs.existsSync(target.absolute)) {
    return { file: target.relative, answers: contract.emptyAnswers(intake), exists: false };
  }
  const parsed = ownedAnswers(target, intake);
  const result = contract.validateAnswers(parsed, intake);
  if (!result.ok)
    throw new Error(
      `${target.relative} does not answer this intake:\n${describe(result.problems)}\nRecord again with --reset to start over.`
    );
  return { file: target.relative, answers: parsed, exists: true };
}

function atomicWrite(projectDir, relative, content) {
  const target = safeTarget(projectDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporaryFile = `${relative}.${crypto.randomUUID()}.tmp`;
  const temporary = safeTarget(projectDir, temporaryFile);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx');
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    safeTarget(projectDir, relative);
    fs.renameSync(temporary, target);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function check({ projectDir, file }) {
  const target = projectFile(projectDir, file);
  let parsed;
  try {
    parsed = yaml.load(readBounded(target.absolute, target.relative), { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    return { file: target.relative, ok: false, problems: [error.message] };
  }
  const result = contract.validateIntake(parsed);
  const summary = result.ok
    ? {
        id: parsed.id,
        pack: parsed.pack,
        questions: contract.listQuestions(parsed).length,
        mustHave: contract.listQuestions(parsed).filter((q) => q.must_have === true).length,
      }
    : {};
  return { file: target.relative, ...result, ...summary };
}

function plan({ projectDir, intakeFile, answersFile }) {
  const { intake } = loadIntake(projectDir, intakeFile);
  const { answers, file } = loadAnswers(projectDir, answersFile, intake);
  return { answersFile: file, ...contract.planIntake(intake, answers) };
}

/**
 * `sets` is a list of "id=VALUE" texts, `defaults` a list of question ids. With
 * `reset`, the file starts again empty for this intake (an existing file must
 * already belong to it), then takes the sets and defaults of the same call.
 */
function record({ projectDir, intakeFile, answersFile, sets = [], defaults = [], reset = false }) {
  const { intake } = loadIntake(projectDir, intakeFile);
  let loaded;
  if (reset) {
    const target = writableFile(projectDir, answersFile);
    if (fs.existsSync(target.absolute)) ownedAnswers(target, intake);
    loaded = { file: target.relative, answers: contract.emptyAnswers(intake) };
  } else loaded = loadAnswers(projectDir, answersFile, intake);
  const pairs = {};
  for (const assignment of sets) {
    const at = typeof assignment === 'string' ? assignment.indexOf('=') : -1;
    if (at < 1) throw new Error(`--set expects id=VALUE, got "${assignment}"`);
    const id = assignment.slice(0, at);
    if (Object.hasOwn(pairs, id)) throw new Error(`question "${id}" is set twice in one call`);
    pairs[id] = assignment.slice(at + 1);
  }
  if (!reset && Object.keys(pairs).length === 0 && defaults.length === 0)
    throw new Error('nothing to record: pass --set id=VALUE, --default id or --reset');
  const answers = contract.recordAnswers(intake, loaded.answers, { sets: pairs, defaults });
  const result = contract.validateAnswers(answers, intake);
  if (!result.ok) throw new Error(`recorded answers are invalid:\n${describe(result.problems)}`);
  atomicWrite(projectDir, loaded.file, JSON.stringify(answers, null, 2) + '\n');
  return {
    answersFile: loaded.file,
    reset,
    recorded: [...Object.keys(pairs), ...defaults],
    ...contract.planIntake(intake, answers),
  };
}

/** The brief overwrites only a file it wrote before for the same intake. */
function render({ projectDir, intakeFile, answersFile, out }) {
  const { intake } = loadIntake(projectDir, intakeFile);
  const { answers } = loadAnswers(projectDir, answersFile, intake);
  const target = writableFile(projectDir, out);
  if (fs.existsSync(target.absolute)) {
    const marker = contract.briefMarker(intake);
    const head = readBounded(target.absolute, target.relative).split(/\r?\n/, 2);
    if (head[1] !== marker)
      throw new Error(
        `${target.relative}: exists and is not a brief of intake "${intake.id}" (its second line is not the ownership marker); move it away or pick another path`
      );
  }
  const brief = contract.renderBrief(intake, answers);
  atomicWrite(projectDir, target.relative, brief);
  const planned = contract.planIntake(intake, answers);
  return { out: target.relative, bytes: Buffer.byteLength(brief), ready: planned.ready };
}

module.exports = {
  projectFile,
  writableFile,
  loadIntake,
  loadAnswers,
  check,
  plan,
  record,
  render,
};
