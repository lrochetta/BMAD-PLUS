/** Human acceptance recipes (recette): spec validation, page build, run reading and gate. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SPEC_SCHEMA = 'bmad-plus/uat-spec/2';
const RESULTS_SCHEMA = 'bmad-plus/uat-results/2';
const TRIAGE_SCHEMA = 'bmad-plus/uat-triage/1';
const LEGACY_SPEC_SCHEMA = 'recette-interactive/1';
const LEGACY_RESULTS_SCHEMA = 'recette-interactive/resultats/1';

const DEFAULT_DIR = '_bmad-output/uat';
const MAX_FILE = 4 * 1024 * 1024;
const MAX_SOURCE_FILE = 512 * 1024;
const MAX_SOURCE_FILES = 20000;
const DEFAULT_BUDGET = { maxSteps: 15, maxMinutes: 30 };
const STATES = ['passed', 'failed', 'blocked', 'skipped'];
const TRIAGE_CLASSES = ['product', 'recipe', 'data', 'undecided'];
const TRIAGE_DECISIONS = ['fix', 'amend-spec', 'remeasure', 'accept-risk', 'ask-tester'];
const VERIFY_KINDS = ['sql', 'http', 'command', 'manual'];

const SPEC_KEYS = [
  '$schema',
  'schema',
  'id',
  'product',
  'versions',
  'date',
  'language',
  'title',
  'subtitle',
  'environment',
  'estimate',
  'intro',
  'warnings',
  'notes',
  'witnesses',
  'after',
  'steps',
  'closing',
  'authorNotes',
];
const STEP_KEYS = [
  'id',
  'title',
  'duration',
  'writes',
  'warning',
  'optional',
  'stories',
  'verify',
  'where',
  'do',
  'expect',
];
const EXPECT_KEYS = ['id', 'text'];
const WITNESS_KEYS = ['id', 'proof', 'reads', 'writes'];

/** Inline markup a tester's page may contain. Anything else is refused, never stripped. */
const ALLOWED_TAGS = {
  b: [],
  i: [],
  em: [],
  strong: [],
  code: [],
  br: [],
  span: ['class'],
  a: ['href', 'target', 'rel'],
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (spec) => JSON.stringify(spec);
const specHash = (spec) => sha256(canonical(spec));

function layout(projectDir, dir = DEFAULT_DIR) {
  const root = path.resolve(projectDir, dir);
  return {
    root,
    specs: path.join(root, 'specs'),
    pages: path.join(root, 'pages'),
    results: path.join(root, 'results'),
    triage: path.join(root, 'triage'),
    checks: path.join(root, 'checks'),
  };
}

function readJson(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`${file} is a symbolic link; refused.`);
  if (stat.size > MAX_FILE) throw new Error(`${file} exceeds ${MAX_FILE} bytes.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── Spec: legacy adapter, validation, lint ────────────────────────────────────

/** FormaPro's `recette-interactive/1` files stay readable: keys are mapped, nothing is guessed. */
function fromLegacySpec(doc) {
  const step = (e) => ({
    id: e.id,
    title: e.titre,
    ...(e.duree ? { duration: e.duree } : {}),
    ...(e.ecrit === undefined ? {} : { writes: e.ecrit }),
    ...(e.avertissement ? { warning: e.avertissement } : {}),
    where: e.ou || [],
    do: e.faire || [],
    expect: (e.attendus || []).map((a) => ({ id: a.id, text: a.texte })),
  });
  return {
    schema: SPEC_SCHEMA,
    id: doc.id,
    product: doc.produit,
    versions: doc.versions || [],
    ...(doc.date ? { date: doc.date } : {}),
    language: 'fr',
    title: doc.titre,
    ...(doc.sousTitre ? { subtitle: doc.sousTitre } : {}),
    environment: { name: doc.environnement?.nom, url: doc.environnement?.url },
    ...(doc.dureeEstimee ? { estimate: doc.dureeEstimee } : {}),
    ...(doc.intro ? { intro: doc.intro } : {}),
    ...(doc.avertissements ? { warnings: doc.avertissements } : {}),
    ...(doc.infos ? { notes: doc.infos } : {}),
    steps: (doc.etapes || []).map(step),
    ...(doc.cloture?.texte ? { closing: { text: doc.cloture.texte } } : {}),
    ...(doc.notesAgent ? { authorNotes: doc.notesAgent } : {}),
  };
}

function loadSpec(file) {
  const doc = readJson(file);
  const legacy = doc && doc.schema === LEGACY_SPEC_SCHEMA;
  const spec = legacy ? fromLegacySpec(doc) : doc;
  return { spec, legacy, sha256: specHash(spec), file };
}

function unknownKeys(object, allowed) {
  return Object.keys(object || {}).filter((key) => !allowed.includes(key));
}

function checkMarkup(value, where, errors) {
  if (typeof value !== 'string') {
    errors.push(`${where}: expected text`);
    return;
  }
  let rest = value;
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*)?)\/?>/g;
  let match;
  while ((match = tag.exec(value))) {
    const [, closing, rawName, rawAttrs] = match;
    const name = rawName.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_TAGS, name)) {
      errors.push(`${where}: <${name}> is not allowed in a tester page`);
      continue;
    }
    if (!closing) {
      const attrs = [...(rawAttrs || '').matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)];
      const named = attrs.map(([, key]) => key.toLowerCase());
      for (const key of named) {
        if (!ALLOWED_TAGS[name].includes(key))
          errors.push(`${where}: <${name} ${key}> is not allowed`);
      }
      if ((rawAttrs || '').replace(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g, '').trim()) {
        errors.push(`${where}: <${name}> has an attribute that is not a quoted name="value" pair`);
      }
      for (const [, key, val] of attrs) {
        if (name === 'span' && key.toLowerCase() === 'class' && val !== 'ecran') {
          errors.push(`${where}: <span class="${val}"> — only class="ecran" is allowed`);
        }
        if (name === 'a' && key.toLowerCase() === 'href' && !/^https:\/\//.test(val)) {
          errors.push(`${where}: link "${val}" must be https`);
        }
      }
    }
    rest = rest.replace(match[0], '');
  }
  if (rest.includes('<')) errors.push(`${where}: a "<" is left outside any allowed tag`);
}

function eachMarkup(spec, visit) {
  const list = (values, where) => (values || []).forEach((v, i) => visit(v, `${where}[${i}]`));
  list(spec.intro, 'intro');
  list(spec.warnings, 'warnings');
  list(spec.notes, 'notes');
  list(spec.closing?.text, 'closing.text');
  for (const step of spec.steps || []) {
    if (step.warning) visit(step.warning, `step ${step.id}: warning`);
    list(step.where, `step ${step.id}: where`);
    list(step.do, `step ${step.id}: do`);
    for (const expect of step.expect || []) visit(expect.text, `step ${step.id}/${expect.id}`);
  }
}

function validateSpec(spec, options = {}) {
  const errors = [];
  const warnings = [];
  const budget = { ...DEFAULT_BUDGET, ...(options.budget || {}) };
  const need = (condition, message) => {
    if (!condition) errors.push(message);
  };

  need(spec && spec.schema === SPEC_SCHEMA, `schema must be "${SPEC_SCHEMA}"`);
  need(
    typeof spec.id === 'string' && /^[a-z0-9][a-z0-9.-]{2,80}$/.test(spec.id),
    'id: lowercase letters, digits, dots and dashes (e.g. formapro-1.203.0)'
  );
  need(typeof spec.product === 'string' && spec.product, 'product is missing');
  need(Array.isArray(spec.versions) && spec.versions.length, 'versions: at least one');
  need(typeof spec.title === 'string' && spec.title, 'title is missing');
  need(spec.environment && spec.environment.name, 'environment.name is required');
  if (spec.environment?.url) {
    need(/^https?:\/\//.test(spec.environment.url), 'environment.url must be http(s)');
  }
  need(Array.isArray(spec.steps) && spec.steps.length, 'steps: at least one');
  for (const key of unknownKeys(spec, SPEC_KEYS)) {
    errors.push(`unknown key at spec level: "${key}" (a typo would be ignored in silence)`);
  }

  const stepIds = new Set();
  for (const [index, step] of (spec.steps || []).entries()) {
    const at = `step ${step?.id ?? index}`;
    for (const key of unknownKeys(step, STEP_KEYS)) errors.push(`${at}: unknown key "${key}"`);
    need(
      typeof step.id === 'string' && /^[a-z0-9][a-z0-9-]{0,60}$/.test(step.id),
      `${at}: invalid id`
    );
    need(!stepIds.has(step.id), `${at}: duplicate id`);
    stepIds.add(step.id);
    need(step.title, `${at}: title is missing`);
    need(Array.isArray(step.where) && step.where.length, `${at}: "where" is empty`);
    need(Array.isArray(step.do) && step.do.length, `${at}: "do" is empty`);
    need(Array.isArray(step.expect) && step.expect.length, `${at}: no expectation`);
    need(
      step.writes === undefined || typeof step.writes === 'boolean',
      `${at}: writes must be true or false`
    );
    need(
      step.optional === undefined || typeof step.optional === 'boolean',
      `${at}: optional must be true or false`
    );
    if (step.writes) {
      // A tick on a step that writes is an observation; the read-only proof is what settles it.
      need(
        step.verify &&
          VERIFY_KINDS.includes(step.verify.kind) &&
          String(step.verify.text || '').trim(),
        `${at}: writes: true requires verify {kind: ${VERIFY_KINDS.join('|')}, text} — the read-only check run after the tester`
      );
    }
    for (const [line, text] of (step.do || []).entries()) {
      // A tester copies "doctor." from "Run <code>…doctor</code>." into the terminal —
      // it happened on the first human run of BMAD+'s own recipe.
      if (/<\/code>\s*[.,;:!?](?:\s|$)/.test(String(text))) {
        warnings.push(
          `${at}: "do" line ${line + 1} puts punctuation right after a command — testers copy it into the terminal`
        );
      }
    }
    const letters = new Set();
    for (const expect of step.expect || []) {
      for (const key of unknownKeys(expect, EXPECT_KEYS))
        errors.push(`${at}: expectation ${expect.id}: unknown key "${key}"`);
      need(
        typeof expect.id === 'string' && /^[a-z]$/.test(expect.id),
        `${at}: expectation id must be one letter (${expect.id})`
      );
      need(!letters.has(expect.id), `${at}: duplicate expectation ${expect.id}`);
      letters.add(expect.id);
      need(expect.text, `${at}: expectation ${expect.id} has no text`);
      const screens = String(expect.text || '').match(/<span class="ecran">/g) || [];
      if (screens.length > 1 && /\b(et|and)\b/i.test(String(expect.text))) {
        warnings.push(
          `${at}/${expect.id}: two on-screen labels joined by "and" — one fact per expectation, or the tester cannot answer`
        );
      }
    }
  }

  for (const witness of spec.witnesses || []) {
    for (const key of unknownKeys(witness, WITNESS_KEYS))
      errors.push(`witness ${witness.id}: unknown key "${key}"`);
    need(witness.id, 'a witness has no id');
    need(
      String(witness.proof || '').trim(),
      `witness ${witness.id}: proof is required (the read-only query that establishes its state)`
    );
    for (const ref of [...(witness.reads || []), ...(witness.writes || [])]) {
      need(stepIds.has(ref), `witness ${witness.id}: unknown step "${ref}"`);
    }
  }

  eachMarkup(spec, (value, where) => checkMarkup(value, where, errors));

  const steps = (spec.steps || []).length;
  if (steps > budget.maxSteps) {
    warnings.push(
      `${steps} steps: over the ${budget.maxSteps}-step budget — split into ordered pages, a step meant "for later" gets played at once`
    );
  }
  const minutes = Number.parseInt(String(spec.estimate || '').replace(/[^0-9]/g, ''), 10);
  if (Number.isFinite(minutes) && minutes > budget.maxMinutes) {
    warnings.push(
      `estimated ${minutes} min: over the ${budget.maxMinutes}-minute budget — split into ordered pages`
    );
  }
  return { errors, warnings };
}

const decodeEntities = (value) =>
  String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const flatten = (value) =>
  decodeEntities(String(value).replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** Every quoted on-screen label, with the expectation it belongs to. */
function screenLabels(spec) {
  const labels = [];
  for (const step of spec.steps || []) {
    const visit = (value, at) => {
      for (const [, inner] of String(value).matchAll(/<span class="ecran">([\s\S]*?)<\/span>/g)) {
        const label = flatten(inner);
        if (label) labels.push({ label, at });
      }
    };
    (step.where || []).forEach((v) => visit(v, `step ${step.id}: where`));
    (step.do || []).forEach((v) => visit(v, `step ${step.id}: do`));
    (step.expect || []).forEach((e) => visit(e.text, `step ${step.id}/${e.id}`));
  }
  return labels;
}

const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.html',
  '.htm',
  '.php',
  '.py',
  '.rb',
  '.java',
  '.kt',
  '.cs',
  '.go',
  '.json',
  '.yaml',
  '.yml',
  '.md',
];
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  'out',
]);

function sourceHaystack(roots) {
  let files = 0;
  const chunks = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) continue;
      if (files >= MAX_SOURCE_FILES) return;
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.size > MAX_SOURCE_FILE) continue;
      files += 1;
      try {
        chunks.push(fs.readFileSync(full, 'utf8').replace(/\s+/g, ' '));
      } catch {
        /* unreadable file: it simply proves nothing */
      }
    }
  };
  for (const root of roots) walk(path.resolve(root));
  return { text: chunks.join('\n'), files };
}

/**
 * Lint: schema, markup, budget, and the check that pays most — every quoted label
 * must exist verbatim in the source. Wording and accent drift produced most of the
 * false "not seen" measured on FormaPro.
 */
function lintSpec(spec, options = {}) {
  const { errors, warnings } = validateSpec(spec, options);
  const labels = screenLabels(spec);
  const missing = [];
  let scannedFiles = 0;
  if ((options.sources || []).length) {
    const { text, files } = sourceHaystack(options.sources);
    scannedFiles = files;
    const seen = new Set();
    for (const { label, at } of labels) {
      if (seen.has(label)) continue;
      seen.add(label);
      if (!text.includes(label)) missing.push({ label, at });
    }
    for (const { label, at } of missing) {
      errors.push(
        `${at}: the label "${label}" is in no source file — copy it from the component, accents included or not`
      );
    }
  }
  return { errors, warnings, labels: labels.length, scannedFiles, missing };
}

// ── Page build ────────────────────────────────────────────────────────────────

const TEMPLATE_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'bmad-plus',
  'skills',
  'bmad-plus-uat',
  'template'
);
const TEMPLATE = path.join(TEMPLATE_DIR, 'page.html');

const STRINGS = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'strings.json'), 'utf8'));

/** A page language: a code ('fr'), a framework language name ('Français'), or a locale tag. */
function languageCode(value, strings = STRINGS) {
  const wanted = String(value || '').trim();
  if (!wanted) return null;
  if (strings[wanted]) return wanted;
  const lower = wanted.toLowerCase();
  const byCode = Object.keys(strings).find((code) => code.toLowerCase() === lower);
  if (byCode) return byCode;
  const byName = Object.keys(strings).find((code) => strings[code].name.toLowerCase() === lower);
  if (byName) return byName;
  const base = lower.split(/[-_]/)[0];
  return Object.keys(strings).find((code) => code.toLowerCase().split('-')[0] === base) || null;
}

/**
 * What every built page guarantees a tester, by construction. Each entry names a
 * behaviour the DOM suite exercises (tests/unit/uat-page.test.js) and the literal
 * the template must carry for it. A template that lost one does not build: the
 * FormaPro incident of 2026-09-25 (answers typed before any run existed, then lost
 * on reload, with a "saved" status nobody had verified) came from exactly such a loss.
 */
const PAGE_GUARANTEES = [
  {
    id: 'hidden-before-start',
    what: 'no answer field is shown before a run exists, whatever a class says about display',
    // The rule must also be the LAST rule of the sheet: a later !important display rule would beat it.
    markers: [
      '[hidden] { display: none !important; }\n</style>',
      '<main class="steps" id="steps" hidden>',
    ],
  },
  {
    id: 'no-answer-before-run',
    what: 'a tick or a note before the run starts is refused and explained, never discarded in silence',
    markers: [
      'function requireRun(',
      'T.startFirst',
      '!requireRun(event)',
      'if (!requireRun()) return;',
    ],
  },
  {
    id: 'verified-local-write',
    what: 'a write to this browser counts only once it reads back; a refused write returns false',
    markers: ['return localStorage.getItem(k) === v;', 'function saveLocal()'],
  },
  {
    id: 'honest-save-status',
    what: 'the status line reports the verified outcome, and names a failed save',
    markers: ['function showSaveState(', 'T.saveFailed', 'T.remoteFailed', 'T.saving'],
  },
  {
    id: 'save-on-every-change',
    what: 'every tick and every keystroke in a note is saved at once, without waiting for blur, and a save never moves the cursor',
    markers: [
      'addEventListener("change"',
      'addEventListener("input"',
      'document.activeElement !== field',
    ],
  },
  {
    id: 'restore-before-capabilities',
    what: 'the browser copy is restored synchronously, before any optional capability answers',
    markers: ['function restoreLocal()'],
    order: ['restoreLocal();', 'probe()'],
  },
  {
    id: 'newer-copy-wins',
    what: 'an older remote copy never overwrites a newer local one; a copy without a date is the oldest of all',
    markers: ['function connectDb()', 'remoteNewer', 'function at(', 'function adopt('],
  },
  {
    id: 'revision-guard',
    what: 'a run that answered another revision is offered, explained and carried by an explicit rule, never poured in blindly',
    markers: ['function sameRevision(', 'function carry(', 'T.otherRevision', 'T.continueHere'],
  },
  {
    id: 'other-tab-notice',
    what: 'two tabs on one run converge on the latest change, and the page says so',
    markers: ['addEventListener("storage"', 'T.otherTab'],
  },
  {
    id: 'unreadable-draft-kept',
    what: 'a saved run that cannot be read is reported and exportable, never deleted',
    markers: ['id="draft-problem"', 'T.draftUnreadable', 'id="btn-save-raw"'],
  },
  {
    id: 'progress-accessible',
    what: 'the share of lines answered is exposed with a progressbar role and value; answered is not passed',
    markers: ['role="progressbar"', 'aria-valuenow', 'T.percentAnswered'],
  },
  {
    id: 'storage-explained',
    what: 'the page says where answers live and what can make them disappear',
    markers: ['id="storage-note"', 'id="mode-note"'],
  },
  {
    id: 'finished-is-not-accepted',
    what: 'finishing keeps the date and says it is not an acceptance',
    markers: ['T.finishedNote', 'run.finishedAt = new Date().toISOString();'],
  },
  {
    id: 'unload-guard',
    what: 'leaving with an unsaved run is questioned; pending remote writes are flushed',
    markers: ['addEventListener("beforeunload"', 'addEventListener("pagehide"'],
  },
  {
    id: 'utf8-and-escaped-diacritics',
    what: 'the page declares UTF-8 and writes the combining-mark range as escapes',
    markers: ['<meta charset="utf-8">', '\\u0300-\\u036f'],
  },
  {
    id: 'export-is-the-run',
    what: 'the exported JSON is the run as answered, and nothing is exported before a run exists',
    markers: ['download(runId + ".json", JSON.stringify(run, null, 2))'],
  },
];

/**
 * Which guarantees a template carries: every marker present, in the required order where one
 * is set. Checked on the TEMPLATE, never on the built page: a recipe's own text must not be
 * able to satisfy or defeat a marker.
 */
function pageGuarantees(template) {
  const missing = [];
  for (const guarantee of PAGE_GUARANTEES) {
    const lost = guarantee.markers.filter((marker) => !template.includes(marker));
    if (!lost.length && guarantee.order) {
      const positions = guarantee.order.map((marker) => template.indexOf(marker));
      if (positions.some((at) => at < 0) || positions.some((at, i) => i && at < positions[i - 1]))
        lost.push(`order ${guarantee.order.join(' → ')}`);
    }
    if (lost.length) missing.push({ id: guarantee.id, what: guarantee.what, lost });
  }
  const carried = PAGE_GUARANTEES.map((g) => g.id).filter(
    (id) => !missing.some((entry) => entry.id === id)
  );
  return { ok: missing.length === 0, carried, missing };
}

function buildPage(spec, options = {}) {
  const template = options.template || fs.readFileSync(TEMPLATE, 'utf8');
  // A page missing one guarantee is not a page: refusing here is what keeps a tester's
  // answers safe in an installation that has no test suite of its own.
  const guarantees = pageGuarantees(template);
  if (!guarantees.ok) {
    throw new Error(
      `the page template (${options.template ? 'the template given' : TEMPLATE}) lost a guarantee — not built: ${guarantees.missing
        .map((entry) => `${entry.id}: ${entry.what} — missing ${entry.lost.join(', ')}`)
        .join('; ')}`
    );
  }
  const hash = specHash(spec);
  const json = canonical(spec).replace(/<\//g, '<\\/');
  const strings = options.strings || STRINGS;
  // The recipe states its language; otherwise the project's, otherwise English. Every
  // language ships in the page: a tester who does not read the author’s can switch.
  const language =
    languageCode(spec.language, strings) || languageCode(options.language, strings) || 'en';
  const allStrings = JSON.stringify(strings).replace(/<\//g, '<\\/');
  const title = `${spec.product} ${spec.versions.join(' · ')} — ${spec.title}`;
  const escape = (value) =>
    String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Replacement FUNCTIONS: in a replacement string $&, $', $` and $1 are expanded,
  // and a spec quoting a regular expression silently duplicated the template.
  const html = template
    .replace('__TITLE__', () => escape(title))
    .replace('__SPEC_JSON__', () => json)
    .replace('__SPEC_SHA__', () => hash)
    .replace('__STRINGS__', () => allStrings)
    .replace('__LANGUAGE__', () => language)
    .replace('__DIR__', () => strings[language].dir || 'ltr');
  const embedded = /<script id="uat-spec" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  try {
    JSON.parse(embedded[1]);
  } catch (error) {
    throw new Error(`the built page does not read its own spec back (${error.message})`, {
      cause: error,
    });
  }
  return { html, sha256: hash, language, guarantees: guarantees.carried };
}

// ── Runs: legacy adapter, normalisation, reading ──────────────────────────────

function fromLegacyResults(doc, spec) {
  const steps = {};
  const stateOf = (value) => (value === true ? 'passed' : value === false ? 'failed' : null);
  for (const [id, step] of Object.entries(doc.etapes || {})) {
    const expect = {};
    for (const [letter, value] of Object.entries(step.attendus || {})) {
      const text = spec?.steps
        ?.find((s) => s.id === id)
        ?.expect?.find((e) => e.id === letter)?.text;
      expect[letter] = { state: stateOf(value), ...(text ? { text } : {}) };
    }
    steps[id] = {
      title: step.titre,
      state: Object.values(expect).some((e) => e.state === 'failed')
        ? 'failed'
        : Object.values(expect).every((e) => e.state === 'passed')
          ? 'passed'
          : null,
      note: step.note || '',
      expect,
    };
  }
  return {
    schema: RESULTS_SCHEMA,
    specId: doc.specId || (spec ? spec.id : ''),
    ...(doc.specSha256 ? { specSha256: doc.specSha256 } : {}),
    runId: doc.runId || '',
    tester: doc.testeur || '',
    startedAt: doc.demarreLe,
    updatedAt: doc.misAJourLe,
    finishedAt: doc.termineLe || null,
    overallNote: doc.noteGlobale || '',
    steps,
    summary: summarise(steps),
  };
}

/** A step's state is recomputed from its expectations: a page-written verdict is not evidence. */
function stepState(step) {
  const states = Object.values(step.expect || {}).map((expect) => expect.state);
  if (!states.length) return null;
  if (states.includes('failed')) return 'failed';
  if (states.includes('blocked')) return 'blocked';
  if (states.every((state) => state === 'skipped')) return 'skipped';
  if (states.every((state) => state === 'passed' || state === 'skipped')) return 'passed';
  return null;
}

function summarise(steps) {
  const summary = { passed: 0, failed: 0, blocked: 0, skipped: 0, unanswered: 0 };
  for (const step of Object.values(steps || {})) {
    for (const expect of Object.values(step.expect || {})) {
      if (expect.state === null || expect.state === undefined) summary.unanswered += 1;
      else if (STATES.includes(expect.state)) summary[expect.state] += 1;
    }
  }
  return summary;
}

function normalizeRun(doc, spec) {
  const legacy = doc && (doc.schema === LEGACY_RESULTS_SCHEMA || doc.schema === 1);
  const run = legacy ? fromLegacyResults(doc, spec) : doc;
  if (!run || run.schema !== RESULTS_SCHEMA)
    throw new Error(`unsupported results schema: ${doc && doc.schema}`);
  if (!run.runId) throw new Error('results without runId');
  if (!run.specId) throw new Error('results without specId');
  for (const step of Object.values(run.steps || {})) step.state = stepState(step);
  run.summary = summarise(run.steps);
  return run;
}

function readRuns(dir, spec) {
  const runs = [];
  const seen = new Set();
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      let run;
      try {
        run = normalizeRun(readJson(full), spec);
      } catch {
        continue;
      }
      if (spec && run.specId !== spec.id) continue;
      // The same run exported twice (file plus artifact copy) is one run.
      if (seen.has(run.runId)) continue;
      seen.add(run.runId);
      run.file = full;
      run.stale = Boolean(spec && run.specSha256 && run.specSha256 !== specHash(spec));
      run.unsigned = !run.specSha256;
      runs.push(run);
    }
  };
  walk(path.resolve(dir));
  return runs.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

/** Failed and blocked expectations, with their text — the dev agent must not reopen the spec. */
function failures(run, spec) {
  const list = [];
  for (const [stepId, step] of Object.entries(run.steps || {})) {
    const specStep = spec?.steps?.find((s) => s.id === stepId) || null;
    for (const [letter, expect] of Object.entries(step.expect || {})) {
      if (expect.state !== 'failed' && expect.state !== 'blocked') continue;
      const specExpect = specStep?.expect?.find((e) => e.id === letter) || null;
      list.push({
        step: stepId,
        expect: letter,
        title: step.title || specStep?.title || '',
        state: expect.state,
        text: flatten(expect.text || specExpect?.text || ''),
        missingFromSpec: Boolean(spec && specStep && !specExpect),
        note: expect.note || step.note || '',
      });
    }
  }
  return list;
}

function unanswered(run, spec) {
  const list = [];
  for (const [stepId, step] of Object.entries(run.steps || {})) {
    const specStep = spec?.steps?.find((s) => s.id === stepId) || null;
    if (specStep?.optional) continue;
    for (const [letter, expect] of Object.entries(step.expect || {})) {
      if (expect.state === null || expect.state === undefined) list.push(`${stepId}/${letter}`);
    }
  }
  return list;
}

function loadTriage(file) {
  if (!fs.existsSync(file)) return null;
  const doc = readJson(file);
  if (!doc || doc.schema !== TRIAGE_SCHEMA)
    throw new Error(`triage must use schema "${TRIAGE_SCHEMA}"`);
  return doc;
}

function triageFor(triage, runId) {
  const entry = (triage?.runs || []).find((run) => run.runId === runId) || null;
  return {
    failures: entry?.failures || [],
    writeChecks: entry?.writeChecks || [],
  };
}

/**
 * The gate. It establishes integrity and completeness of a human run — never that
 * the tester looked at the right place. Evidence stays labelled human-observed.
 */
function gate({ spec, runs, triage }) {
  const finished = runs
    .filter((run) => run.finishedAt)
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
  const run = finished[0] || null;
  if (!run) {
    return {
      status: 'awaiting',
      reasons: [runs.length ? `${runs.length} run(s) started, none finished` : 'no run yet'],
      run: null,
    };
  }
  if (run.stale) {
    return {
      status: 'stale',
      reasons: [
        `the spec changed since this run (answered ${run.specSha256.slice(0, 12)}, now ${specHash(spec).slice(0, 12)}) — replay the affected steps`,
      ],
      run,
    };
  }
  const reasons = [];
  const open = unanswered(run, spec);
  if (open.length)
    reasons.push(
      `${open.length} expectation(s) never answered: ${open.slice(0, 5).join(', ')}${open.length > 5 ? '…' : ''}`
    );

  const decided = triageFor(triage, run.runId);
  for (const failure of failures(run, spec)) {
    const entry = decided.failures.find(
      (f) => f.step === failure.step && f.expect === failure.expect
    );
    if (!entry)
      reasons.push(`${failure.step}/${failure.expect} is ${failure.state} and not triaged`);
    else if (!TRIAGE_CLASSES.includes(entry.class) || entry.class === 'undecided') {
      reasons.push(
        `${failure.step}/${failure.expect}: class "${entry.class}" — ask the tester what they saw, never guess`
      );
    } else if (!TRIAGE_DECISIONS.includes(entry.decision)) {
      reasons.push(
        `${failure.step}/${failure.expect}: decision "${entry.decision}" is not one of ${TRIAGE_DECISIONS.join('|')}`
      );
    } else if (entry.decision === 'accept-risk' && !String(entry.decidedBy || '').trim()) {
      reasons.push(`${failure.step}/${failure.expect}: accept-risk requires decidedBy`);
    } else if (failure.state === 'blocked' && entry.decision !== 'accept-risk') {
      // A blocked expectation was never observed. Classifying why does not establish
      // anything about the product: replay it, or have someone accept the risk by name.
      // (First run of BMAD+'s own recipe: 17 of 21 blocked would otherwise have passed.)
      reasons.push(
        `${failure.step}/${failure.expect} was blocked: nothing was observed — replay it, or record accept-risk with decidedBy`
      );
    }
  }
  // A tick on a step that writes is not a write: the read-only proof settles it.
  for (const step of spec.steps || []) {
    if (!step.writes) continue;
    const observed = run.steps?.[step.id];
    if (!observed || stepState(observed) !== 'passed') continue;
    const check = decided.writeChecks.find((entry) => entry.step === step.id);
    if (!check || check.verified !== true || !String(check.evidence || '').trim()) {
      reasons.push(
        `${step.id}: passed but the write was never confirmed read-only (writeChecks.verified with evidence)`
      );
    }
  }
  return { status: reasons.length ? 'failed' : 'passed', reasons, run };
}

/** Play order across pending recipes: declared `after`, then witness collisions. */
function playOrder(specs) {
  const byId = new Map(specs.map((spec) => [spec.id, spec]));
  const edges = new Map(specs.map((spec) => [spec.id, new Set(spec.after || [])]));
  const collisions = [];
  for (const spec of specs) {
    for (const witness of spec.witnesses || []) {
      if (!(witness.writes || []).length) continue;
      for (const other of specs) {
        if (other.id === spec.id) continue;
        const reader = (other.witnesses || []).find(
          (w) => w.id === witness.id && (w.reads || []).length
        );
        if (!reader) continue;
        collisions.push({ witness: witness.id, writtenBy: spec.id, readBy: other.id });
        if (!edges.get(other.id).has(spec.id) && !edges.get(spec.id).has(other.id)) {
          edges.get(spec.id).add(other.id); // the reader plays before the writer unless declared otherwise
        }
      }
    }
  }
  const order = [];
  const state = new Map();
  const cycles = [];
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') {
      cycles.push([...trail, id].join(' → '));
      return;
    }
    state.set(id, 'open');
    for (const next of edges.get(id) || []) {
      if (byId.has(next)) visit(next, [...trail, id]);
    }
    state.set(id, 'done');
    order.push(id);
  };
  for (const spec of specs) visit(spec.id, []);
  return { order, collisions, cycles };
}

/**
 * A self-contained verifier for a Nexus check: no imports, so the plan's hash
 * covers the whole thing (`docs/specs/nexus-runtime.md`).
 */
function emitCheck({ specId, specSha256, dir = DEFAULT_DIR, writeSteps = [] }) {
  const source = `#!/usr/bin/env node
/** Generated by bmad-plus uat --emit-check. Verifies one human acceptance run. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const SPEC_ID = __SPEC_ID__;
const SPEC_SHA = __SPEC_SHA__;
const DIR = __DIR__;
const WRITE_STEPS = __WRITE_STEPS__;
const root = path.resolve(process.cwd(), DIR);
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (message) => {
  console.error('uat gate: ' + message);
  process.exit(1);
};
let runs = [];
const runDir = path.join(root, 'results', SPEC_ID);
try {
  runs = fs
    .readdirSync(runDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => read(path.join(runDir, name)))
    .filter((run) => run.specId === SPEC_ID && run.finishedAt);
} catch {
  fail('no finished run in ' + runDir);
}
if (!runs.length) fail('no finished run in ' + runDir);
runs.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
const run = runs[0];
if (run.specSha256 !== SPEC_SHA) fail('run ' + run.runId + ' answered another revision of the spec');
let triage = { runs: [] };
try {
  triage = read(path.join(root, 'triage', SPEC_ID + '.json'));
} catch {
  /* absence is handled below, per failure */
}
const decided = (triage.runs || []).find((entry) => entry.runId === run.runId) || { failures: [], writeChecks: [] };
const problems = [];
for (const [stepId, step] of Object.entries(run.steps || {})) {
  for (const [letter, expect] of Object.entries(step.expect || {})) {
    if (expect.state === null || expect.state === undefined) problems.push(stepId + '/' + letter + ' never answered');
    if (expect.state !== 'failed' && expect.state !== 'blocked') continue;
    const entry = (decided.failures || []).find((f) => f.step === stepId && f.expect === letter);
    if (!entry) problems.push(stepId + '/' + letter + ' ' + expect.state + ', not triaged');
    else if (!entry.class || entry.class === 'undecided' || !entry.decision) {
      problems.push(stepId + '/' + letter + ' triaged without a class and a decision');
    } else if (expect.state === 'blocked' && (entry.decision !== 'accept-risk' || !entry.decidedBy)) {
      problems.push(stepId + '/' + letter + ' was blocked and never observed; replay it or accept the risk by name');
    }
  }
}
// A tick on a step that writes is an observation; the read-only proof settles it.
for (const stepId of WRITE_STEPS) {
  const step = (run.steps || {})[stepId];
  if (!step) continue;
  const states = Object.values(step.expect || {}).map((expect) => expect.state);
  const passed = states.length && states.every((state) => state === 'passed' || state === 'skipped');
  if (!passed) continue;
  const check = (decided.writeChecks || []).find((entry) => entry.step === stepId);
  if (!check || check.verified !== true) problems.push(stepId + ' passed but its write was never confirmed read-only');
}
if (problems.length) fail(problems.join('; '));
console.log('uat gate: run ' + run.runId + ' by ' + run.tester + ' — human-observed, complete and triaged.');
`;
  return source
    .replace('__SPEC_ID__', () => JSON.stringify(specId))
    .replace('__SPEC_SHA__', () => JSON.stringify(specSha256))
    .replace('__DIR__', () => JSON.stringify(dir))
    .replace('__WRITE_STEPS__', () => JSON.stringify(writeSteps));
}

module.exports = {
  SPEC_SCHEMA,
  RESULTS_SCHEMA,
  TRIAGE_SCHEMA,
  DEFAULT_DIR,
  DEFAULT_BUDGET,
  STATES,
  TRIAGE_CLASSES,
  TRIAGE_DECISIONS,
  layout,
  loadSpec,
  fromLegacySpec,
  specHash,
  validateSpec,
  lintSpec,
  screenLabels,
  buildPage,
  PAGE_GUARANTEES,
  pageGuarantees,
  languageCode,
  normalizeRun,
  readRuns,
  stepState,
  failures,
  unanswered,
  loadTriage,
  gate,
  playOrder,
  emitCheck,
  STRINGS,
};
