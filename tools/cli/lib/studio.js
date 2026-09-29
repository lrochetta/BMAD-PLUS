/** Read-only Dev Studio resource resolution; execution belongs to the host. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { safeTarget } = require('../../build/generate-adapters');

const PACK = '.agents/skills/pack-dev-studio';
const MAX_FILE = 256 * 1024;
const MAX_CONTEXT = 2 * 1024 * 1024;
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function relativePath(file) {
  if (
    typeof file !== 'string' ||
    !file ||
    /[\\:\0?#{}]/.test(file) ||
    file.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('Expected a portable relative file path: ' + String(file));
  }
  return file;
}

function target(root, file) {
  relativePath(file);
  const result = safeTarget(root, file);
  let parent = path.resolve(root);
  for (const part of file.split('/')) {
    if (!fs.existsSync(parent)) break;
    const names = fs.readdirSync(parent);
    if (!names.includes(part) && names.some((name) => name.toLowerCase() === part.toLowerCase())) {
      throw new Error('Path case mismatch: ' + file);
    }
    parent = path.join(parent, part);
  }
  return result;
}

function readText(root, file, limit = MAX_FILE) {
  const resolved = target(root, file);
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size > limit) throw new Error('Resource is not bounded text: ' + file);
  const bytes = fs.readFileSync(resolved);
  if (bytes.includes(0) || bytes.length > limit)
    throw new Error('Resource is not bounded text: ' + file);
  const content = bytes.toString('utf8');
  if (!Buffer.from(content).equals(bytes)) throw new Error('Resource is not UTF-8: ' + file);
  return { path: file, sha256: hash(bytes), content };
}

function readJson(root, file) {
  try {
    return JSON.parse(readText(root, file).content);
  } catch (error) {
    throw new Error(file + ': ' + error.message, { cause: error });
  }
}

function loadCatalog(packRoot) {
  const catalog = readJson(packRoot, 'shared/catalog.json');
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.agents) ||
    !Array.isArray(catalog.workflows) ||
    !Array.isArray(catalog.compatibility) ||
    !catalog.agents.length ||
    !catalog.workflows.length
  ) {
    throw new Error('Unsupported Dev Studio catalog');
  }
  catalog.compatibility.forEach(relativePath);
  const agents = new Set();
  const routes = new Set();
  const entries = new Set();
  for (const agent of catalog.agents) {
    if (
      !agent ||
      !/^[a-z][a-z0-9-]*$/.test(agent.id) ||
      agents.has(agent.id) ||
      typeof agent.persona !== 'string' ||
      !agent.persona.trim()
    )
      throw new Error('Invalid or duplicate persona');
    relativePath(agent.path);
    if (entries.has(agent.path)) throw new Error('Duplicate catalog entry: ' + agent.path);
    entries.add(agent.path);
    agents.add(agent.id);
  }
  for (const workflow of catalog.workflows) {
    if (
      !workflow ||
      !/^[a-z][a-z0-9-]*$/.test(workflow.id) ||
      !agents.has(workflow.agent) ||
      !['request', 'artifact', 'project', 'none'].includes(workflow.input) ||
      !Array.isArray(workflow.aliases) ||
      !Array.isArray(workflow.resources)
    ) {
      throw new Error('Invalid workflow declaration');
    }
    relativePath(workflow.path);
    if (entries.has(workflow.path)) throw new Error('Duplicate catalog entry: ' + workflow.path);
    entries.add(workflow.path);
    for (const resource of workflow.resources) relativePath(resource);
    for (const route of [workflow.id, ...workflow.aliases]) {
      if (typeof route !== 'string' || !/^[a-z][a-z0-9-]*$/.test(route) || routes.has(route)) {
        throw new Error('Invalid or duplicate workflow route: ' + route);
      }
      routes.add(route);
    }
  }
  return catalog;
}

/** Inline and reference-style Markdown links are packaged dependencies. */
function localLinks(content, file) {
  const destinations = [
    ...Array.from(
      content.matchAll(/!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g),
      (m) => m[1]
    ),
    ...Array.from(content.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*<?([^\s>]+)>?/gm), (m) => m[1]),
  ];
  return destinations
    .filter((link) => !/^(?:https?:|mailto:|#)/i.test(link))
    .map((link) => {
      const clean = decodeURIComponent(link.split('#')[0]);
      if (!clean || /[\\:\0?{}]/.test(clean) || path.posix.isAbsolute(clean)) {
        throw new Error('Unsupported resource link in ' + file + ': ' + link);
      }
      return relativePath(path.posix.normalize(path.posix.join(path.posix.dirname(file), clean)));
    });
}

function validatePack(packRoot, expected) {
  const catalog = loadCatalog(packRoot);
  if (expected) {
    const workflows = Object.values(expected.categories)
      .flatMap((category) => category.workflows)
      .sort();
    if (
      JSON.stringify(workflows) !== JSON.stringify(catalog.workflows.map((w) => w.id).sort()) ||
      JSON.stringify([...expected.sub_agents].sort()) !==
        JSON.stringify(catalog.agents.map((a) => a.id).sort())
    ) {
      throw new Error('Dev Studio catalog disagrees with registry routes');
    }
  }
  const queue = [
    'SKILL.md',
    'README.md',
    'dev-studio-orchestrator.md',
    'shared/execution.md',
    ...catalog.compatibility,
    ...catalog.agents.map((a) => a.path),
    ...catalog.workflows.flatMap((w) => [w.path, ...w.resources]),
  ];
  const visited = new Set();
  let bytes = 0;
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    if (visited.size >= 256) throw new Error('Too many Dev Studio resources');
    const resource = readText(packRoot, file);
    bytes += Buffer.byteLength(resource.content);
    if (bytes > MAX_CONTEXT) throw new Error('Dev Studio resource graph is too large');
    visited.add(file);
    if (file.endsWith('.md')) {
      if (
        /\{(?:workflow|agent)\.[^}]+\}|\{(?:project-root|planning_artifacts|communication_language)\}/.test(
          resource.content
        )
      ) {
        throw new Error('Unresolved runtime declaration: ' + file);
      }
      queue.push(...localLinks(resource.content, file));
    }
  }
  return { catalog, resources: [...visited].sort() };
}

function resolveConfig(projectDir) {
  const file = '_bmad/config.yaml';
  const location = target(projectDir, file);
  let supplied = {};
  let source = null;
  if (fs.existsSync(location)) {
    source = readText(projectDir, file, 64 * 1024);
    try {
      supplied = yaml.load(source.content);
    } catch (error) {
      throw new Error(file + ': ' + error.message, { cause: error });
    }
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
      throw new Error(file + ' must be a YAML mapping');
    }
  }
  const config = {
    user_name: 'user',
    communication_language: 'English',
    document_output_language: 'English',
    output_folder: '_bmad-output',
    project_name: path.basename(projectDir),
  };
  const defaultsUsed = [];
  for (const key of Object.keys(config)) {
    if (Object.hasOwn(supplied, key)) {
      if (typeof supplied[key] !== 'string' || !supplied[key].trim()) {
        throw new Error(file + ': ' + key + ' must be a nonempty string');
      }
      config[key] = supplied[key];
    } else defaultsUsed.push(key);
  }
  relativePath(config.output_folder);
  return { values: config, defaultsUsed, source };
}

function installedPack(projectDir) {
  // Validate ancestors through an entry path before using the pack as a root.
  target(projectDir, PACK + '/SKILL.md');
  const packRoot = path.join(projectDir, PACK);
  if (!fs.existsSync(packRoot))
    throw new Error('Dev Studio is not installed. Run bmad-plus install --packs core,dev-studio');
  return packRoot;
}

function prepare({
  projectDir = process.cwd(),
  workflow: route,
  request = '',
  inputs = [],
  packRoot,
} = {}) {
  projectDir = path.resolve(projectDir);
  if (!fs.statSync(projectDir).isDirectory()) throw new Error('Project must be a directory');
  packRoot = packRoot || installedPack(projectDir);
  const { catalog } = validatePack(packRoot);
  const workflow = catalog.workflows.find((w) => w.id === route || w.aliases.includes(route));
  if (!workflow) throw new Error('Unknown Dev Studio workflow: ' + route);
  if (
    typeof request !== 'string' ||
    Buffer.byteLength(request) > MAX_FILE ||
    !Array.isArray(inputs) ||
    inputs.length > 32
  ) {
    throw new Error('Invalid or oversized workflow inputs');
  }
  const config = resolveConfig(projectDir);
  const loadedInputs = [...new Set(inputs)].map((file) => readText(projectDir, file));
  const agent = catalog.agents.find((a) => a.id === workflow.agent);
  const routes = new Set([
    ...catalog.agents.map((a) => a.path),
    ...catalog.workflows.map((w) => w.path),
    'SKILL.md',
    'README.md',
    'dev-studio-orchestrator.md',
    'shared/catalog.json',
  ]);
  const queue = ['shared/execution.md', agent.path, workflow.path, ...workflow.resources];
  const instructions = [];
  const loaded = new Set();
  while (queue.length) {
    const file = queue.shift();
    if (loaded.has(file)) continue;
    loaded.add(file);
    const resource = readText(packRoot, file);
    instructions.push(resource);
    if (file.endsWith('.md'))
      queue.push(...localLinks(resource.content, file).filter((link) => !routes.has(link)));
  }
  const outputPath = `${config.values.output_folder}/dev-studio/${workflow.id}.md`;
  const outputTarget = target(projectDir, outputPath);
  const previousReport = fs.existsSync(outputTarget) ? readText(projectDir, outputPath) : null;
  const size = [
    ...loadedInputs,
    ...instructions,
    ...(previousReport ? [previousReport] : []),
  ].reduce(
    (total, item) => total + Buffer.byteLength(item.content),
    Buffer.byteLength(request) + Buffer.byteLength(config.source?.content || '')
  );
  if (size > MAX_CONTEXT) throw new Error('Prepared context exceeds 2 MiB');
  const missingInputs =
    workflow.input === 'artifact' && !loadedInputs.length
      ? ['Supply a project artifact with --input RELATIVE_FILE.']
      : ['request', 'project'].includes(workflow.input) && !request.trim() && !loadedInputs.length
        ? ['Supply the task scope with --request TEXT or --input RELATIVE_FILE.']
        : [];
  return {
    schemaVersion: 1,
    status: missingInputs.length ? 'needs-input' : 'ready',
    execution: 'host-managed',
    executed: false,
    workflow: workflow.id,
    agent: agent.persona,
    catalogSha256: readText(packRoot, 'shared/catalog.json').sha256,
    projectDir,
    config,
    request,
    inputs: loadedInputs,
    instructions,
    outputPath,
    previousReport,
    missingInputs,
  };
}

module.exports = { loadCatalog, localLinks, validatePack, resolveConfig, installedPack, prepare };
