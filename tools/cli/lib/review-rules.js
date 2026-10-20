/**
 * Review checklists chosen by path. Built-in rules ship with the CLI; an installed pack may
 * add its own (Shield's compliance rules); a project adds, replaces or disables rules in
 * `_bmad/review-rules.yaml`. Every rule whose patterns match a file applies to it — rules
 * add up, so a broad project rule never silences the built-in ones by accident. A rule may
 * name the compliance controls it examines. The resolved set is hashed into the review scope.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { compile, matchesAny } = require('./glob');
const { parseControls } = require('./control-refs');
const { PACKS } = require('./packs');

const SCHEMA = 'bmad-plus/review-rules/1';
const BUILTIN_DIR = path.join(__dirname, '..', 'review-rules');
const PROJECT_FILE = path.join('_bmad', 'review-rules.yaml');
/** Where an installed pack keeps its rules, below its own folder in `.agents/skills`. */
const PACK_RULES_DIR = 'review-rules';
const RULE_ID = /^[a-z0-9][a-z0-9-]{0,60}$/;
const RULE_KEYS = ['id', 'title', 'group', 'globs', 'doc', 'controls'];
const MAX_DOC_BYTES = 64 * 1024;
const MAX_INDEX_BYTES = 256 * 1024;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** A file this module reads must be a regular file inside `root`, of bounded size. */
function readConfined(root, relative, maxBytes, what) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative))
    throw new Error(`${what}: expected a relative path, got "${relative}"`);
  const realRoot = fs.realpathSync(root);
  const file = path.resolve(realRoot, relative);
  if (file !== realRoot && !file.startsWith(realRoot + path.sep))
    throw new Error(`${what}: "${relative}" leaves ${root}`);
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) throw new Error(`${what}: "${relative}" is not a regular file`);
  if (stat.size > maxBytes) throw new Error(`${what}: "${relative}" exceeds ${maxBytes} bytes`);
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function parseLayer(root, indexName, layer) {
  const where = `${layer} review rules (${path.join(root, indexName)})`;
  let doc;
  try {
    doc = yaml.load(readConfined(root, indexName, MAX_INDEX_BYTES, where));
  } catch (error) {
    throw new Error(`${where}: ${error.message}`, { cause: error });
  }
  if (!doc || doc.schema !== SCHEMA) throw new Error(`${where}: schema must be "${SCHEMA}"`);
  const extra = Object.keys(doc).filter((key) => !['schema', 'rules', 'disable'].includes(key));
  if (extra.length) throw new Error(`${where}: unknown key(s) ${extra.join(', ')}`);
  if (layer !== 'project' && doc.disable)
    throw new Error(`${where}: only a project's rules can disable`);
  const disable = doc.disable || [];
  if (!Array.isArray(disable) || !disable.every((id) => typeof id === 'string'))
    throw new Error(`${where}: disable must be a list of rule ids`);
  const rules = doc.rules || [];
  if (!Array.isArray(rules)) throw new Error(`${where}: rules must be a list`);
  const seen = new Set();
  const parsed = rules.map((rule, index) => {
    const at = `${where}: rule ${rule?.id ?? index}`;
    if (!rule || typeof rule !== 'object') throw new Error(`${at}: must be a mapping`);
    const unknown = Object.keys(rule).filter((key) => !RULE_KEYS.includes(key));
    if (unknown.length) throw new Error(`${at}: unknown key(s) ${unknown.join(', ')}`);
    if (typeof rule.id !== 'string' || !RULE_ID.test(rule.id)) throw new Error(`${at}: invalid id`);
    if (seen.has(rule.id)) throw new Error(`${at}: duplicate id`);
    seen.add(rule.id);
    if (typeof rule.title !== 'string' || !rule.title.trim())
      throw new Error(`${at}: title is required`);
    if (rule.group !== undefined && !(typeof rule.group === 'string' && RULE_ID.test(rule.group)))
      throw new Error(`${at}: invalid group`);
    if (
      !Array.isArray(rule.globs) ||
      !rule.globs.length ||
      !rule.globs.every((g) => typeof g === 'string' && g)
    )
      throw new Error(`${at}: globs must be a non-empty list of patterns`);
    for (const glob of rule.globs) compile(glob);
    const controls = rule.controls === undefined ? [] : parseControls(rule.controls, at);
    if (!/\.md$/i.test(String(rule.doc))) throw new Error(`${at}: doc must be a Markdown file`);
    const text = readConfined(root, rule.doc, MAX_DOC_BYTES, at).trim();
    if (!text) throw new Error(`${at}: ${rule.doc} is empty`);
    return {
      id: rule.id,
      title: rule.title.trim(),
      // A rule family reviewers can split by; a rule without one is a family of its own.
      group: rule.group === undefined ? rule.id : rule.group,
      globs: [...rule.globs],
      controls,
      layer,
      source: rule.doc,
      text,
    };
  });
  return { rules: parsed, disable };
}

/** Rule indexes of the packs installed in the project, in pack order. */
function installedPackLayers(projectDir) {
  const layers = [];
  for (const [pack, { packDir }] of Object.entries(PACKS)) {
    if (!packDir) continue;
    const relative = ['.agents', 'skills', packDir, PACK_RULES_DIR, 'index.yaml'];
    if (fs.existsSync(path.join(projectDir, ...relative)))
      layers.push({ pack, file: relative.join('/') });
  }
  return layers;
}

/**
 * The effective rule set for a project: built-in rules, then those of installed packs, then
 * the project's own. A pack only adds; a project rule with an existing id replaces it, and
 * `disable` removes rules by id and is reported.
 */
function loadRuleset(projectDir, { builtinDir = BUILTIN_DIR } = {}) {
  const builtin = parseLayer(builtinDir, 'index.yaml', 'builtin');
  const ordered = new Map(builtin.rules.map((rule) => [rule.id, rule]));
  const packFiles = installedPackLayers(projectDir);
  for (const { pack, file } of packFiles) {
    const layer = parseLayer(path.join(projectDir, path.dirname(file)), 'index.yaml', 'pack');
    for (const rule of layer.rules) {
      if (ordered.has(rule.id))
        throw new Error(`${pack} review rules: rule ${rule.id} already exists; a pack only adds`);
      ordered.set(rule.id, { ...rule, pack });
    }
  }
  let disabled = [];
  const projectIndex = path.join(projectDir, PROJECT_FILE);
  let project = null;
  if (fs.existsSync(projectIndex)) {
    project = parseLayer(path.dirname(projectIndex), path.basename(projectIndex), 'project');
    for (const rule of project.rules) ordered.set(rule.id, rule);
    const unknown = project.disable.filter((id) => !ordered.has(id));
    if (unknown.length)
      throw new Error(`project review rules: disable names unknown rule(s) ${unknown.join(', ')}`);
    disabled = [...project.disable];
    for (const id of disabled) ordered.delete(id);
  }
  const list = [...ordered.values()];
  // Controls join the fingerprint only when a rule names some, so a rule set without any
  // keeps the hash it had before rules could carry controls.
  const fingerprint = list.map((rule) => [
    rule.id,
    rule.group,
    rule.layer,
    rule.globs,
    sha256(rule.text),
    ...(rule.controls.length ? [rule.controls] : []),
  ]);
  return {
    rules: list,
    disabled,
    packFiles: packFiles.map(({ file }) => file),
    projectFile: project ? PROJECT_FILE.split(path.sep).join('/') : null,
    sha256: sha256(JSON.stringify({ rules: fingerprint, disabled })),
  };
}

/** Ids of every rule that applies to a path, in rule order. */
function rulesFor(ruleset, file) {
  return ruleset.rules.filter((rule) => matchesAny(file, rule.globs)).map((rule) => rule.id);
}

/** The rule families of a set of rule ids, each with its rules, in rule order. */
function groupsOf(ruleset, ids) {
  const groups = new Map();
  for (const rule of ruleset.rules) {
    if (!ids.includes(rule.id)) continue;
    groups.set(rule.group, [...(groups.get(rule.group) || []), rule.id]);
  }
  return [...groups].map(([id, rules]) => ({ id, rules }));
}

/**
 * The compliance controls a set of rule ids examines, each with the rules that name it, in
 * rule order. A control touched is a prompt to look at its requirement, not a finding.
 */
function controlsOf(ruleset, ids) {
  const controls = new Map();
  for (const rule of ruleset.rules) {
    if (!ids.includes(rule.id)) continue;
    for (const control of rule.controls)
      controls.set(control, [...(controls.get(control) || []), rule.id]);
  }
  return [...controls].map(([id, rules]) => ({ id, rules }));
}

/**
 * The reviewer's checklist for a scope: the controls the change touches, then each
 * applicable rule once, with the files it covers. Rules that match nothing are left out.
 */
function checklist(ruleset, byPath, { title = 'Review checklist' } = {}) {
  const files = new Map();
  for (const [file, ids] of Object.entries(byPath)) {
    for (const id of ids) files.set(id, [...(files.get(id) || []), file]);
  }
  const applied = ruleset.rules.filter((rule) => files.has(rule.id));
  const controls = controlsOf(
    ruleset,
    applied.map((rule) => rule.id)
  );
  const touched = controls.length
    ? [
        '## Controls this change touches',
        '',
        ...controls.map(
          ({ id, rules }) => `- \`${id}\` — ${rules.map((rule) => `\`${rule}\``).join(', ')}`
        ),
        '',
        'List in the `controls` of a finding the control it breaks; a control listed here is not a finding.',
        '',
      ]
    : [];
  const sections = applied.map((rule) =>
    [
      `## ${rule.title} \`${rule.id}\`${rule.layer === 'project' ? ' (project rule)' : ''}${rule.pack ? ` (${rule.pack} rule)` : ''}`,
      '',
      `Group: \`${rule.group}\``,
      ...(rule.controls.length
        ? ['', `Controls: ${rule.controls.map((control) => `\`${control}\``).join(', ')}`]
        : []),
      '',
      `Applies to: ${files
        .get(rule.id)
        .map((file) => `\`${file}\``)
        .join(', ')}`,
      '',
      rule.text,
    ].join('\n')
  );
  return [
    `# ${title}`,
    '',
    `Rule set ${ruleset.sha256.slice(0, 12)}. Report a finding only with its quoted code; a rule is a prompt to look, not a finding.`,
    '',
    ...touched,
    ...sections.flatMap((section) => [section, '']),
  ].join('\n');
}

module.exports = {
  SCHEMA,
  BUILTIN_DIR,
  PROJECT_FILE,
  PACK_RULES_DIR,
  loadRuleset,
  rulesFor,
  groupsOf,
  controlsOf,
  checklist,
};
