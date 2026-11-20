/**
 * Swarm contracts: definition, profile, unit list, brief template and answer.
 * Pure functions only: the file is copied verbatim into a run as its Nexus verifier,
 * so it must stay self-contained (no file system, no other module).
 */
'use strict';

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UNIT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const NEXUS_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const FIELD = /^[a-z][a-z0-9_]{0,31}$/;
const CONTEXT = /^[a-z][a-z0-9_-]{0,31}$/;
const PREFIX = /^[A-Za-z]{1,4}$/;
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;
const SOURCES = { panel: 'profile', jury: 'list', fanout: 'input' };
const FIELD_TYPES = ['boolean', 'integer', 'number', 'string', 'enum', 'list'];
const MAX_UNITS = 1000;
const MAX_FIELDS = 50;
const MAX_TEXT_DEFAULT = 4000;
const MAX_TEXT_CEILING = 20000;
const MAX_LIST_ITEMS = 200;
const MAX_QUOTES = 10;
const RESERVED = ['id', 'scope', 'lens'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => {
  throw new Error('Swarm: ' + message);
};

function object(value, label) {
  if (!isObject(value)) fail(label + ' must be a JSON object.');
  return value;
}

function onlyKeys(value, allowed, label) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(label + ': unknown field "' + key + '".');
}

function str(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0'))
    fail(label + ' must be a nonempty string of at most ' + max + ' characters.');
  return value;
}

function int(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(label + ' must be an integer from ' + min + ' to ' + max + '.');
  return value;
}

function num(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(label + ' must be a number.');
  return value;
}

function list(value, label, max, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    fail(label + ' must be a list of ' + min + ' to ' + max + ' entries.');
  return value;
}

function fieldName(value, label) {
  if (typeof value !== 'string' || !FIELD.test(value))
    fail(label + ' must use 1-32 lowercase letters, numbers or _ and start with a letter.');
  return value;
}

function distinct(values, label) {
  if (new Set(values).size !== values.length) fail(label + ' must not repeat.');
  return values;
}

/** The same rules Nexus applies to a plan path, so a fanout scope exports unchanged. */
function portablePath(value, label = 'Path') {
  if (typeof value !== 'string' || !value || value.length > 500 || value.includes('\0'))
    fail(label + ' must be a nonempty project-relative path.');
  const parts = value.split('/');
  if (
    /[\\:<>"|?*]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32) ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
    )
  )
    fail(label + ' is not a portable project-relative path: ' + value);
  return value;
}

/** A write scope: portable, and never .git or the BMAD+ state tree. */
function scopePath(value, label) {
  portablePath(value, label);
  const head = value.split('/')[0].toLowerCase();
  if (head === '.git' || head === '.bmad-plus')
    fail(label + ' may not reach .git or the BMAD+ state tree: ' + value);
  return value;
}

const inScope = (file, scope) =>
  file.toLowerCase() === scope.toLowerCase() ||
  file.toLowerCase().startsWith(scope.toLowerCase() + '/');
const overlap = (a, b) => inScope(a, b) || inScope(b, a);

function cardValue(value, label) {
  if (typeof value === 'string') return str(value, label, 2000);
  if (typeof value === 'number') return num(value, label);
  if (typeof value === 'boolean') return value;
  fail(label + ' must be a string, a number or a boolean.');
  return value;
}

function normalizeField(name, raw) {
  const field = object(raw, 'Answer field "' + name + '"');
  onlyKeys(field, ['type', 'min', 'max', 'values', 'maxItems'], 'Answer field "' + name + '"');
  const label = 'Answer field "' + name + '"';
  if (!FIELD_TYPES.includes(field.type))
    fail(label + ' type must be one of ' + FIELD_TYPES.join(', ') + '.');
  const out = { type: field.type };
  const bounds = (key) => {
    if (field[key] === undefined) return undefined;
    return field.type === 'integer'
      ? int(field[key], label + ' ' + key, -1e15, 1e15)
      : num(field[key], label + ' ' + key);
  };
  switch (field.type) {
    case 'boolean':
      onlyKeys(field, ['type'], label);
      break;
    case 'integer':
    case 'number':
      onlyKeys(field, ['type', 'min', 'max'], label);
      out.min = bounds('min');
      out.max = bounds('max');
      if (out.min !== undefined && out.max !== undefined && out.min > out.max)
        fail(label + ' min exceeds max.');
      break;
    case 'string':
      onlyKeys(field, ['type', 'min', 'max'], label);
      out.min = field.min === undefined ? 0 : int(field.min, label + ' min', 0, MAX_TEXT_CEILING);
      out.max =
        field.max === undefined
          ? MAX_TEXT_DEFAULT
          : int(field.max, label + ' max', 1, MAX_TEXT_CEILING);
      if (out.min > out.max) fail(label + ' min exceeds max.');
      break;
    case 'enum':
      onlyKeys(field, ['type', 'values'], label);
      out.values = distinct(
        list(field.values, label + ' values', 50).map((value) => str(value, label + ' value', 100)),
        label + ' values'
      );
      break;
    case 'list':
      onlyKeys(field, ['type', 'maxItems'], label);
      out.maxItems =
        field.maxItems === undefined
          ? 50
          : int(field.maxItems, label + ' maxItems', 1, MAX_LIST_ITEMS);
      break;
    default:
      break;
  }
  return out;
}

function normalizeAnswer(raw) {
  const answer = object(raw, 'Definition answer');
  onlyKeys(answer, ['required', 'fields'], 'Definition answer');
  const source = object(answer.fields, 'Definition answer.fields');
  const names = Object.keys(source);
  if (names.length > MAX_FIELDS) fail('Definition answer.fields allows at most 50 fields.');
  const fields = {};
  for (const name of names) {
    fieldName(name, 'Answer field name');
    if (name === 'id') fail('Answer field "id" is implicit: it always equals the unit id.');
    fields[name] = normalizeField(name, source[name]);
  }
  const required = distinct(
    list(answer.required ?? [], 'Definition answer.required', MAX_FIELDS + 1, 0),
    'Definition answer.required'
  );
  for (const name of required)
    if (name !== 'id' && !Object.hasOwn(fields, name))
      fail('Definition answer.required names an undeclared field "' + name + '".');
  return { required: ['id', ...required.filter((name) => name !== 'id')], fields };
}

function normalizeTally(raw, fields) {
  const tally = object(raw ?? {}, 'Definition tally');
  onlyKeys(tally, ['rate', 'groupBy', 'counts', 'quotes', 'numbers'], 'Definition tally');
  const typed = (name, types, label) => {
    fieldName(name, label);
    if (!Object.hasOwn(fields, name) || !types.includes(fields[name].type))
      fail(label + ' "' + name + '" must be a declared ' + types.join(' or ') + ' field.');
    return name;
  };
  const out = { rate: null, groupBy: [], counts: [], quotes: {}, numbers: [] };
  if (tally.rate !== undefined && tally.rate !== null)
    out.rate = typed(tally.rate, ['boolean'], 'Tally rate');
  if (tally.groupBy !== undefined)
    out.groupBy = distinct(
      list(tally.groupBy, 'Tally groupBy', 5, 0).map((name) => fieldName(name, 'Tally groupBy')),
      'Tally groupBy'
    );
  if (tally.counts !== undefined)
    out.counts = distinct(
      list(tally.counts, 'Tally counts', MAX_FIELDS, 0).map((name) =>
        typed(name, ['enum'], 'Tally counts')
      ),
      'Tally counts'
    );
  if (tally.quotes !== undefined) {
    const quotes = object(tally.quotes, 'Tally quotes');
    for (const [name, count] of Object.entries(quotes)) {
      typed(name, ['string'], 'Tally quotes');
      out.quotes[name] = int(count, 'Tally quotes "' + name + '"', 1, MAX_QUOTES);
    }
  }
  if (tally.numbers !== undefined)
    out.numbers = distinct(
      list(tally.numbers, 'Tally numbers', MAX_FIELDS, 0).map((name) =>
        typed(name, ['integer', 'number'], 'Tally numbers')
      ),
      'Tally numbers'
    );
  return out;
}

function normalizeJuryList(raw) {
  const entries = list(raw, 'Definition units.list', MAX_UNITS);
  return entries.map((raw, index) => {
    const label = 'Jury unit ' + (index + 1);
    const entry = object(raw, label);
    const unit = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'id') {
        if (typeof value !== 'string' || !UNIT_ID.test(value)) fail(label + ' has an invalid id.');
        unit.id = value;
      } else {
        fieldName(key, label + ' field name');
        unit[key] = cardValue(value, label + ' field "' + key + '"');
      }
    }
    if (typeof unit.lens !== 'string') fail(label + ' needs a "lens" string.');
    return unit;
  });
}

function normalizeDefinition(raw) {
  const definition = object(raw, 'Definition');
  onlyKeys(
    definition,
    [
      'schemaVersion',
      'id',
      'kind',
      'title',
      'pack',
      'units',
      'brief',
      'answer',
      'tally',
      'disclosure',
    ],
    'Definition'
  );
  if (definition.schemaVersion !== 1) fail('Definition schemaVersion must be 1.');
  if (typeof definition.id !== 'string' || !ID.test(definition.id))
    fail('Definition id must use 1-64 lowercase letters, numbers or -.');
  if (!Object.hasOwn(SOURCES, definition.kind))
    fail('Definition kind must be panel, jury or fanout.');
  const kind = definition.kind;
  str(definition.title, 'Definition title', 200);
  let pack = null;
  if (definition.pack !== undefined && definition.pack !== null) {
    if (typeof definition.pack !== 'string' || !ID.test(definition.pack))
      fail('Definition pack must be a pack id.');
    pack = definition.pack;
  }
  const units = object(definition.units, 'Definition units');
  onlyKeys(units, ['source', 'idPrefix', 'list'], 'Definition units');
  if (units.source !== SOURCES[kind])
    fail('A ' + kind + ' swarm needs units.source "' + SOURCES[kind] + '".');
  let idPrefix = null;
  if (units.idPrefix !== undefined && units.idPrefix !== null) {
    if (kind === 'fanout') fail('Fanout units carry their own ids: idPrefix does not apply.');
    if (typeof units.idPrefix !== 'string' || !PREFIX.test(units.idPrefix))
      fail('Definition units.idPrefix must be 1-4 letters.');
    idPrefix = units.idPrefix;
  } else if (kind === 'panel') fail('A panel needs units.idPrefix.');
  let juryList = null;
  if (kind === 'jury') {
    juryList = normalizeJuryList(units.list);
    if (!idPrefix && juryList.some((unit) => !unit.id))
      fail('Every jury unit needs an id, or the definition needs units.idPrefix.');
  } else if (units.list !== undefined) fail('Only a jury lists its units in the definition.');

  const brief = object(definition.brief, 'Definition brief');
  onlyKeys(brief, ['template', 'context'], 'Definition brief');
  const template = str(brief.template, 'Definition brief.template', 500);
  if (
    template.split('/').some((part) => !part || part === '.' || part === '..') ||
    /[\\:]/.test(template) ||
    template.startsWith('/')
  )
    fail('Definition brief.template must be a plain relative path without . or .. parts.');
  const contexts = distinct(
    list(brief.context ?? [], 'Definition brief.context', 20, 0).map((name) => {
      if (typeof name !== 'string' || !CONTEXT.test(name))
        fail('Definition brief.context names must use 1-32 lowercase letters, numbers, _ or -.');
      return name;
    }),
    'Definition brief.context'
  );
  const answer = normalizeAnswer(definition.answer);
  const tally = normalizeTally(definition.tally, answer.fields);
  return {
    schemaVersion: 1,
    id: definition.id,
    kind,
    title: definition.title,
    pack,
    units: { source: units.source, idPrefix, ...(juryList ? { list: juryList } : {}) },
    brief: { template, context: contexts },
    answer,
    tally,
    disclosure: str(definition.disclosure, 'Definition disclosure', 500),
  };
}

function normalizeRange(raw, label) {
  const range = list(raw, label, 2, 2);
  const [low, high] = range.map((value) => num(value, label));
  if (low > high) fail(label + ' low bound exceeds its high bound.');
  return [low, high];
}

function normalizeRanges(raw, label, max = 20) {
  const ranges = object(raw ?? {}, label);
  const out = {};
  const names = Object.keys(ranges);
  if (names.length > max) fail(label + ' allows at most ' + max + ' entries.');
  for (const name of names) {
    fieldName(name, label + ' name');
    out[name] = normalizeRange(ranges[name], label + ' "' + name + '"');
  }
  return out;
}

function normalizeProfile(raw) {
  const profile = object(raw, 'Profile');
  onlyKeys(
    profile,
    ['schemaVersion', 'subject', 'target', 'dimensions', 'ranges', 'pools'],
    'Profile'
  );
  if (profile.schemaVersion !== 1) fail('Profile schemaVersion must be 1.');
  str(profile.subject, 'Profile subject', 200);
  str(profile.target, 'Profile target', 500);
  const fields = ['id'];
  const claim = (name, label) => {
    if (fields.includes(name) || RESERVED.includes(name))
      fail(label + ' "' + name + '" collides with another card field.');
    fields.push(name);
  };
  const dimensions = list(profile.dimensions, 'Profile dimensions', 10).map((raw, index) => {
    const label = 'Profile dimension ' + (index + 1);
    const dimension = object(raw, label);
    onlyKeys(dimension, ['name', 'values'], label);
    const name = fieldName(dimension.name, label + ' name');
    claim(name, label + ' name');
    claim(name + '_note', label + ' note');
    let rangeNames = null;
    const values = list(dimension.values, label + ' values', 50).map((raw, position) => {
      const valueLabel = label + ' value ' + (position + 1);
      const entry = object(raw, valueLabel);
      onlyKeys(entry, ['value', 'share', 'ranges', 'note'], valueLabel);
      const share = num(entry.share, valueLabel + ' share');
      if (share <= 0 || share > 1) fail(valueLabel + ' share must be above 0 and at most 1.');
      const ranges = normalizeRanges(entry.ranges, valueLabel + ' ranges');
      const names = Object.keys(ranges).sort();
      if (rangeNames === null) rangeNames = names;
      else if (names.join(',') !== rangeNames.join(','))
        fail(label + ': every value must declare the same range names.');
      return {
        value: str(entry.value, valueLabel + ' value', 100),
        share,
        ranges,
        note: entry.note === undefined ? null : str(entry.note, valueLabel + ' note', 500),
      };
    });
    distinct(
      values.map((entry) => entry.value),
      label + ' values'
    );
    const total = values.reduce((sum, entry) => sum + entry.share, 0);
    if (Math.abs(total - 1) > 1e-6) fail(label + ' shares must add up to 1.');
    for (const rangeName of rangeNames) claim(rangeName, label + ' range');
    return { name, values };
  });
  const ranges = normalizeRanges(profile.ranges, 'Profile ranges');
  for (const name of Object.keys(ranges)) claim(name, 'Profile range');
  const pools = object(profile.pools ?? {}, 'Profile pools');
  const poolNames = Object.keys(pools);
  if (poolNames.length > 20) fail('Profile pools allows at most 20 entries.');
  const normalizedPools = {};
  for (const name of poolNames) {
    fieldName(name, 'Profile pool name');
    claim(name, 'Profile pool');
    normalizedPools[name] = list(pools[name], 'Profile pool "' + name + '"', 200).map((entry) =>
      str(entry, 'Profile pool "' + name + '" entry', 500)
    );
  }
  return {
    schemaVersion: 1,
    subject: profile.subject,
    target: profile.target,
    dimensions,
    ranges,
    pools: normalizedPools,
    fields,
  };
}

function normalizeUnits(raw) {
  const file = object(raw, 'Units file');
  onlyKeys(file, ['schemaVersion', 'units'], 'Units file');
  if (file.schemaVersion !== 1) fail('Units file schemaVersion must be 1.');
  const units = list(file.units, 'Units', MAX_UNITS).map((raw, index) => {
    const label = 'Unit ' + (index + 1);
    const entry = object(raw, label);
    if (typeof entry.id !== 'string' || !NEXUS_ID.test(entry.id))
      fail(label + ' needs an id of 1-64 lowercase letters, numbers, _ or -.');
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    const scope = distinct(
      list(scopes, label + ' scope', 20).map((item) => scopePath(item, label + ' scope')),
      label + ' scope'
    );
    const unit = { id: entry.id, scope };
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'id' || key === 'scope') continue;
      fieldName(key, label + ' field name');
      if (RESERVED.includes(key)) fail(label + ' field "' + key + '" is reserved.');
      unit[key] = cardValue(value, label + ' field "' + key + '"');
    }
    return unit;
  });
  distinct(
    units.map((unit) => unit.id),
    'Unit ids'
  );
  for (let a = 0; a < units.length; a += 1)
    for (let b = a + 1; b < units.length; b += 1)
      for (const left of units[a].scope)
        for (const right of units[b].scope)
          if (overlap(left, right))
            fail('Units ' + units[a].id + ' and ' + units[b].id + ' share a write scope.');
  return units;
}

/** Every placeholder of a template, or the first unknown one as an error. */
function templatePlaceholders(template) {
  const found = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const token = match[1].trim();
    const [kind, name, extra] = token.split('.');
    const known =
      extra === undefined &&
      ((kind === 'card' && name !== undefined && FIELD.test(name)) ||
        (kind === 'context' && name !== undefined && CONTEXT.test(name)) ||
        (kind === 'answer' && name === 'path') ||
        (kind === 'run' && name === 'id') ||
        (kind === 'unit' && name === 'id') ||
        (kind === 'disclosure' && name === undefined));
    if (!known) fail('Unknown placeholder {{' + token + '}} in the brief template.');
    found.push({ kind, name: name ?? null });
  }
  return found;
}

function checkTemplate(template, cards, contexts) {
  for (const { kind, name } of templatePlaceholders(template)) {
    if (kind === 'card') {
      const missing = cards.find((card) => !Object.hasOwn(card, name));
      if (missing)
        fail('Brief placeholder {{card.' + name + '}} is absent from unit ' + missing.id + '.');
    }
    if (kind === 'context' && !contexts.includes(name))
      fail(
        'Brief placeholder {{context.' +
          name +
          '}} names a context the definition does not declare.'
      );
  }
}

const renderValue = (value) => (Array.isArray(value) ? value.join(', ') : String(value));

function renderBrief(template, { card, contexts, answerPath, runId, disclosure }) {
  return template.replace(PLACEHOLDER, (_, inner) => {
    const [kind, name] = inner.trim().split('.');
    if (kind === 'card') return renderValue(card[name]);
    if (kind === 'context') return contexts[name];
    if (kind === 'answer') return answerPath;
    if (kind === 'run') return runId;
    if (kind === 'unit') return card.id;
    return disclosure;
  });
}

function fieldProblems(name, field, value) {
  const label = 'field "' + name + '"';
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? [] : [label + ' must be true or false'];
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        return [label + ' must be a number'];
      if (field.type === 'integer' && !Number.isInteger(value))
        return [label + ' must be an integer'];
      if (field.min !== undefined && value < field.min) return [label + ' is below ' + field.min];
      if (field.max !== undefined && value > field.max) return [label + ' is above ' + field.max];
      return [];
    }
    case 'string':
      if (typeof value !== 'string') return [label + ' must be a string'];
      if (value.includes('\0')) return [label + ' contains a NUL character'];
      if (value.trim().length < field.min) return [label + ' is shorter than ' + field.min];
      if (value.length > field.max) return [label + ' is longer than ' + field.max];
      return [];
    case 'enum':
      return field.values.includes(value)
        ? []
        : [label + ' must be one of ' + field.values.join(', ')];
    case 'list':
      if (!Array.isArray(value)) return [label + ' must be a list of strings'];
      if (value.length > field.maxItems)
        return [label + ' has more than ' + field.maxItems + ' items'];
      if (value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 1000))
        return [label + ' items must be nonempty strings of at most 1000 characters'];
      return [];
    default:
      return [label + ' has an unknown type'];
  }
}

/** Reasons an answer does not count; an empty list means it does. */
function answerProblems(definition, unitId, answer) {
  if (!isObject(answer)) return ['the answer is not a JSON object'];
  const problems = [];
  if (answer.id !== unitId)
    problems.push('id is ' + JSON.stringify(answer.id) + ', expected "' + unitId + '"');
  for (const name of definition.answer.required)
    if (name !== 'id' && !Object.hasOwn(answer, name))
      problems.push('missing required field "' + name + '"');
  for (const [name, value] of Object.entries(answer)) {
    if (name === 'id') continue;
    // Own keys only: a "__proto__" or "constructor" key in the answer is not a declared field.
    if (!Object.hasOwn(definition.answer.fields, name))
      problems.push('unknown field "' + name + '"');
    else problems.push(...fieldProblems(name, definition.answer.fields[name], value));
  }
  return problems;
}

module.exports = {
  MAX_UNITS,
  ID,
  UNIT_ID,
  NEXUS_ID,
  isObject,
  portablePath,
  scopePath,
  normalizeDefinition,
  normalizeProfile,
  normalizeUnits,
  templatePlaceholders,
  checkTemplate,
  renderBrief,
  answerProblems,
};
