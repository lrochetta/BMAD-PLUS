'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const {
  BASE,
  PACK,
  MAX_FILE,
  MAX_CONTEXT,
  projectArtifact,
  digest,
  identifier,
  textFile,
  present,
  writeOnce,
  selection,
  strings,
  locale,
  loadConfig,
  voice,
} = require('./ghostwriter-project');

const WORKFLOWS = [
  'voice-profile',
  'draft',
  'humanize',
  'improve',
  'localize',
  'agent-output-review',
];
const FORMATS = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};
const manifestPath = (id) => BASE + '/runs/' + identifier(id) + '/manifest.json';

function applies(file, entries) {
  return entries.some((entry) => {
    const prefix = entry.replace(/\/$/, '');
    return file === prefix || file.startsWith(prefix + '/');
  });
}

function build(root, id, request) {
  const config = loadConfig(root);
  const installManifest = '_bmad/.bmad-plus-install.json';
  if (
    present(root, installManifest) &&
    !JSON.parse(textFile(root, installManifest).content).packs?.includes('ghostwriter')
  ) {
    throw new Error('Ghostwriter is not selected in the installed project.');
  }
  const workflow = selection(request.workflow, WORKFLOWS, 'workflow');
  const mode = selection(
    request.mode ?? config.mode,
    ['manual', 'host_policy', 'orchestrated'],
    'mode'
  );
  if (config.config_path && request.mode && mode !== config.mode) {
    throw new Error('Requested mode differs from configured project policy.');
  }
  if (mode === 'orchestrated' && workflow !== 'agent-output-review') {
    throw new Error(
      'The orchestrated backend supports agent-output-review on a materialized draft.'
    );
  }
  const selected = projectArtifact(root, request.input);
  if (!selected.content.trim()) throw new Error('Selected draft is empty.');
  if (
    applies(selected.path, config.scope.exclude_paths) ||
    (config.scope.include_paths.length && !applies(selected.path, config.scope.include_paths))
  ) {
    throw new Error('The selected draft is outside the configured editorial scope.');
  }
  const format = FORMATS[path.extname(selected.path).toLowerCase()];
  if (!format) throw new Error('Unsupported prose format: ' + selected.path);
  const fields = strings(request.fields ?? [], 'fields');
  if (fields.some((f) => config.editable_fields.length && !config.editable_fields.includes(f))) {
    throw new Error('Selected fields exceed project policy.');
  }
  const editable = fields.length ? fields : config.editable_fields;
  if (['json', 'yaml'].includes(format) && !editable.length)
    throw new Error('Select editable RFC 6901 string fields for structured prose.');
  if (editable.some((f) => !f.startsWith('/') || /~(?![01])/.test(f)))
    throw new Error('Invalid RFC 6901 field.');
  const contentType = identifier(request.content_type ?? 'documentation');
  if (config.content_types.length && !config.content_types.includes(contentType))
    throw new Error('Content type excluded by policy.');
  const targetLocale = locale(request.locale ?? config.default_locale);
  const sourceLocale = locale(request.source_locale ?? targetLocale);
  const selectedVoice = voice(root, request.profile ?? config.voice_profile);
  const protectedTerms = [...new Set([...config.protected_terms, ...selectedVoice.terms])];
  const policy = {
    config_path: config.config_path,
    config_sha256: config.config_sha256,
    facts: config.facts,
    editable_fields: editable,
    protected_spans: config.protected_spans,
    protected_terms: protectedTerms,
    scope: config.scope,
    default_locale: config.default_locale,
    source_locale: sourceLocale,
    fidelity: 'required',
    semantic_review: 'required',
    reviewer_context: 'separate',
  };
  const artifacts = strings(request.sources ?? [], 'sources').map((file) =>
    projectArtifact(root, file)
  );
  if (artifacts.length > 32) throw new Error('Select at most 32 additional sources.');
  const brief = request.brief ? projectArtifact(root, request.brief) : null;
  const catalogPath = PACK + '/shared/catalog.json';
  const catalog = JSON.parse(textFile(root, catalogPath).content);
  const route = catalog.workflows?.find((r) => r.id === workflow);
  if (
    catalog.schemaVersion !== 1 ||
    !route ||
    route.path !== 'workflows/' + workflow + '.md' ||
    !/^ghostwriter-(voice|write|edit|humanize|localize|verify)$/.test(route.skill)
  ) {
    throw new Error('Invalid installed Ghostwriter route: ' + workflow);
  }
  const locales = { en: 'en', fr: 'fr-FR', 'pt-BR': 'pt-BR' };
  const layer = locales[targetLocale] ?? locales[targetLocale.split('-')[0]];
  if (!layer && mode === 'orchestrated')
    throw new Error('No shipped editorial layer for ' + targetLocale);
  const instructionPaths = [
    'SKILL.md',
    'ghostwriter.md',
    'shared/editorial-contract.md',
    'shared/execution.md',
    'languages/glossary.md',
    ...(layer ? ['languages/' + layer + '.md'] : []),
    route.path,
  ].map((p) => PACK + '/' + p);
  instructionPaths.push(catalogPath);
  const skills = new Set([route.skill, 'ghostwriter-verify']);
  if (workflow === 'agent-output-review') skills.add('ghostwriter-edit');
  for (const skill of skills) instructionPaths.push('.agents/skills/' + skill + '/SKILL.md');
  const resources = [...instructionPaths, ...selectedVoice.samples.map((s) => s.path)].map((p) =>
    textFile(root, p)
  );
  if (
    [selected, ...artifacts, ...resources, brief].reduce((n, a) => n + (a?.bytes ?? 0), 0) >
    MAX_CONTEXT
  ) {
    throw new Error(
      'Selected context exceeds the supported size. Split the draft into separate runs.'
    );
  }
  const reference = ({ path: file, sha256 }) => ({ path: file, sha256 });
  const sources = artifacts.map(reference);
  const unitCount = selected.content
    .split(/(?:\r?\n)[\t ]*(?:\r?\n)+/)
    .filter((p) => p.trim()).length;
  const units = Array.from({ length: unitCount }, (_, i) => 'p' + (i + 1));
  const outputBase = '_bmad-output/ghostwriter/' + id;
  return {
    schema_version: 1,
    run_id: id,
    workflow,
    content_type: contentType,
    locale: targetLocale,
    input_artifacts: [{ ...reference(selected), format, units }],
    source_artifacts: sources,
    source_set_sha256: digest(sources),
    resource_artifacts: resources.map(reference),
    brief: brief ? reference(brief) : null,
    voice_profile: {
      id: selectedVoice.id,
      version: selectedVoice.version,
      path: selectedVoice.path,
      sha256: selectedVoice.sha256,
    },
    policy: { ...policy, sha256: digest(policy) },
    limits: config.limits,
    execution_requirements: {
      mode,
      backend: mode === 'orchestrated' ? 'codex-exec' : null,
      reviewer_context: 'separate',
    },
    editable_scope: { input: selected.path, fields: editable, output_directory: outputBase },
    expected_outputs: { directory: outputBase, format },
    request,
  };
}

function prepare(root, options) {
  const id = 'gw-' + crypto.randomUUID();
  // Persist the request independently of CLI parsing defaults. Re-resolve it on each check.
  const request = JSON.parse(
    JSON.stringify({
      workflow: options.workflow,
      input: options.input,
      brief: options.brief,
      sources: options.source,
      profile: options.profile,
      locale: options.locale,
      source_locale: options.sourceLocale,
      mode: options.mode,
      content_type: options.contentType,
      fields: options.field,
    })
  );
  const manifest = build(root, id, request);
  if (Buffer.byteLength(JSON.stringify(manifest, null, 2) + '\n') > MAX_FILE) {
    throw new Error(
      'Manifest exceeds the supported size. Split the selected draft into smaller units.'
    );
  }
  writeOnce(root, manifestPath(id), manifest);
  return {
    status: 'prepared',
    executed: false,
    run_id: id,
    manifest_path: manifestPath(id),
    manifest,
  };
}

function load(root, id) {
  const file = textFile(root, manifestPath(id));
  const stored = JSON.parse(file.content);
  if (stored.schema_version !== 1 || stored.run_id !== id)
    throw new Error('Ghostwriter manifest mismatch.');
  const current = build(root, id, stored.request);
  if (digest(stored) !== digest(current))
    throw new Error(
      'Prepared inputs, profile, resources or policy have changed. Prepare a new run.'
    );
  return current;
}

module.exports = { WORKFLOWS, manifestPath, prepare, load };
