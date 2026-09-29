/**
 * The AI processing register: which AI tools a project uses, what data they see, for what
 * purpose, on which legal basis, for how long and where it goes. `checkRegister` compares it
 * with the integrations present in the project (the adapters BMAD+ installs, the tools'
 * own configuration folders, declared MCP servers) and warns about any it does not cover.
 * The gate is soft: an unregistered tool is a warning, never a failure.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { DERIVED } = require('./packs');

const SCHEMA = 'bmad-plus/ai-processing-register/1';
const CHECK_SCHEMA = 'bmad-plus/ai-register-check/1';
const REGISTER_FILE = '_bmad/ai-processing-register.yaml';
const MAX_BYTES = 256 * 1024;
const MAX_TEXT = 2000;
const REVIEW_INTERVAL_DAYS = 365;
const TEMPLATE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'bmad-plus',
  'packs',
  'pack-shield',
  'shared',
  'ai-processing-register-template.yaml'
);
const BOM = String.fromCharCode(0xfeff);

const REGISTER_KEYS = ['schema', 'controller', 'reviewed', 'tools'];
const ENTRY_KEYS = [
  'id',
  'name',
  'provider',
  'integrations',
  'purpose',
  'data',
  'personalData',
  'legalBasis',
  'retention',
  'transfers',
  'agreement',
];
/** GDPR Art. 6(1)(a) to (f). */
const LEGAL_BASES = [
  'consent',
  'contract',
  'legal-obligation',
  'vital-interests',
  'public-task',
  'legitimate-interests',
];
/** GDPR Art. 45, 46(2)(c), 47 and 49. */
const TRANSFER_MECHANISMS = [
  'adequacy-decision',
  'standard-contractual-clauses',
  'binding-corporate-rules',
  'derogation',
];
const ENTRY_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** A tool id, or mcp: and a server name exactly as declared, control characters excepted. */
const INTEGRATION_ID = /^(?:[a-z0-9][a-z0-9.-]{0,63}|mcp:[^\p{Cc}]{1,256})$/u;

/**
 * Where an AI tool shows it is set up in a project, beyond the adapter files the registry
 * declares. Each marker names the integration ids that cover it.
 */
const TOOL_MARKERS = [
  { ids: ['claude-code'], paths: ['.claude'] },
  { ids: ['cursor'], paths: ['.cursor', '.cursorrules'] },
  { ids: ['gemini-cli', 'antigravity'], paths: ['.gemini'] },
  { ids: ['codex-cli'], paths: ['.codex'] },
  { ids: ['opencode'], paths: ['.opencode', 'opencode.json'] },
  { ids: ['aider'], paths: ['.aider.conf.yml'] },
  { ids: ['github-copilot'], paths: ['.github/copilot-instructions.md'] },
  { ids: ['windsurf'], paths: ['.windsurf', '.windsurfrules'] },
  { ids: ['continue'], paths: ['.continue'] },
];

/** Project files that declare MCP servers, and the key that holds them. */
const MCP_FILES = [
  { file: '.mcp.json', key: 'mcpServers' },
  { file: '.cursor/mcp.json', key: 'mcpServers' },
  { file: '.gemini/settings.json', key: 'mcpServers' },
  { file: '.vscode/mcp.json', key: 'servers' },
];

function fail(message) {
  throw new Error(message);
}

function only(value, keys, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${where}: must be a mapping`);
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length) fail(`${where}: unknown key(s) ${unknown.join(', ')}`);
}

function text(value, where) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT)
    fail(`${where}: expected text of 1 to ${MAX_TEXT} characters`);
  return value.trim();
}

function list(value, where, check) {
  if (!Array.isArray(value) || !value.length) fail(`${where}: must be a non-empty list`);
  return value.map((item, index) => check(item, `${where} ${index + 1}`));
}

/** A calendar date written YYYY-MM-DD; YAML may already have parsed it as a Date. */
function isoDate(value, where) {
  const written = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (
    typeof written !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(written) ||
    new Date(`${written}T00:00:00Z`).toISOString().slice(0, 10) !== written
  )
    fail(`${where}: expected a date written YYYY-MM-DD`);
  return written;
}

function parseEntry(raw, index) {
  const at = `tool ${raw?.id ?? index + 1}`;
  only(raw, ENTRY_KEYS, at);
  if (typeof raw.id !== 'string' || !ENTRY_ID.test(raw.id)) fail(`${at}: invalid id`);
  if (typeof raw.personalData !== 'boolean')
    fail(`${at}: personalData must say true or false whether the tool sees personal data`);
  if (raw.personalData && !LEGAL_BASES.includes(raw.legalBasis))
    fail(`${at}: legalBasis must be one of ${LEGAL_BASES.join(', ')}`);
  if (!raw.personalData && raw.legalBasis !== undefined)
    fail(`${at}: legalBasis applies only when the tool sees personal data`);
  if (!Array.isArray(raw.transfers))
    fail(`${at}: transfers must list where data goes outside the EEA ([] for nowhere)`);
  return {
    id: raw.id,
    name: text(raw.name, `${at}: name`),
    provider: text(raw.provider, `${at}: provider`),
    integrations: list(raw.integrations, `${at}: integration`, (id, where) => {
      if (typeof id !== 'string' || !INTEGRATION_ID.test(id))
        fail(`${where}: "${id}" is not an integration id (a tool id, or mcp:<server>)`);
      return id;
    }),
    purpose: text(raw.purpose, `${at}: purpose`),
    data: list(raw.data, `${at}: data category`, text),
    personalData: raw.personalData,
    legalBasis: raw.legalBasis ?? null,
    retention: text(raw.retention, `${at}: retention`),
    transfers: raw.transfers.map((transfer, i) => {
      const where = `${at}: transfer ${i + 1}`;
      only(transfer, ['to', 'mechanism'], where);
      if (!TRANSFER_MECHANISMS.includes(transfer.mechanism))
        fail(`${where}: mechanism must be one of ${TRANSFER_MECHANISMS.join(', ')}`);
      return { to: text(transfer.to, `${where}: to`), mechanism: transfer.mechanism };
    }),
    agreement: raw.agreement === undefined ? null : text(raw.agreement, `${at}: agreement`),
  };
}

/** Validate a parsed register. Throws on the first defect. */
function parseRegister(doc) {
  only(doc, REGISTER_KEYS, 'register');
  if (doc.schema !== SCHEMA) fail(`register: schema must be "${SCHEMA}"`);
  const tools = Array.isArray(doc.tools) ? doc.tools : fail('register: tools must be a list');
  const entries = tools.map(parseEntry);
  const ids = new Set();
  const covered = new Map();
  for (const entry of entries) {
    if (ids.has(entry.id)) fail(`tool ${entry.id}: duplicate id`);
    ids.add(entry.id);
    for (const integration of entry.integrations) {
      if (covered.has(integration))
        fail(`tool ${entry.id}: ${integration} is already covered by ${covered.get(integration)}`);
      covered.set(integration, entry.id);
    }
  }
  return {
    controller: text(doc.controller, 'register: controller'),
    reviewed: isoDate(doc.reviewed, 'register: reviewed'),
    tools: entries,
  };
}

/** A name shortened and with its control characters escaped, safe to print. */
function printable(name) {
  const shown = name.length > 64 ? `${name.slice(0, 64)}...` : name;
  return shown.replace(/\p{Cc}/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** The index just past the JSON string that opens at `start`. */
function stringEnd(text, start) {
  let end = start + 1;
  while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
  return end + 1;
}

const CLOSING = /\s*[}\]]/y;

/**
 * JSON with comments, as VS Code and Gemini write their settings: line and block comments,
 * then trailing commas, are removed outside strings before the text is parsed as JSON.
 */
function parseJsonc(source) {
  let bare = '';
  for (let i = 0; i < source.length;) {
    if (source[i] === '"') {
      const end = stringEnd(source, i);
      bare += source.slice(i, end);
      i = end;
    } else if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) fail('a block comment is not closed');
      bare += ' ';
      i = end + 2;
    } else bare += source[i++];
  }
  let json = '';
  for (let i = 0; i < bare.length;) {
    if (bare[i] === '"') {
      const end = stringEnd(bare, i);
      json += bare.slice(i, end);
      i = end;
      continue;
    }
    CLOSING.lastIndex = i + 1;
    if (bare[i] !== ',' || !CLOSING.test(bare)) json += bare[i];
    i += 1;
  }
  return JSON.parse(json);
}

/** A regular file or folder inside the project, reached without a symbolic link. */
function present(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function readProjectFile(root, relative) {
  if (!present(root, relative)) return null;
  const file = path.join(root, ...relative.split('/'));
  const stat = fs.statSync(file);
  if (!stat.isFile()) return null;
  if (stat.size > MAX_BYTES) fail(`${relative} exceeds ${MAX_BYTES} bytes`);
  const content = fs.readFileSync(file, 'utf8');
  return content.startsWith(BOM) ? content.slice(1) : content;
}

/**
 * The AI integrations present in the project, each with the ids that would cover it and
 * the files that show it. Unreadable MCP declarations come back as warnings.
 */
function detectIntegrations(projectDir, { adapters = DERIVED.targets.adapters } = {}) {
  const root = path.resolve(projectDir);
  const found = new Map();
  const add = (ids, source) => {
    const key = ids.join('|');
    const entry = found.get(key) || { ids, sources: [] };
    if (!entry.sources.includes(source)) entry.sources.push(source);
    found.set(key, entry);
  };
  // One adapter file can serve several tools (GEMINI.md): any of them covers it.
  const byFile = new Map();
  for (const { tool, file } of adapters) byFile.set(file, [...(byFile.get(file) || []), tool]);
  for (const [file, tools] of byFile) if (present(root, file)) add(tools, file);
  for (const { ids, paths } of TOOL_MARKERS)
    for (const marker of paths) if (present(root, marker)) add(ids, marker);
  const warnings = [];
  for (const { file, key } of MCP_FILES) {
    let doc;
    try {
      const content = readProjectFile(root, file);
      if (content === null) continue;
      doc = parseJsonc(content);
    } catch (error) {
      warnings.push(`${file} cannot be read (${error.message}); its MCP servers are not checked`);
      continue;
    }
    const servers = doc && typeof doc[key] === 'object' && doc[key] ? Object.keys(doc[key]) : [];
    for (const server of servers) {
      // Only a name the register can hold is reported, and never with raw control characters.
      if (INTEGRATION_ID.test(`mcp:${server}`)) add([`mcp:${server}`], file);
      else
        warnings.push(
          `${file} declares the MCP server "${printable(server)}", whose name cannot be registered; it is not checked`
        );
    }
  }
  return { integrations: [...found.values()], warnings };
}

/**
 * Compare the register with the project. Returns the detected integrations with the entry
 * covering each, the register entries matching nothing found here, the warnings, and any
 * error that made the register unreadable.
 */
function checkRegister(projectDir, { now = new Date(), adapters } = {}) {
  const root = path.resolve(projectDir);
  const detected = detectIntegrations(root, adapters ? { adapters } : {});
  const warnings = [...detected.warnings];
  const errors = [];
  let register = null;
  try {
    const source = readProjectFile(root, REGISTER_FILE);
    if (source !== null) register = parseRegister(yaml.load(source));
  } catch (error) {
    errors.push(`${REGISTER_FILE}: ${error.message}`);
  }
  const covering = new Map();
  for (const entry of register?.tools || [])
    for (const id of entry.integrations) covering.set(id, entry.id);
  const integrations = detected.integrations.map(({ ids, sources }) => ({
    ids,
    sources,
    coveredBy: ids.map((id) => covering.get(id)).find(Boolean) || null,
  }));
  const missing = integrations.filter((item) => !item.coveredBy);
  if (!register && !errors.length && integrations.length)
    warnings.push(`no AI processing register at ${REGISTER_FILE}`);
  for (const item of missing)
    warnings.push(
      `${item.ids.join(' or ')} is set up (${item.sources.join(', ')}) but not in the AI processing register`
    );
  if (register) {
    const age = Math.floor((now - new Date(`${register.reviewed}T00:00:00Z`)) / 86400000);
    if (age > REVIEW_INTERVAL_DAYS)
      warnings.push(`the register was last reviewed on ${register.reviewed}, ${age} days ago`);
  }
  const seen = new Set(integrations.flatMap((item) => item.ids));
  return {
    schema: CHECK_SCHEMA,
    registerFile: REGISTER_FILE,
    register: register ? { controller: register.controller, reviewed: register.reviewed } : null,
    status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
    integrations,
    unmatched: (register?.tools || [])
      .filter((entry) => !entry.integrations.some((id) => seen.has(id)))
      .map((entry) => entry.id),
    warnings,
    errors,
  };
}

/**
 * Start the register from the Shield template, never over an existing one. The template's
 * entries are examples: `check` keeps warning until they describe the project's own tools.
 */
function initRegister(projectDir) {
  const [folder, name] = REGISTER_FILE.split('/');
  const target = path.join(path.resolve(projectDir), folder);
  let stat = null;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // A link in place of the folder would write the register outside the project.
  if (stat && !stat.isDirectory()) fail(`${folder} is not a folder`);
  fs.mkdirSync(target, { recursive: true });
  try {
    fs.writeFileSync(path.join(target, name), fs.readFileSync(TEMPLATE, 'utf8'), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') fail(`${REGISTER_FILE} already exists`);
    throw error;
  }
  return REGISTER_FILE;
}

module.exports = {
  SCHEMA,
  CHECK_SCHEMA,
  REGISTER_FILE,
  LEGAL_BASES,
  TRANSFER_MECHANISMS,
  parseRegister,
  initRegister,
  detectIntegrations,
  checkRegister,
};
