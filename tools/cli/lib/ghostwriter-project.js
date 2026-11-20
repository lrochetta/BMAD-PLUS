'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { safeTarget } = require('../../build/generate-adapters');

const BASE = '.bmad-plus/ghostwriter';
const PACK = '.agents/skills/pack-ghostwriter';
const CONFIG = BASE + '/config.yaml';
const MAX_FILE = 512 * 1024;
const MAX_CONTEXT = 2 * 1024 * 1024;
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = (value) => hash(JSON.stringify(value));

function identifier(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(value)) {
    throw new Error('Expected a lowercase identifier of at most 63 characters.');
  }
  return value;
}

function textFile(root, file, limit = MAX_FILE) {
  const target = safeTarget(root, file);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.size > limit)
    throw new Error('File exceeds the allowed scope or size: ' + file);
  const bytes = fs.readFileSync(target);
  const content = bytes.toString('utf8');
  if (bytes.length > limit || bytes.includes(0) || !Buffer.from(content).equals(bytes)) {
    throw new Error('Expected bounded UTF-8 text: ' + file);
  }
  return { path: file, sha256: hash(bytes), content, bytes: bytes.length };
}

function projectArtifact(root, file) {
  if (
    typeof file !== 'string' ||
    file
      .split('/')
      .some((segment) =>
        /^(?:\.git|\.ssh|node_modules|\.bmad-plus|\.env(?:\..*)?|\.credentials|credentials)$/i.test(
          segment
        )
      )
  ) {
    throw new Error('Select a project content file outside private and control directories.');
  }
  return textFile(root, file);
}

function present(root, file) {
  return fs.existsSync(safeTarget(root, file));
}

function writeOnce(root, file, value) {
  const target = safeTarget(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temp = target + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    // Publish a complete immutable record only when the destination does not exist.
    fs.linkSync(temp, target);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function selection(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error('Unsupported ' + label + ': ' + value);
  return value;
}

function strings(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((v) => typeof v !== 'string' || !v.trim()) ||
    new Set(value).size !== value.length ||
    value.length > 128
  ) {
    throw new Error('Expected a bounded list of distinct strings for ' + label);
  }
  return value;
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object for ' + name);
  return value;
}

function keys(value, names, name) {
  object(value, name);
  const unknown = Object.keys(value).filter((key) => !names.includes(key));
  if (unknown.length) throw new Error('Unknown ' + name + ' field: ' + unknown.join(', '));
}

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error('Invalid ' + label);
  return value;
}

function locale(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected a locale.');
  return Intl.getCanonicalLocales(value)[0];
}

function loadConfig(root) {
  const resource = present(root, CONFIG) ? textFile(root, CONFIG) : null;
  const config = resource ? yaml.load(resource.content) : { schema_version: 1 };
  keys(
    config,
    [
      'schema_version',
      'enabled',
      'mode',
      'default_locale',
      'voice_profile',
      'content_types',
      'review_policy',
      'scope',
      'verification',
      'limits',
      'output',
    ],
    'configuration'
  );
  if (config.schema_version !== 1)
    throw new Error('Unsupported Ghostwriter configuration version.');
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean')
    throw new Error('enabled must be boolean.');
  if (config.enabled === false) throw new Error('Ghostwriter has been disabled for this project.');
  const verification = config.verification ?? {};
  keys(verification, ['facts', 'reviewer_context', 'semantic_review', 'fidelity'], 'verification');
  selection(verification.fidelity ?? 'required', ['required'], 'fidelity policy');
  selection(verification.semantic_review ?? 'required', ['required'], 'semantic review policy');
  selection(verification.reviewer_context ?? 'separate', ['separate'], 'reviewer policy');
  selection(
    config.review_policy ?? 'required_for_selected_deliverables',
    ['required_for_selected_deliverables'],
    'review policy'
  );
  const output = config.output ?? {};
  keys(output, ['text', 'report'], 'output');
  selection(output.text ?? 'final-only', ['final-only'], 'text output');
  selection(output.report ?? 'separate', ['separate'], 'report output');
  const limits = config.limits ?? {};
  keys(limits, ['max_revision_attempts', 'timeout_ms', 'max_output_bytes'], 'limits');
  const scope = config.scope ?? {};
  keys(
    scope,
    ['include_paths', 'exclude_paths', 'editable_fields', 'protected_spans', 'protected_terms'],
    'scope'
  );
  const include = strings(scope.include_paths ?? [], 'include_paths');
  const exclude = strings(scope.exclude_paths ?? [], 'exclude_paths');
  for (const entry of [...include, ...exclude]) {
    if (/[?*]/.test(entry))
      throw new Error('Select paths or directory prefixes, without wildcards.');
    const relative = entry.replace(/\/$/, '');
    if (
      /[\\:\0]/.test(relative) ||
      relative.split('/').some((part) => !part || part === '.' || part === '..')
    ) {
      throw new Error('Scope paths must be project relative.');
    }
  }
  return {
    config_path: resource?.path ?? null,
    config_sha256: resource?.sha256 ?? null,
    mode: selection(config.mode ?? 'manual', ['manual', 'host_policy', 'orchestrated'], 'mode'),
    default_locale: locale(config.default_locale ?? 'fr-FR'),
    voice_profile: config.voice_profile === undefined ? null : profileId(config.voice_profile),
    content_types: strings(config.content_types ?? [], 'content_types'),
    scope: { include_paths: include, exclude_paths: exclude },
    editable_fields: strings(scope.editable_fields ?? [], 'editable_fields'),
    protected_terms: strings(scope.protected_terms ?? [], 'protected_terms'),
    protected_spans: strings(scope.protected_spans ?? [], 'protected_spans'),
    facts: selection(
      verification.facts ?? 'not_run',
      ['not_run', 'provided-sources'],
      'fact policy'
    ),
    limits: {
      max_revision_attempts: integer(
        limits.max_revision_attempts ?? 2,
        1,
        5,
        'revision attempt limit'
      ),
      timeout_ms: integer(limits.timeout_ms ?? 300000, 1000, 600000, 'timeout'),
      max_output_bytes: integer(limits.max_output_bytes ?? 131072, 1024, MAX_FILE, 'output limit'),
    },
  };
}

function profileId(value) {
  if (typeof value !== 'string') throw new Error('Expected a voice profile id.');
  const relative = /^profiles\/([a-z][a-z0-9-]{0,62})\.yaml$/.exec(value);
  return identifier(relative ? relative[1] : value);
}

function voice(root, name) {
  if (name === null || name === undefined || name === 'preserve-existing') {
    const builtin = {
      id: 'preserve-existing',
      version: 1,
      kind: 'policy',
      policy: 'Preserve the voice of the input.',
    };
    return {
      id: builtin.id,
      version: 1,
      path: null,
      sha256: digest(builtin),
      samples: [],
      terms: [],
    };
  }
  identifier(name);
  const userPath = BASE + '/profiles/' + name + '.yaml';
  const file = textFile(
    root,
    present(root, userPath) ? userPath : PACK + '/profiles/' + name + '.yaml'
  );
  const profile = object(yaml.load(file.content), 'voice profile');
  if (profile.schema_version !== 1 || profile.id !== name)
    throw new Error('Voice profile identity or schema mismatch.');
  integer(profile.version, 1, Number.MAX_SAFE_INTEGER, 'voice profile version');
  selection(profile.kind, ['author', 'brand'], 'voice kind');
  selection(profile.status, ['draft', 'approved'], 'voice status');
  locale(profile.locale);
  if (profile.channels !== undefined) strings(profile.channels, 'profile channels');
  if (profile.unresolved_questions !== undefined)
    strings(profile.unresolved_questions, 'unresolved questions');
  if (profile.explicit_preferences !== undefined)
    object(profile.explicit_preferences, 'explicit preferences');
  for (const field of ['glossary', 'exceptions']) {
    if (profile[field] !== undefined && !Array.isArray(profile[field]))
      throw new Error('Invalid profile ' + field);
  }
  const samples = profile.approved_samples ?? [];
  if (!Array.isArray(samples) || samples.length > 32) throw new Error('Invalid voice samples.');
  const records = samples.map((sample) => {
    identifier(sample.id);
    const current = projectArtifact(root, sample.path);
    if (current.sha256 !== sample.sha256)
      throw new Error('Voice sample hash mismatch: ' + sample.id);
    return { id: sample.id, path: current.path, sha256: current.sha256 };
  });
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error('Duplicate voice sample id.');
  if (!Array.isArray(profile.observations ?? [])) throw new Error('Invalid voice observations.');
  for (const observation of profile.observations ?? []) {
    if (
      !observation ||
      typeof observation !== 'object' ||
      (observation.confidence !== undefined &&
        !['string', 'number'].includes(typeof observation.confidence))
    ) {
      throw new Error('Invalid voice observation metadata.');
    }
    const sample = records.find((r) => r.id === observation.sample_id);
    if (
      !sample ||
      typeof observation.passage !== 'string' ||
      !observation.passage.trim() ||
      typeof observation.observation !== 'string' ||
      !observation.observation.trim() ||
      !textFile(root, sample.path).content.includes(observation.passage)
    )
      throw new Error('Unanchored voice observation.');
  }
  return {
    id: name,
    version: profile.version,
    path: file.path,
    sha256: file.sha256,
    samples: records,
    terms: strings(profile.protected_names ?? [], 'protected_names'),
  };
}

module.exports = {
  BASE,
  PACK,
  projectArtifact,
  MAX_FILE,
  MAX_CONTEXT,
  hash,
  digest,
  identifier,
  textFile,
  present,
  writeOnce,
  selection,
  strings,
  object,
  locale,
  loadConfig,
  voice,
};
