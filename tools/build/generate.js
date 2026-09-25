#!/usr/bin/env node
/**
 * BMAD+ Build — registry.yaml → pack artifacts generator (Pillar 1)
 *
 * Reads the root registry.yaml (the single source of truth) and generates the
 * pack data in tools/cli/lib/packs.js and src/bmad-plus/module.yaml:
 *   - PACKS            (CLI pack definitions)
 *   - PACK_ORDER       (install/display order)
 *   - EXPECTED_AGENTS  (what `bmad-plus doctor` verifies after install)
 *   - DERIVED          (counts, display metadata, targets, Python provisioning)
 *
 * Usage:
 *   node tools/build/generate.js              # print generated packs module source
 *   node tools/build/generate.js --json       # print all generated data as JSON
 *   node tools/build/generate.js --out <file> # write generated module source to <file>
 *     --module-out <yaml>                     # also write generated module.yaml
 *   node tools/build/generate.js --check      # verify registry.yaml reproduces the live
 *                                             # packs.js and module.yaml (exit 1 on drift)
 *
 * Author: Laurent Rochetta
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const yaml = require('js-yaml');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_REGISTRY_PATH = path.join(REPO_ROOT, 'registry.yaml');
const DEFAULT_PACKS_MODULE_PATH = path.join(REPO_ROOT, 'tools', 'cli', 'lib', 'packs.js');
const DEFAULT_MODULE_PATH = path.join(REPO_ROOT, 'src', 'bmad-plus', 'module.yaml');
const MODULE_TEMPLATE_PATH = path.join(__dirname, 'module.template.yaml');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

const INSTALL_LAYOUTS = ['loose', 'packaged'];
const OWNED_COUNT_RE =
  /(?<![\w.-])\d+\+?[\s-]+(?:[A-Za-zÀ-ÿ-]+\s+){0,6}(?:agents?|skills?|workflows?|packs?|frameworks?|languages?|reference files)\b/gi;
const STANDARD_PREFIX_RE =
  /\b(?:ISO(?:\/IEC)?|IEC|SOC|NIST(?: SP)?|PCI(?: DSS)?|WCAG|Section)\s*$/i;

function hasOwnedCount(value) {
  return [...value.matchAll(OWNED_COUNT_RE)].some(
    (match) => !STANDARD_PREFIX_RE.test(value.slice(0, match.index))
  );
}

function assertResourcePath(file, where) {
  if (
    typeof file !== 'string' ||
    !file ||
    /[\\:\0]/.test(file) ||
    file.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${where}: required resource must be a portable relative file path`);
  }
}

/** Installed entry points, derived from the same layout used by pack-copy.js. */
function buildRequiredResources(pack, id = pack.pack_dir) {
  const where = `registry.yaml: pack "${id}"`;
  for (const file of [
    ...pack.agents,
    ...(pack.skills || []),
    ...(pack.data || []),
    ...((pack.doctor || {}).pack_agents || []),
    ...((pack.doctor || {}).required_resources || []),
    ...(pack.python_entry ? [pack.python_entry] : []),
  ]) {
    assertResourcePath(file, where);
  }
  const resources = [];
  if (pack.install_layout === 'loose') {
    resources.push(...pack.agents.map((id) => `.agents/skills/${id}/SKILL.md`));
  } else {
    resources.push(
      ...pack.doctor.pack_agents.map((file) => `.agents/skills/${pack.pack_dir}/${file}`)
    );
  }
  resources.push(...(pack.skills || []).map((id) => `.agents/skills/${id}/SKILL.md`));
  resources.push(...(pack.data || []).map((file) => `.agents/data/${file}`));
  resources.push(
    ...((pack.doctor || {}).required_resources || []).map(
      (file) => `.agents/skills/${pack.pack_dir}/${file}`
    )
  );
  if (pack.python_entry) resources.push(`.agents/skills/${pack.pack_dir}/${pack.python_entry}`);
  for (const file of resources) assertResourcePath(file, where);
  return [...new Set(resources)];
}

/**
 * Validate the minimal contract the generator relies on.
 * Throws with a precise message on the first violation.
 */
function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object') {
    throw new Error('registry.yaml: file is empty or not a YAML mapping');
  }
  if (!registry.packs || typeof registry.packs !== 'object') {
    throw new Error('registry.yaml: missing top-level "packs" mapping');
  }

  const seenOrders = new Set();
  for (const [id, pack] of Object.entries(registry.packs)) {
    const where = `registry.yaml: pack "${id}"`;
    if (!pack || typeof pack !== 'object') throw new Error(`${where}: must be a mapping`);
    if (!Number.isInteger(pack.order)) throw new Error(`${where}: missing integer "order"`);
    if (seenOrders.has(pack.order)) throw new Error(`${where}: duplicate order ${pack.order}`);
    seenOrders.add(pack.order);

    if (!pack.cli || typeof pack.cli !== 'object') throw new Error(`${where}: missing "cli" block`);
    for (const field of ['name', 'icon']) {
      if (typeof pack.cli[field] !== 'string' || pack.cli[field] === '') {
        throw new Error(`${where}: missing cli.${field}`);
      }
    }
    if (!pack.cli.desc && !pack.cli.desc_template) {
      throw new Error(`${where}: missing cli.desc or cli.desc_template`);
    }
    for (const [field, value] of Object.entries({
      'cli.desc': pack.cli.desc,
      'cli.desc_template': pack.cli.desc_template,
      summary: pack.summary,
      summary_template: pack.summary_template,
    })) {
      if (value !== undefined && (typeof value !== 'string' || hasOwnedCount(value))) {
        throw new Error(
          `${where}: ${field} must use derived placeholders for owned count dimensions`
        );
      }
    }
    if (!Array.isArray(pack.agents)) throw new Error(`${where}: "agents" must be a list`);
    if (pack.skills !== undefined && !Array.isArray(pack.skills)) {
      throw new Error(`${where}: "skills" must be a list`);
    }
    if (!INSTALL_LAYOUTS.includes(pack.install_layout)) {
      throw new Error(`${where}: "install_layout" must be one of ${INSTALL_LAYOUTS.join('|')}`);
    }
    if (
      (pack.install_layout === 'packaged' || pack.pack_dir !== undefined) &&
      (typeof pack.pack_dir !== 'string' || pack.pack_dir === '')
    ) {
      throw new Error(`${where}: missing "pack_dir"`);
    }
    if (pack.install_layout === 'packaged' && !Array.isArray((pack.doctor || {}).pack_agents)) {
      throw new Error(`${where}: packaged layout requires "doctor.pack_agents" list`);
    }
    if (
      pack.doctor?.required_resources !== undefined &&
      !Array.isArray(pack.doctor.required_resources)
    ) {
      throw new Error(`${where}: doctor.required_resources must be a list`);
    }
    if (
      !Array.isArray(pack.runtime) ||
      pack.runtime.length === 0 ||
      pack.runtime.some((runtime) => !Object.hasOwn(registry.runtimes || {}, runtime))
    ) {
      throw new Error(`${where}: runtime must declare known runtimes`);
    }
    buildRequiredResources(pack, id);
    if (pack.personas !== undefined) {
      if (!Array.isArray(pack.personas)) throw new Error(`${where}: personas must be a list`);
      const roster = new Set([...pack.agents, ...(pack.sub_agents || [])]);
      const ids = new Set();
      for (const persona of pack.personas) {
        if (
          !persona ||
          ['id', 'name', 'role', 'description'].some(
            (key) => typeof persona[key] !== 'string' || !persona[key].trim()
          )
        ) {
          throw new Error(`${where}: each persona needs id, name, role and description`);
        }
        if (!roster.has(persona.id) || ids.has(persona.id)) {
          throw new Error(
            `${where}: persona ${persona.id} is absent from its roster or duplicated`
          );
        }
        ids.add(persona.id);
      }
    }
  }
  const integration = registry.targets?.integration;
  if (
    integration?.execution !== 'host-managed' ||
    integration?.lifecycle_events !== 'not-integrated'
  ) {
    throw new Error(
      'registry.yaml: targets.integration must declare the delivered instruction integration'
    );
  }
  const processBackend = registry.targets?.optional_process_backend;
  if (
    processBackend &&
    (!isDeepStrictEqual(processBackend.adapters, ['command', 'codex-exec']) ||
      processBackend.supervisor !== 'foreground' ||
      processBackend.launch !== 'explicit-plan' ||
      processBackend.collect !== 'exact-attempt-receipt' ||
      processBackend.cancellation !== 'original-owner-direct-child' ||
      processBackend.verification !== 'independent-required' ||
      processBackend.scheduling !== 'none')
  ) {
    throw new Error(
      'registry.yaml: optional process backend differs from the delivered Nexus contract'
    );
  }
  for (const [runtime, config] of Object.entries(registry.runtimes || {})) {
    if (
      typeof config?.min_version !== 'string' ||
      !/^\d+\.\d+(?:\.\d+)?$/.test(config.min_version)
    ) {
      throw new Error(`registry.yaml: runtime "${runtime}" needs a numeric min_version`);
    }
  }
  const tools = new Set();
  for (const adapter of registry.targets.adapters || []) {
    if (!adapter || typeof adapter.tool !== 'string' || !adapter.tool || tools.has(adapter.tool)) {
      throw new Error('registry.yaml: adapter tool names must be nonempty and unique');
    }
    tools.add(adapter.tool);
    assertResourcePath(adapter.file, `registry.yaml: adapter "${adapter.tool}"`);
  }
  return registry;
}

/** Load + validate registry.yaml. */
function loadRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  const raw = fs.readFileSync(registryPath, 'utf8');
  return validateRegistry(yaml.load(raw));
}

/** Pack entries sorted by their declared `order`. */
function sortedPackEntries(registry) {
  return Object.entries(registry.packs).sort((a, b) => a[1].order - b[1].order);
}

/** Generate PACK_ORDER (array of pack ids, sorted by `order`). */
function buildPackOrder(registry) {
  return sortedPackEntries(registry).map(([id]) => id);
}

/**
 * Generate the PACKS object with the exact shape of tools/cli/lib/packs.js.
 * Key-presence rules mirror the hand-written module:
 *   - `data`            only when the registry pack declares a `data` key
 *   - `externalPackage` only when `external_package` is set
 *   - `required`        only when true (other packs omit the key entirely)
 */
function buildPacks(registry) {
  const derived = buildDerived(registry);
  const packs = {};
  for (const [id, p] of sortedPackEntries(registry)) {
    const entry = {
      name: p.cli.name,
      icon: p.cli.icon,
      // Only loose packs install agent directories; packaged agents live in packDir.
      agents: p.install_layout === 'loose' ? [...p.agents] : [],
      skills: [...(p.skills || [])],
    };
    if ('data' in p) entry.data = [...p.data];
    if (p.external_package) entry.externalPackage = p.external_package;
    if (p.pack_dir) {
      entry.packDir = p.pack_dir;
      entry.packSrcDir = p.pack_src_dir || 'packs';
    }
    if (p.required === true) entry.required = true;
    entry.desc = derived.packs[id].desc;
    packs[id] = entry;
  }
  return packs;
}

/** Recursively count reference files; sourceRoot is injectable for fixture trees. */
function countMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    if (entry.isDirectory()) return count + countMarkdownFiles(path.join(dir, entry.name));
    return count + Number(entry.isFile() && entry.name.endsWith('.md'));
  }, 0);
}

function renderSummary(pack, derived, field = 'summary') {
  const template = field === 'summary' ? pack.summary_template : pack.cli.desc_template;
  const fallback = field === 'summary' ? pack.summary : pack.cli.desc;
  if (!template) return fallback || '';
  const values = {
    agent_count: derived.agentCount,
    installer_agent_count: derived.installerAgentCount,
    sub_agent_count: derived.subAgentCount,
    workflow_count: derived.workflowCount,
    framework_count: derived.frameworkCount,
    category_count: derived.categoryCount,
    skill_count: derived.skillCount,
    reference_file_count: derived.referenceFiles,
  };
  return template.replace(/\{([a-z_]+)\}/g, (_match, key) => {
    if (!(key in values)) throw new Error(`Unknown derived summary placeholder: ${key}`);
    return String(values[key]);
  });
}

/** The one derivation engine; its JSON result is shipped for runtime consumers. */
function buildDerived(registry, { sourceRoot = path.join(REPO_ROOT, 'src', 'bmad-plus') } = {}) {
  const packs = {};
  const pythonPacks = {};
  let installerAgents = 0;
  let totalAgents = 0;
  for (const [id, pack] of sortedPackEntries(registry)) {
    const categories = pack.categories || [];
    const categoryAgentCounts = categories.map((category) => (category.agents || []).length);
    const categoryAgentCount = categoryAgentCounts.reduce((sum, count) => sum + count, 0);
    const installerAgentCount = pack.agents.length;
    const subAgentCount = (pack.sub_agents || []).length;
    const facts = {
      id,
      order: pack.order,
      name: pack.cli.name,
      displayName: pack.display_name || pack.cli.name,
      iconEmoji: pack.icon_emoji || '',
      required: pack.required === true,
      installerAgentCount,
      categoryAgentCount,
      agentCount: categoryAgentCount || subAgentCount || installerAgentCount,
      subAgentCount,
      workflowCount:
        (pack.workflows || []).length +
        categories.reduce((sum, c) => sum + (c.workflows || []).length, 0),
      frameworkCount: (pack.compliance_tags || []).length,
      categoryCount: categories.length,
      skillCount: (pack.skills || []).length,
      referenceFiles: pack.pack_dir
        ? countMarkdownFiles(
            path.join(sourceRoot, pack.pack_src_dir || 'packs', pack.pack_dir, 'references')
          )
        : 0,
      categoryAgentCounts,
      runtimes: [...pack.runtime],
      requiredResources: buildRequiredResources(pack, id),
      personas: (pack.personas || []).map(({ id, name, role, description, alias }) => ({
        id,
        name,
        role,
        description,
        ...(alias ? { alias } : {}),
      })),
    };
    facts.summary = renderSummary(pack, facts);
    facts.desc = renderSummary(pack, facts, 'description');
    facts.description = facts.desc;
    packs[id] = facts;
    installerAgents += installerAgentCount;
    totalAgents += new Set([
      ...pack.agents,
      ...(pack.sub_agents || []),
      ...categories.flatMap((c) => c.agents || []),
    ]).size;
    if ((pack.runtime || []).includes('python')) {
      const packagePath =
        pack.python_package || `src/bmad-plus/${pack.pack_src_dir || 'packs'}/${pack.pack_dir}`;
      pythonPacks[id] = {
        requirements: [...packagePath.split(/[\\/]/), 'requirements.txt'],
        verifyModules: [...(pack.python_verify_modules || [])],
      };
    }
  }
  const { LANGUAGES } = require('../cli/i18n');
  return {
    product: {
      code: registry.product.code,
      displayName: registry.product.display_name,
      version: registry.product.version,
      derivedFrom: registry.product.derived_from,
    },
    packOrder: buildPackOrder(registry),
    packCount: Object.keys(packs).length,
    installerAgents,
    totalAgents,
    languages: Object.keys(LANGUAGES),
    packs,
    pythonPacks,
    diagnostics: {
      schemaVersion: 1,
      processExecution: registry.targets.optional_process_backend || null,
      runtimeMinimums: Object.fromEntries(
        Object.entries(registry.runtimes).map(([id, runtime]) => [id, runtime.min_version])
      ),
      integrations: Object.fromEntries(
        registry.targets.adapters.map(({ tool, file }) => [
          tool,
          {
            instructionFile: file,
            execution: registry.targets.integration.execution,
            lifecycleEvents: registry.targets.integration.lifecycle_events,
          },
        ])
      ),
    },
    targets: {
      spine: registry.targets.spine,
      adapters: registry.targets.adapters.map(({ tool, file }) => ({ tool, file })),
      models_supported: [...registry.targets.models_supported],
    },
  };
}

/** Preserve project questions/compatibility separately from generated pack facts. */
function generateModuleSource(registry, templatePath = MODULE_TEMPLATE_PATH) {
  const moduleConfig = yaml.load(fs.readFileSync(templatePath, 'utf8'));
  const derived = buildDerived(registry);
  moduleConfig.code = registry.product.code;
  moduleConfig.packs = {};
  for (const [id, pack] of sortedPackEntries(registry)) {
    const facts = derived.packs[id];
    const entry = {
      name: facts.displayName,
      icon: pack.icon_emoji,
      description: facts.summary || facts.desc,
      required: facts.required,
      agents: [...pack.agents],
      skills: [...(pack.skills || [])],
    };
    for (const key of [
      'data',
      'external_package',
      'orchestrator',
      'categories',
      'workflows',
      'sub_agents',
      'required_keys',
      'optional_keys',
      'cohabitation_warning',
    ]) {
      if (key in pack) entry[key] = JSON.parse(JSON.stringify(pack[key]));
    }
    if (pack.install_layout === 'packaged') {
      entry.packDir = pack.pack_dir;
      entry.packSrcDir = pack.pack_src_dir || 'packs';
    }
    moduleConfig.packs[id] = entry;
  }
  moduleConfig.install_packs['multi-select'] = [
    ...derived.packOrder
      .filter((id) => !derived.packs[id].required)
      .map((id) => ({
        value: id,
        label: `${registry.packs[id].icon_emoji} ${derived.packs[id].displayName} — ${derived.packs[id].summary || derived.packs[id].desc}`,
      })),
    { value: 'all', label: 'Tout installer' },
    { value: 'none', label: 'Aucun — Core uniquement' },
  ];
  return (
    '# AUTO-GENERATED from registry.yaml + tools/build/module.template.yaml — DO NOT EDIT.\n' +
    yaml.dump(moduleConfig, { lineWidth: 110, noRefs: true })
  );
}

/**
 * Generate EXPECTED_AGENTS (consumed by `bmad-plus doctor`).
 *   - loose    packs → agent DIRECTORIES checked under .agents/skills/
 *   - packaged packs → packDir checked, agent FILES checked inside it
 */
function buildExpectedAgents(registry) {
  const expected = {};
  for (const [id, p] of sortedPackEntries(registry)) {
    if (p.install_layout === 'loose') {
      expected[id] = { agents: [...p.agents], packDir: null };
    } else {
      expected[id] = { agents: [], packDir: p.pack_dir, packAgents: [...p.doctor.pack_agents] };
    }
  }
  return expected;
}

/** Convenience: all runtime artifacts at once. */
function buildAll(registry) {
  return {
    PACKS: buildPacks(registry),
    PACK_ORDER: buildPackOrder(registry),
    EXPECTED_AGENTS: buildExpectedAgents(registry),
    DERIVED: buildDerived(registry),
  };
}

/**
 * Emit a drop-in replacement source for tools/cli/lib/packs.js.
 * Evaluating this source yields exports deep-equal to the hand-written module.
 */
function generatePacksModuleSource(registry) {
  const { PACKS, PACK_ORDER, EXPECTED_AGENTS, DERIVED } = buildAll(registry);
  const j = (value) => JSON.stringify(value, null, 2);
  return [
    '/**',
    ' * BMAD+ Shared PACKS Module — AUTO-GENERATED, DO NOT EDIT.',
    ' * Source of truth: registry.yaml (repo root).',
    ' * Regenerate: node tools/build/generate.js --out tools/cli/lib/packs.js',
    ' *',
    ' * Author: Laurent Rochetta',
    ' */',
    '',
    `const PACKS = ${j(PACKS)};`,
    '',
    `const PACK_ORDER = ${j(PACK_ORDER)};`,
    '',
    `const EXPECTED_AGENTS = ${j(EXPECTED_AGENTS)};`,
    '',
    `const DERIVED = ${j(DERIVED)};`,
    '',
    'module.exports = { PACKS, PACK_ORDER, EXPECTED_AGENTS, DERIVED };',
    '',
  ].join('\n');
}

/** Human-readable drill-down for a mismatching keyed object. */
function describeDiff(label, generated, current, mismatches) {
  generated = generated || {};
  current = current || {};
  if (Array.isArray(generated) || Array.isArray(current)) {
    mismatches.push(
      `${label}: generated ${JSON.stringify(generated)} != current ${JSON.stringify(current)}`
    );
    return;
  }
  const ids = new Set([...Object.keys(generated || {}), ...Object.keys(current || {})]);
  for (const id of ids) {
    if (!(id in generated)) {
      mismatches.push(`${label}.${id}: present in packs.js but missing from registry.yaml`);
    } else if (!(id in current)) {
      mismatches.push(`${label}.${id}: present in registry.yaml but missing from packs.js`);
    } else if (!isDeepStrictEqual(generated[id], current[id])) {
      mismatches.push(
        `${label}.${id}: generated ${JSON.stringify(generated[id])} != current ${JSON.stringify(current[id])}`
      );
    }
  }
}

/**
 * Every source path the installer copies from (see pack-copy.js listPackFiles)
 * must exist; the copier tolerates a missing path, so the build must not.
 */
function checkSourcePaths(packs, packageRoot = REPO_ROOT) {
  const sourceRoot = path.join(packageRoot, 'src', 'bmad-plus');
  const missing = [];
  for (const [id, pack] of Object.entries(packs)) {
    const declared = [
      ...pack.agents.map((name) => path.join(sourceRoot, 'agents', name)),
      ...pack.skills.map((name) => path.join(sourceRoot, 'skills', name)),
      ...(pack.data || []).map((name) => path.join(sourceRoot, 'data', name)),
      ...(pack.externalPackage ? [path.join(packageRoot, pack.externalPackage, 'skills')] : []),
      ...(pack.packDir ? [path.join(sourceRoot, pack.packSrcDir, pack.packDir)] : []),
    ];
    for (const source of declared) {
      if (!fs.existsSync(source)) {
        const relative = path.relative(packageRoot, source).split(path.sep).join('/');
        missing.push(`PACKS.${id}: declared source path does not exist: ${relative}`);
      }
    }
  }
  return missing;
}

/**
 * `--check` mode: prove registry.yaml reproduces the live packs.js exactly,
 * and that product.version matches package.json.
 * Returns { ok, mismatches } — never throws on drift (only on unreadable input).
 */
function check({
  registryPath = DEFAULT_REGISTRY_PATH,
  packsModulePath = DEFAULT_PACKS_MODULE_PATH,
  packageJsonPath = PACKAGE_JSON_PATH,
  modulePath = DEFAULT_MODULE_PATH,
} = {}) {
  const registry = loadRegistry(registryPath);
  delete require.cache[require.resolve(packsModulePath)];
  const current = require(packsModulePath);
  const generated = buildAll(registry);
  const mismatches = [];

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  mismatches.push(...checkSourcePaths(generated.PACKS));
  const { checkPythonDelivery } = require('./pack-delivery');
  mismatches.push(...checkPythonDelivery(registry, { packageRoot: REPO_ROOT, packageJson: pkg }));
  try {
    require('../cli/lib/studio').validatePack(
      path.join(REPO_ROOT, 'src/bmad-plus/packs/pack-dev-studio'),
      registry.packs['dev-studio']
    );
  } catch (error) {
    mismatches.push('Dev Studio: ' + error.message);
  }
  if (!registry.product || registry.product.version !== pkg.version) {
    const declared = registry.product ? registry.product.version : undefined;
    mismatches.push(
      `product.version: registry.yaml declares "${declared}" but package.json is "${pkg.version}"`
    );
  }

  for (const key of ['PACKS', 'PACK_ORDER', 'EXPECTED_AGENTS', 'DERIVED']) {
    if (!isDeepStrictEqual(generated[key], current[key])) {
      describeDiff(key, generated[key], current[key], mismatches);
    }
  }
  if (
    fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n') !== generateModuleSource(registry)
  ) {
    mismatches.push('module.yaml: generated pack metadata differs from registry.yaml');
  }

  return { ok: mismatches.length === 0, mismatches };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--check')) {
    const result = check();
    if (result.ok) {
      console.log('OK — registry.yaml reproduces packs.js and module.yaml (no drift).');
      return 0;
    }
    console.error('DRIFT DETECTED between registry.yaml and tools/cli/lib/packs.js:');
    for (const m of result.mismatches) console.error(`  - ${m}`);
    return 1;
  }

  const registry = loadRegistry();

  if (args.includes('--json')) {
    console.log(JSON.stringify(buildAll(registry), null, 2));
    return 0;
  }

  const source = generatePacksModuleSource(registry);
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1) {
    const outPath = args[outIdx + 1];
    if (!outPath) {
      console.error('--out requires a file path');
      return 1;
    }
    fs.writeFileSync(path.resolve(outPath), source, 'utf8');
    const moduleOutIdx = args.indexOf('--module-out');
    if (moduleOutIdx !== -1) {
      if (!args[moduleOutIdx + 1]) throw new Error('--module-out requires a file path');
      fs.writeFileSync(
        path.resolve(args[moduleOutIdx + 1]),
        generateModuleSource(registry),
        'utf8'
      );
    }
    console.log(`Generated ${path.resolve(outPath)} from registry.yaml`);
    return 0;
  }

  console.log(source);
  return 0;
}

module.exports = {
  DEFAULT_REGISTRY_PATH,
  DEFAULT_PACKS_MODULE_PATH,
  DEFAULT_MODULE_PATH,
  MODULE_TEMPLATE_PATH,
  loadRegistry,
  validateRegistry,
  buildPacks,
  buildPackOrder,
  buildExpectedAgents,
  buildAll,
  buildDerived,
  renderSummary,
  generateModuleSource,
  generatePacksModuleSource,
  check,
  checkSourcePaths,
  main,
};

if (require.main === module) {
  process.exitCode = main(process.argv);
}
