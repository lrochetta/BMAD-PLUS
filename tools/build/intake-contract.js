/**
 * BMAD+ Build — the intake contract (docs/specs/core-orchestration.md §4).
 *
 * An intake file lists the questions a pack must have answered before it acts; an
 * answers file records what the user said, what was proposed by default and what
 * stays unknown. Both are validated here, by pure functions shared by
 * `generate.js --check` (every declared intake) and `bmad-plus intake` (the host).
 * The plan (what to ask next, whether the pack may start) and the brief rendering
 * live here too, so the CLI only reads and writes files.
 *
 * Author: Laurent Rochetta
 */

'use strict';

const KINDS = ['text', 'choice', 'number', 'boolean', 'list'];
const STATUSES = ['answered', 'defaulted', 'unknown'];
const UNKNOWN_MARK = 'UNKNOWN';
const BRIEF_MARKER = 'owned by bmad-plus intake';
const SLUG_RE = /^[a-z][a-z0-9-]*$/;
const LANGUAGE_RE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const FEED_RE = /^[A-Za-z0-9._/-]+(?:#[A-Za-z0-9._-]+)?$/;
const MAX_PER_MESSAGE = { min: 1, max: 20, fallback: 6 };
const MAX_TEXT = 4000;
const MAX_LIST_ITEMS = 50;

const INTAKE_KEYS = new Set([
  'schema_version',
  'id',
  'pack',
  'title',
  'language',
  'max_per_message',
  'sections',
]);
const SECTION_KEYS = new Set(['id', 'title', 'questions']);
const QUESTION_KEYS = new Set([
  'id',
  'ask',
  'kind',
  'choices',
  'min',
  'max',
  'default',
  'must_have',
  'feeds',
  'risk_if_unknown',
]);
const ENTRY_KEYS = new Set(['status', 'value', 'risk']);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';

function unknownKeys(object, allowed) {
  return Object.keys(object).filter((key) => !allowed.has(key));
}

// Line breaks and tabs are text; every other control character is not.
const hasControlCharacter = (text) =>
  [...text].some((char) => {
    const code = char.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10) || code === 127;
  });
const isReservedName = (id) => id in Object.prototype;

/** Why `value` is not an acceptable answer to `question`, or null when it is. */
function valueProblem(question, value) {
  switch (question.kind) {
    case 'text':
      if (!isText(value)) return 'needs a non-empty text';
      if (value.length > MAX_TEXT) return `is longer than ${MAX_TEXT} characters`;
      if (hasControlCharacter(value)) return 'holds a control character';
      return null;
    case 'choice':
      return question.choices.includes(value)
        ? null
        : `must be one of ${question.choices.join(', ')}`;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'needs a finite number';
      if (question.min !== undefined && value < question.min)
        return `must be at least ${question.min}`;
      if (question.max !== undefined && value > question.max)
        return `must be at most ${question.max}`;
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'needs true or false';
    case 'list':
      if (!Array.isArray(value) || value.length === 0 || !value.every(isText))
        return 'needs a non-empty list of texts';
      if (value.length > MAX_LIST_ITEMS) return `has more than ${MAX_LIST_ITEMS} items`;
      if (value.some((item) => hasControlCharacter(item))) return 'holds a control character';
      return null;
    default:
      return 'has an unknown kind';
  }
}

function validateQuestion(question, where, problems) {
  if (!isPlainObject(question)) {
    problems.push(`${where}: must be a mapping`);
    return;
  }
  for (const key of unknownKeys(question, QUESTION_KEYS)) {
    problems.push(`${where}: unknown field "${key}"`);
  }
  if (!isText(question.ask)) problems.push(`${where}: "ask" must be a non-empty text`);
  if (!KINDS.includes(question.kind)) {
    problems.push(`${where}: "kind" must be one of ${KINDS.join(', ')}`);
    return;
  }
  if (question.kind === 'choice') {
    const choices = question.choices;
    if (
      !Array.isArray(choices) ||
      choices.length < 2 ||
      !choices.every(isText) ||
      new Set(choices).size !== choices.length
    ) {
      problems.push(`${where}: a choice needs at least two distinct non-empty "choices"`);
      return;
    }
  } else if (question.choices !== undefined) {
    problems.push(`${where}: "choices" belongs to a choice question only`);
  }
  for (const bound of ['min', 'max']) {
    if (question[bound] === undefined) continue;
    if (question.kind !== 'number') {
      problems.push(`${where}: "${bound}" belongs to a number question only`);
    } else if (typeof question[bound] !== 'number' || !Number.isFinite(question[bound])) {
      problems.push(`${where}: "${bound}" must be a finite number`);
    }
  }
  if (
    typeof question.min === 'number' &&
    typeof question.max === 'number' &&
    question.min > question.max
  ) {
    problems.push(`${where}: "min" exceeds "max"`);
  }
  if (question.must_have !== undefined && typeof question.must_have !== 'boolean') {
    problems.push(`${where}: "must_have" must be true or false`);
  }
  if (question.must_have === true && !isText(question.risk_if_unknown)) {
    problems.push(`${where}: a must-have question needs "risk_if_unknown"`);
  }
  if (question.risk_if_unknown !== undefined && !isText(question.risk_if_unknown)) {
    problems.push(`${where}: "risk_if_unknown" must be a non-empty text`);
  }
  if (question.default !== undefined) {
    if (question.must_have === true) {
      problems.push(`${where}: a must-have question takes no "default"; the user answers it`);
    } else {
      const problem = valueProblem(question, question.default);
      if (problem) problems.push(`${where}: "default" ${problem}`);
    }
  }
  if (question.feeds !== undefined) {
    if (
      !Array.isArray(question.feeds) ||
      question.feeds.length === 0 ||
      !question.feeds.every((feed) => typeof feed === 'string' && FEED_RE.test(feed))
    ) {
      problems.push(`${where}: "feeds" must list artifact anchors such as brief.md#surface`);
    }
  }
}

/**
 * Validate a parsed intake file against §4.1.
 * @returns {{ ok: boolean, problems: string[] }}
 */
function validateIntake(intake) {
  const problems = [];
  if (!isPlainObject(intake)) return { ok: false, problems: ['intake: must be a mapping'] };
  for (const key of unknownKeys(intake, INTAKE_KEYS)) {
    problems.push(`intake: unknown field "${key}"`);
  }
  if (intake.schema_version !== 1) problems.push('intake: schema_version must be 1');
  for (const field of ['id', 'pack']) {
    if (typeof intake[field] !== 'string' || !SLUG_RE.test(intake[field])) {
      problems.push(`intake: "${field}" must be a lowercase slug`);
    }
  }
  if (!isText(intake.title)) problems.push('intake: "title" must be a non-empty text');
  if (
    intake.language !== undefined &&
    intake.language !== 'user' &&
    !(typeof intake.language === 'string' && LANGUAGE_RE.test(intake.language))
  ) {
    problems.push('intake: "language" must be "user" or a language tag such as fr or en-GB');
  }
  if (
    intake.max_per_message !== undefined &&
    !(
      Number.isInteger(intake.max_per_message) &&
      intake.max_per_message >= MAX_PER_MESSAGE.min &&
      intake.max_per_message <= MAX_PER_MESSAGE.max
    )
  ) {
    problems.push(
      `intake: "max_per_message" must be an integer from ${MAX_PER_MESSAGE.min} to ${MAX_PER_MESSAGE.max}`
    );
  }
  if (!Array.isArray(intake.sections) || intake.sections.length === 0) {
    problems.push('intake: "sections" must be a non-empty list');
    return { ok: problems.length === 0, problems };
  }
  const sectionIds = new Set();
  const questionIds = new Set();
  intake.sections.forEach((section, index) => {
    const where = `sections[${index}]`;
    if (!isPlainObject(section)) {
      problems.push(`${where}: must be a mapping`);
      return;
    }
    for (const key of unknownKeys(section, SECTION_KEYS)) {
      problems.push(`${where}: unknown field "${key}"`);
    }
    if (typeof section.id !== 'string' || !SLUG_RE.test(section.id)) {
      problems.push(`${where}: "id" must be a lowercase slug`);
    } else if (sectionIds.has(section.id)) {
      problems.push(`${where}: duplicate section id "${section.id}"`);
    } else sectionIds.add(section.id);
    if (!isText(section.title)) problems.push(`${where}: "title" must be a non-empty text`);
    if (!Array.isArray(section.questions) || section.questions.length === 0) {
      problems.push(`${where}: "questions" must be a non-empty list`);
      return;
    }
    section.questions.forEach((question, position) => {
      const label = `${where}.questions[${position}]`;
      if (isPlainObject(question)) {
        if (typeof question.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(question.id)) {
          problems.push(`${label}: "id" must be a snake_case identifier`);
        } else if (isReservedName(question.id)) {
          problems.push(`${label}: "id" ${question.id} is a reserved object property name`);
        } else if (questionIds.has(question.id)) {
          problems.push(`${label}: duplicate question id "${question.id}"`);
        } else questionIds.add(question.id);
      }
      validateQuestion(question, label, problems);
    });
  });
  return { ok: problems.length === 0, problems };
}

/** Every question of a valid intake, in file order, with its section. */
function listQuestions(intake) {
  return intake.sections.flatMap((section) =>
    section.questions.map((question) => ({ ...question, section: section.id }))
  );
}

function entryProblem(question, entry) {
  if (!isPlainObject(entry)) return 'must be a mapping';
  const unknown = unknownKeys(entry, ENTRY_KEYS);
  if (unknown.length) return `has unknown field "${unknown[0]}"`;
  if (!STATUSES.includes(entry.status)) return `status must be one of ${STATUSES.join(', ')}`;
  if (entry.status === 'unknown') {
    if (entry.value !== undefined) return 'is unknown and carries a value';
    if (question.risk_if_unknown !== undefined && !isText(entry.risk))
      return 'is unknown without its risk';
    if (entry.risk !== undefined && !isText(entry.risk)) return 'has an empty risk';
    return null;
  }
  if (entry.risk !== undefined) return `is ${entry.status} and carries a risk`;
  if (entry.status === 'defaulted') {
    if (question.default === undefined) return 'is defaulted but the question has no default';
    if (JSON.stringify(entry.value) !== JSON.stringify(question.default))
      return 'is defaulted with a value other than the default';
    return null;
  }
  const problem = valueProblem(question, entry.value);
  return problem ? `value ${problem}` : null;
}

/**
 * Validate a parsed answers file (§4.2) against its valid intake.
 * @returns {{ ok: boolean, problems: string[] }}
 */
function validateAnswers(answers, intake) {
  const problems = [];
  if (!isPlainObject(answers)) return { ok: false, problems: ['answers: must be an object'] };
  for (const key of unknownKeys(answers, new Set(['schemaVersion', 'intake', 'answers']))) {
    problems.push(`answers: unknown field "${key}"`);
  }
  if (answers.schemaVersion !== 1) problems.push('answers: schemaVersion must be 1');
  if (answers.intake !== intake.id) {
    problems.push(`answers: intake must be "${intake.id}"`);
  }
  if (!isPlainObject(answers.answers)) {
    problems.push('answers: "answers" must be an object keyed by question id');
    return { ok: false, problems };
  }
  const questions = new Map(listQuestions(intake).map((question) => [question.id, question]));
  for (const [id, entry] of Object.entries(answers.answers)) {
    const question = questions.get(id);
    if (!question) {
      problems.push(`answers.${id}: no such question in intake "${intake.id}"`);
      continue;
    }
    const problem = entryProblem(question, entry);
    if (problem) problems.push(`answers.${id}: ${problem}`);
  }
  return { ok: problems.length === 0, problems };
}

/** An empty answers file for an intake. */
function emptyAnswers(intake) {
  return { schemaVersion: 1, intake: intake.id, answers: {} };
}

/** The recorded entry of a question, own properties only: a prototype name is no answer. */
function entryOf(recorded, id) {
  return Object.hasOwn(recorded, id) ? recorded[id] : undefined;
}

function publicQuestion(question) {
  return {
    id: question.id,
    section: question.section,
    ask: question.ask,
    kind: question.kind,
    mustHave: question.must_have === true,
    ...(question.choices ? { choices: [...question.choices] } : {}),
    ...(question.min !== undefined ? { min: question.min } : {}),
    ...(question.max !== undefined ? { max: question.max } : {}),
    ...(question.default !== undefined ? { default: question.default } : {}),
    ...(question.risk_if_unknown !== undefined ? { risk: question.risk_if_unknown } : {}),
  };
}

/**
 * What to ask next and whether the pack may act. Both inputs must be valid.
 * `ready` holds once every must-have is answered or marked unknown with its risk.
 */
function planIntake(intake, answers = emptyAnswers(intake)) {
  const limit = intake.max_per_message ?? MAX_PER_MESSAGE.fallback;
  const questions = listQuestions(intake);
  const recorded = (question) => entryOf(answers.answers, question.id);
  const pending = questions.filter((question) => recorded(question) === undefined);
  const missing = pending.filter((question) => question.must_have === true);
  const next = [...missing, ...pending.filter((question) => question.must_have !== true)]
    .slice(0, limit)
    .map(publicQuestion);
  const unknowns = questions
    .filter((question) => recorded(question)?.status === 'unknown')
    .map((question) => ({
      id: question.id,
      mustHave: question.must_have === true,
      ...(recorded(question).risk !== undefined ? { risk: recorded(question).risk } : {}),
    }));
  const count = (status) =>
    questions.filter((question) => recorded(question)?.status === status).length;
  return {
    intake: intake.id,
    pack: intake.pack,
    language: intake.language ?? 'user',
    maxPerMessage: limit,
    ready: missing.length === 0,
    missing: missing.map((question) => question.id),
    next,
    unknowns,
    counts: {
      questions: questions.length,
      answered: count('answered'),
      defaulted: count('defaulted'),
      unknown: count('unknown'),
      pending: pending.length,
    },
  };
}

/**
 * Turn the text of `--set id=VALUE` into a typed value for the question, or the
 * unknown mark. Refuses anything the kind cannot hold.
 */
function parseCliValue(question, raw) {
  if (typeof raw !== 'string') throw new Error(`${question.id}: a value must be text`);
  if (raw === UNKNOWN_MARK) return { unknown: true };
  let value = raw;
  switch (question.kind) {
    case 'number':
      value = raw.trim() === '' ? NaN : Number(raw);
      break;
    case 'boolean':
      if (['true', 'yes', 'y', '1'].includes(raw.trim().toLowerCase())) value = true;
      else if (['false', 'no', 'n', '0'].includes(raw.trim().toLowerCase())) value = false;
      break;
    case 'list':
      value = raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
      break;
    case 'text':
    case 'choice':
      value = raw.trim();
      break;
    default:
      break;
  }
  const problem = valueProblem(question, value);
  if (problem) throw new Error(`${question.id}: value ${problem}`);
  return { value };
}

/**
 * Apply recorded changes to a copy of the answers: `sets` maps question id to raw
 * CLI text (or the unknown mark), `defaults` lists question ids to record as
 * defaulted. Returns the new answers object; the caller writes it.
 */
function recordAnswers(intake, answers, { sets = {}, defaults = [] } = {}) {
  const questions = new Map(listQuestions(intake).map((question) => [question.id, question]));
  const next = { ...answers, answers: { ...answers.answers } };
  const touched = new Set();
  const question = (id) => {
    const found = questions.get(id);
    if (!found) throw new Error(`no question "${id}" in intake "${intake.id}"`);
    if (touched.has(id)) throw new Error(`question "${id}" is set twice in one call`);
    touched.add(id);
    return found;
  };
  for (const [id, raw] of Object.entries(sets)) {
    const target = question(id);
    const parsed = parseCliValue(target, raw);
    next.answers[id] = parsed.unknown
      ? {
          status: 'unknown',
          ...(target.risk_if_unknown !== undefined ? { risk: target.risk_if_unknown } : {}),
        }
      : { value: parsed.value, status: 'answered' };
  }
  for (const id of defaults) {
    const target = question(id);
    if (target.default === undefined) throw new Error(`question "${id}" has no default`);
    next.answers[id] = { value: target.default, status: 'defaulted' };
  }
  return next;
}

/**
 * A user's value, one line per item, each indented by four spaces so that a
 * leading `#`, `-`, `>` or `|` stays text under the `Answer:` line.
 */
function valueBlock(value) {
  const items = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) =>
      typeof item === 'boolean' ? [item ? 'yes' : 'no'] : String(item).split('\n')
    )
    .map((line) => `    ${line}`);
}

/** Second line of every brief; `render` only overwrites a file that starts with it. */
function briefMarker(intake) {
  return `<!-- ${BRIEF_MARKER} ${intake.id}; written by bmad-plus intake render, do not edit -->`;
}

/** The brief: one section per intake section, every answer with its status. */
function renderBrief(intake, answers = emptyAnswers(intake)) {
  const plan = planIntake(intake, answers);
  const recorded = (question) => entryOf(answers.answers, question.id);
  const lines = [
    `# ${intake.title}`,
    briefMarker(intake),
    '',
    `Intake \`${intake.id}\` of pack \`${intake.pack}\` — ${plan.counts.answered} answered, ` +
      `${plan.counts.defaulted} defaulted, ${plan.counts.unknown} unknown, ` +
      `${plan.counts.pending} not asked yet. ${plan.ready ? 'Ready.' : 'Not ready: a must-have is open.'}`,
    '',
  ];
  for (const section of intake.sections) {
    lines.push(`## ${section.title}`, '');
    for (const question of section.questions) {
      const entry = recorded(question);
      lines.push(`### ${question.id}${question.must_have === true ? ' (must-have)' : ''}`, '');
      lines.push(question.ask, '');
      if (!entry) lines.push('Answer: not asked yet.');
      else if (entry.status === 'answered') lines.push('Answer:', ...valueBlock(entry.value));
      else if (entry.status === 'defaulted')
        lines.push(
          'Answer (proposed default, not confirmed by the user):',
          ...valueBlock(entry.value)
        );
      else lines.push(`Answer: unknown${entry.risk ? ` — risk: ${entry.risk}` : ''}`);
      if (question.feeds) lines.push(`Feeds: ${question.feeds.join(', ')}`);
      lines.push('');
    }
  }
  lines.push('## Open questions', '');
  const open = listQuestions(intake).filter(
    (question) => recorded(question) === undefined || recorded(question).status === 'unknown'
  );
  if (open.length === 0) lines.push('None.');
  for (const question of open) {
    const entry = recorded(question);
    const state = entry ? 'unknown' : 'not asked yet';
    const risk = entry?.risk ?? question.risk_if_unknown;
    lines.push(
      `- ${question.id}${question.must_have === true ? ' (must-have)' : ''}: ${state}${risk ? ` — risk: ${risk}` : ''}`
    );
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  KINDS,
  STATUSES,
  UNKNOWN_MARK,
  BRIEF_MARKER,
  briefMarker,
  validateIntake,
  validateAnswers,
  listQuestions,
  emptyAnswers,
  planIntake,
  parseCliValue,
  recordAnswers,
  renderBrief,
};
