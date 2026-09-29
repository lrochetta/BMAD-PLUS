'use strict';

// Editorial inputs stay in the source tree. npm publication is verified separately
// from README preparation so an unpublished candidate never becomes a public snapshot.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const semver = require('semver');
const { TOOL_METADATA } = require('../build/adapters.config');

const REGISTRY_URL = 'https://registry.npmjs.org/bmad-plus';
const SITE_URL = 'https://bmad-plus.rochetta.fr';
const LOCALES = ['en', 'fr', 'es', 'de'];
const MODES = [
  'write-readme',
  'check',
  'validate-candidate',
  'verify-history',
  'verify-unpublished',
  'sync-published',
];
const MAX_METADATA_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const CANDIDATE_SITE_URL = 'https://bmad-plus-candidate-synthetic.invalid';
const SYNTHETIC_FIXTURE_NOTICE =
  'SYNTHETIC FIXTURES: candidate rendering only; not publication evidence; never deploy.';
const CANDIDATE_NODE_TEST_FILES = Object.freeze(['check-release.test.js', 'check-search.test.js']);
const CANDIDATE_WEBSITE_FILES = Object.freeze([
  'build.js',
  'check-release.js',
  'check-search.js',
  'content.js',
  'docs-content.js',
  'search-assets.js',
  'docs-page.js',
  'docs-markdown.js',
  'page-shell.js',
  'public-links.js',
  'styles.css',
  'site.js',
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'share-card.png',
  '_headers',
  ...CANDIDATE_NODE_TEST_FILES,
]);

// Run the unmodified source renderer in its own process and disposable filesystem.
// Do not return paths or publication-shaped data to callers. The extra payload
// marker makes check-search reject accidental reuse of the validation output.
const CANDIDATE_CHECK_SCRIPT = String.raw`
'use strict';
const fs = require('node:fs');
const path = require('node:path');
console.log = () => {};
console.warn = () => {};
try {
  const snapshot = require('./website/release.json');
  if (!snapshot.syntheticFixtures || snapshot.deployable !== false ||
      snapshot.publicationVerified !== false || snapshot.version !== require('./package.json').version) {
    throw new Error('Candidate validation requires an explicitly synthetic snapshot of this package.');
  }
  const { checkRelease } = require('./website/check-release');
  const release = checkRelease();
  if (!release.ok) throw new Error(release.errors.slice(0, 12).join('\n'));
  const documentation = require('./website/docs-content');
  for (const [locale, copy] of Object.entries(documentation)) {
    for (const step of documentation.en.steps) {
      const translated = copy.steps.find(item => item.id === step.id);
      if (translated.type !== step.type ||
          (step.type === 'terminal' && translated.code !== step.code)) {
        throw new Error(locale + ': translated command type or code differs for ' + step.id + '.');
      }
    }
  }
  const built = require('./website/build').build({ siteUrl: process.env.SITE_URL });
  if (!built.report.ok) throw new Error(built.report.errors.slice(0, 12).join('\n'));
  fs.writeFileSync(path.join(built.outDir, 'SYNTHETIC-VALIDATION-NEVER-DEPLOY.txt'), snapshot.fixtureNotice + '\n');
  fs.appendFileSync(path.join(built.outDir, '_headers'), '\n/*\n  X-Robots-Tag: noindex, nofollow\n  X-BMAD-Validation: synthetic-fixtures-never-deploy\n');
  process.stdout.write(JSON.stringify({ ok: true, releaseChecks: release.checks,
    searchChecks: built.report.checks, pages: built.report.pages }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, message: String(error.message).slice(0, 6000) }));
  process.exitCode = 1;
}
`;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

function stableVersion(value) {
  return (
    typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) && semver.valid(value) === value
  );
}

function validDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function sameList(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changelogEntry(changelog, version) {
  requireCondition(
    typeof changelog === 'string' && stableVersion(version),
    'Invalid CHANGELOG input.'
  );
  const escaped = version.replace(/\./g, '\\.');
  const pattern = new RegExp(
    `^## \\[${escaped}\\][^\\n]*(?:\\n[\\s\\S]*?)?(?=^## |$(?![\\s\\S]))`,
    'gm'
  );
  const entries = normalizeNewlines(changelog).match(pattern) || [];
  requireCondition(entries.length <= 1, `${version}: duplicate CHANGELOG entries.`);
  return entries[0]?.trim() || '';
}

function notesHash(entry) {
  return crypto.createHash('sha256').update(entry).digest('hex');
}

function completeSummary(summary) {
  return (
    summary &&
    nonempty(summary.title) &&
    nonempty(summary.summary) &&
    Array.isArray(summary.items) &&
    summary.items.length > 0 &&
    summary.items.every(nonempty)
  );
}

function reviewedNotes(documentation, changelog, version) {
  if (
    !LOCALES.every((locale) => completeSummary(documentation[locale]?.releaseChanges?.[version]))
  ) {
    return null;
  }
  const itemCount = documentation.en.releaseChanges[version].items.length;
  if (
    !LOCALES.every(
      (locale) => documentation[locale].releaseChanges[version].items.length === itemCount
    )
  ) {
    return null;
  }
  const entry = changelogEntry(changelog, version);
  if (
    !entry ||
    !entry.includes('\n') ||
    !entry
      .slice(entry.indexOf('\n') + 1)
      .replace(/^###.*$/gm, '')
      .trim()
  ) {
    return null;
  }
  const notesDate = entry
    .split('\n')[0]
    .match(/^## \[[^\]]+\]\s+[-—]\s+(\d{4}-\d{2}-\d{2})\s*$/)?.[1];
  requireCondition(validDate(notesDate), `${version}: a real CHANGELOG notes date is required.`);
  return { version, notesDate, notesSha256: notesHash(entry) };
}

function selectReviewedReleases({ version, documentation, changelog }) {
  requireCondition(stableVersion(version), 'The candidate must have an exact stable version.');
  requireCondition(
    LOCALES.every((locale) => documentation?.[locale]?.releaseChanges),
    'Reviewed release summaries are required in English, French, Spanish and German.'
  );
  requireCondition(
    reviewedNotes(documentation, changelog, version),
    `${version}: a CHANGELOG entry and complete, matching summaries in all four languages are required.`
  );
  const versions = Object.keys(documentation.en.releaseChanges)
    .filter((item) => stableVersion(item) && semver.lte(item, version))
    .sort(semver.rcompare);
  const releases = [];
  for (const item of versions) {
    const notes = reviewedNotes(documentation, changelog, item);
    if (notes) releases.push(notes);
    if (releases.length === 3) break;
  }
  requireCondition(
    releases.length === 3 && releases[0].version === version,
    'Three reviewed releases with CHANGELOG entries are required, starting with the candidate.'
  );
  return releases;
}

function licenseFooter(sourceReadme) {
  requireCondition(
    typeof sourceReadme === 'string',
    'The source README with license credits is required.'
  );
  const normalized = normalizeNewlines(sourceReadme);
  const matches = [...normalized.matchAll(/^## [^\n]*\bLicense\s*$/gm)];
  requireCondition(matches.length === 1, 'The source README must contain one License footer.');
  const footer = normalized.slice(matches[0].index).trimEnd();
  requireCondition(
    /^### Credits\s*$/m.test(footer),
    'The source README license credits are missing.'
  );
  return footer;
}

function tableCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function codeBlock(code, type) {
  const longest = Math.max(2, ...(code.match(/`+/g) || []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${type === 'terminal' ? 'sh' : 'text'}\n${code}\n${fence}`;
}

function preparePublication({
  pkg,
  registry,
  landing,
  documentation,
  changelog,
  sourceReadme,
  release,
  toolMetadata = TOOL_METADATA,
}) {
  requireCondition(
    pkg?.name === 'bmad-plus' && stableVersion(pkg.version),
    'Publication requires the bmad-plus package with an exact stable version.'
  );
  requireCondition(
    registry?.product?.version === pkg.version && registry.product.code === pkg.name,
    'package.json and registry.product must describe the same package and version.'
  );
  requireCondition(
    nonempty(pkg.description) &&
      nonempty(pkg.license) &&
      nonempty(pkg.engines?.node) &&
      Object.values(pkg.engines).every(nonempty) &&
      semver.validRange(pkg.engines.node),
    'The package description, license and Node.js engine must be explicit.'
  );
  requireCondition(
    semver.minVersion(pkg.engines.node)?.version === registry.runtimes?.node?.min_version,
    'The package Node.js minimum differs from the registry runtime.'
  );
  requireCondition(
    registry.targets?.integration?.execution === 'host-managed' &&
      registry.targets.integration.lifecycle_events === 'not-integrated',
    'Review the execution wording before publishing a different host integration contract.'
  );
  requireCondition(registry.targets.spine === 'AGENTS.md', 'Review the documented project spine.');

  const packEntries = Object.values(registry.packs || {});
  requireCondition(
    packEntries.length > 0 &&
      packEntries.every(
        (pack) => Number.isInteger(pack.order) && pack.order >= 0 && nonempty(pack.cli?.name)
      ) &&
      new Set(packEntries.map((pack) => pack.order)).size === packEntries.length,
    'Registry packs need unique ordering and explicit CLI names.'
  );
  const packs = [...packEntries].sort((a, b) => a.order - b.order).map((pack) => pack.cli.name);
  requireCondition(new Set(packs).size === packs.length, 'Registry pack names must be unique.');
  const personas = registry.packs.core?.personas?.map((persona) => persona.name);
  requireCondition(
    personas?.length > 0 && personas.every(nonempty),
    'Core persona names are missing.'
  );
  for (const locale of LOCALES) {
    const copy = landing?.[locale];
    requireCondition(
      Array.isArray(copy?.packs) &&
        copy.packs.every(
          (pack) => Array.isArray(pack) && pack.length === 2 && pack.every(nonempty)
        ) &&
        sameList(
          copy.packs.map(([name]) => name),
          packs
        ),
      `${locale}: landing packs differ from the registry.`
    );
    requireCondition(
      Array.isArray(copy.roles) &&
        sameList(
          copy.roles.map((role) => role.name),
          personas
        ) &&
        copy.roles.every((role) => nonempty(role.job) && nonempty(role.summary)),
      `${locale}: landing roles differ from the registry.`
    );
  }
  const adapters = registry.targets.adapters;
  requireCondition(
    Array.isArray(adapters) &&
      adapters.length > 0 &&
      adapters.every(
        (adapter) =>
          nonempty(adapter.tool) &&
          nonempty(adapter.file) &&
          Object.hasOwn(toolMetadata, adapter.tool) &&
          nonempty(toolMetadata[adapter.tool]?.name)
      ) &&
      new Set(adapters.map((adapter) => adapter.tool)).size === adapters.length,
    'Registry targets must have unique, recognized adapters with explicit file paths.'
  );
  const tools = adapters.map((adapter) => toolMetadata[adapter.tool].name);
  requireCondition(new Set(tools).size === tools.length, 'Adapter display names must be unique.');
  requireCondition(
    release?.schemaVersion === 1 && validDate(release.reviewedAt),
    'Keep an explicit, real reviewedAt date in website/release.json.'
  );
  const releases = selectReviewedReleases({ version: pkg.version, documentation, changelog });
  requireCondition(
    release.reviewedAt >= releases[0].notesDate,
    'The explicit documentation review date predates the candidate release notes.'
  );

  const docs = documentation.en;
  requireCondition(
    Array.isArray(docs.steps) &&
      docs.steps.length > 0 &&
      docs.steps.every(
        (step) =>
          nonempty(step.id) &&
          nonempty(step.title) &&
          nonempty(step.body) &&
          nonempty(step.code) &&
          nonempty(step.outcome) &&
          ['terminal', 'assistant'].includes(step.type)
      ) &&
      new Set(docs.steps.map((step) => step.id)).size === docs.steps.length,
    'English documentation needs complete, distinct installation steps.'
  );
  requireCondition(
    docs.steps.find((step) => step.id === 'install')?.code === 'npx bmad-plus@{version} install' &&
      docs.steps.find((step) => step.id === 'install').type === 'terminal',
    'The installation guide must use the explicitly versioned package command.'
  );
  requireCondition(
    Array.isArray(docs.examples) &&
      docs.examples.length > 0 &&
      docs.examples.every(
        (example) =>
          nonempty(example.id) &&
          nonempty(example.title) &&
          nonempty(example.context) &&
          nonempty(example.prompt) &&
          nonempty(example.result)
      ) &&
      new Set(docs.examples.map((example) => example.id)).size === docs.examples.length,
    'English documentation needs complete, distinct examples.'
  );

  const resolve = (text) => text.replaceAll('{version}', pkg.version);
  const lines = [
    '# BMAD+',
    '',
    `[![Version](https://img.shields.io/badge/version-${pkg.version}-blue)](https://www.npmjs.com/package/bmad-plus)`,
    '',
    `**Version ${pkg.version}** · Node.js \`${pkg.engines.node}\` · ${pkg.license}`,
    '',
    pkg.description,
    '',
    `[Website](${SITE_URL}/) · [Get started](${SITE_URL}/docs/#start) · [Examples](${SITE_URL}/docs/#examples) · [What’s new](${SITE_URL}/docs/#news)`,
    '',
    registry.targets.optional_process_backend
      ? 'BMAD+ installs project instructions, roles and workflows for your existing AI coding tool. Default execution is host-managed: your tool supplies the model, permissions, command execution and any parallel-agent capability. Nexus can also launch an explicitly planned local command or Codex CLI process under a foreground supervisor, record its result and require independent checks before acceptance. Host permissions still apply; there is no background scheduler or universal host lifecycle integration. Model subscriptions and API access are separate.'
      : 'BMAD+ installs project instructions, roles and workflows for your existing AI coding tool. Execution is host-managed: your tool supplies the model, permissions, command execution and any parallel-agent capability. BMAD+ does not provide a standalone agent runtime or integrated host lifecycle hooks. Model subscriptions and API access are separate.',
    '',
    `Adapters: ${tools.join(', ')}.`,
    '',
    '## Get started',
    '',
    `Requires Node.js \`${pkg.engines.node}\`. Optional packs may need additional runtimes or API access. Run terminal commands from your project folder.`,
    '',
  ];
  docs.steps.forEach((step, index) => {
    lines.push(
      `### ${index + 1}. ${step.title}`,
      '',
      resolve(step.body),
      '',
      step.type === 'terminal' ? '**In your project terminal:**' : '**In your AI assistant:**',
      '',
      codeBlock(resolve(step.code), step.type),
      '',
      resolve(step.outcome),
      ''
    );
  });
  lines.push('## Core roles', '', '| Role | Focus | Purpose |', '| --- | --- | --- |');
  for (const role of landing.en.roles) {
    lines.push(`| ${tableCell(role.name)} | ${tableCell(role.job)} | ${tableCell(role.summary)} |`);
  }
  lines.push('', '## Packs', '', '| Pack | What it provides |', '| --- | --- |');
  for (const [name, description] of landing.en.packs) {
    lines.push(`| ${tableCell(name)} | ${tableCell(description)} |`);
  }
  lines.push('', '## Examples', '');
  for (const example of docs.examples) {
    lines.push(
      `### ${example.title}`,
      '',
      resolve(example.context),
      '',
      codeBlock(resolve(example.prompt), 'assistant'),
      '',
      resolve(example.result),
      ''
    );
  }
  const current = docs.releaseChanges[pkg.version];
  lines.push(
    `## What’s new in ${pkg.version}`,
    '',
    current.title,
    '',
    current.summary,
    '',
    ...current.items.map((item) => `- ${item}`),
    '',
    '## Version History',
    '',
    'These dates identify reviewed CHANGELOG notes, not npm publication dates. The website verifies npm publication dates separately.',
    '',
    '| Version | Release-notes date | Reviewed summary |',
    '| --- | --- | --- |'
  );
  for (const item of releases) {
    lines.push(
      `| ${item.version} | ${item.notesDate} | ${tableCell(docs.releaseChanges[item.version].summary)} |`
    );
  }
  lines.push(
    '',
    `[Release history and update guide](${SITE_URL}/docs/#changelog) · [All published npm versions](https://www.npmjs.com/package/bmad-plus?activeTab=versions)`,
    '',
    '---',
    '',
    licenseFooter(sourceReadme),
    ''
  );
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    engines: { ...pkg.engines },
    nodeEngine: pkg.engines.node,
    license: pkg.license,
    reviewedAt: release.reviewedAt,
    packs,
    tools,
    releases,
    readme: lines.join('\n'),
  };
}

function generateReadme(sources) {
  return preparePublication(sources).readme;
}

function publicationDate(metadata, version) {
  requireCondition(
    metadata?.versions?.[version]?.version === version,
    `${version}: the version is not present in official npm metadata.`
  );
  const publishedAt = metadata.time?.[version];
  requireCondition(
    typeof publishedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(publishedAt) &&
      Number.isFinite(Date.parse(publishedAt)) &&
      new Date(publishedAt).toISOString() === publishedAt,
    `${version}: a real npm publication timestamp is required.`
  );
  return publishedAt;
}

function verifyHistory({ publication, metadata }) {
  requireCondition(
    metadata?.name === publication.name,
    'npm metadata describes a different package.'
  );
  const latest = metadata?.['dist-tags']?.latest;
  requireCondition(
    stableVersion(latest) && metadata.versions?.[latest]?.version === latest,
    'npm latest is unknown or is not a published stable release.'
  );
  requireCondition(
    semver.gte(publication.version, latest),
    'The candidate is older than npm latest; refusing a stale release.'
  );
  const history = publication.releases.filter((item) => item.version !== publication.version);
  for (const item of history) publicationDate(metadata, item.version);
  return { latestVersion: latest, verifiedVersions: history.map((item) => item.version) };
}

function verifyUnpublished({ publication, metadata }) {
  requireCondition(
    metadata?.name === publication.name &&
      metadata.versions &&
      typeof metadata.versions === 'object' &&
      !Array.isArray(metadata.versions),
    'npm publication metadata is unknown.'
  );
  if (Object.hasOwn(metadata.versions, publication.version)) {
    const error = new Error(
      `${publication.version} is already published on npm. Use landing_only recovery; never republish this version.`
    );
    error.code = 'ALREADY_PUBLISHED';
    error.recovery = 'landing_only';
    throw error;
  }
  return { ...verifyHistory({ publication, metadata }), candidateUnpublished: true };
}

function syntheticCandidateSnapshot(publication) {
  return {
    schemaVersion: 1,
    version: publication.version,
    reviewedAt: publication.reviewedAt,
    nodeEngine: publication.nodeEngine,
    license: publication.license,
    packs: [...publication.packs],
    tools: [...publication.tools],
    releases: publication.releases.map((item, index) => ({
      version: item.version,
      // Deliberately fixed fixture timestamps; they are not inferred publication dates.
      publishedAt: new Date(Date.UTC(2000, 0, 3 - index)).toISOString(),
      notesDate: item.notesDate,
      notesSha256: item.notesSha256,
    })),
    syntheticFixtures: true,
    publicationVerified: false,
    deployable: false,
    fixtureNotice: SYNTHETIC_FIXTURE_NOTICE,
  };
}

function validateCandidate({ rootDir, publication, runner = spawnSync }) {
  const parent = fs.realpathSync(os.tmpdir());
  const prefix = 'bmad-candidate-synthetic-';
  const temporary = fs.mkdtempSync(path.join(parent, prefix));
  try {
    const website = path.join(rootDir, 'website');
    requireCondition(
      fs.lstatSync(website).isDirectory() && !fs.lstatSync(website).isSymbolicLink(),
      'Candidate validation requires a real website source directory.'
    );
    fs.mkdirSync(path.join(temporary, 'website'));
    const files = [
      'package.json',
      'CHANGELOG.md',
      ...CANDIDATE_WEBSITE_FILES.map((file) => path.join('website', file)),
    ];
    for (const file of files) {
      const source = path.join(rootDir, file);
      const stat = fs.lstatSync(source);
      requireCondition(
        stat.isFile() && !stat.isSymbolicLink(),
        `Candidate source must be a regular file: ${file}.`
      );
      fs.copyFileSync(source, path.join(temporary, file));
    }
    const snapshot = syntheticCandidateSnapshot(publication);
    fs.writeFileSync(
      path.join(temporary, 'website/release.json'),
      `${JSON.stringify(snapshot, null, 2)}\n`
    );
    fs.writeFileSync(
      path.join(temporary, 'SYNTHETIC-FIXTURES-NEVER-DEPLOY.txt'),
      `${SYNTHETIC_FIXTURE_NOTICE}\n`
    );
    const processOptions = {
      cwd: temporary,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      shell: false,
      windowsHide: true,
      killSignal: 'SIGKILL',
      env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', SITE_URL: CANDIDATE_SITE_URL },
    };
    const result = runner(process.execPath, ['-e', CANDIDATE_CHECK_SCRIPT], processOptions);
    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        'Candidate site validation did not return a valid result; no publication is verified.'
      );
    }
    requireCondition(
      !result.error && !result.signal,
      'Candidate site validation could not complete within the process limits.'
    );
    requireCondition(
      result.status === 0 && report.ok === true,
      `Candidate site validation failed: ${typeof report.message === 'string' ? report.message.slice(0, 6000) : 'invalid validation result'}`
    );
    requireCondition(
      Number.isInteger(report.releaseChecks) &&
        report.releaseChecks > 0 &&
        Number.isInteger(report.searchChecks) &&
        report.searchChecks > 0 &&
        report.pages === LOCALES.length * 2,
      'Candidate validation did not verify all locale pages.'
    );
    let testResult;
    try {
      testResult = runner(
        process.execPath,
        [
          '--test',
          '--test-reporter=tap',
          ...CANDIDATE_NODE_TEST_FILES.map((file) => path.join('website', file)),
        ],
        processOptions
      );
    } catch {
      throw new Error('Candidate website Node tests could not start; no publication is verified.');
    }
    requireCondition(
      testResult && !testResult.error && !testResult.signal,
      'Candidate website Node tests could not complete within the process limits.'
    );
    requireCondition(
      testResult.status === 0,
      'Candidate website Node tests failed before publication (check-release.test.js, check-search.test.js).'
    );
    const count = (label) =>
      Number(testResult.stdout?.match(new RegExp(`^# ${label} (\\d+)\\r?$`, 'm'))?.[1]);
    const websiteTests = count('tests');
    requireCondition(
      Number.isInteger(websiteTests) &&
        websiteTests > 0 &&
        count('pass') === websiteTests &&
        count('fail') === 0 &&
        count('cancelled') === 0 &&
        count('skipped') === 0 &&
        count('todo') === 0,
      'Candidate website Node tests did not confirm a complete passing test run.'
    );
    return {
      syntheticFixtures: true,
      publicationVerified: false,
      deployable: false,
      artifactsRetained: false,
      message: SYNTHETIC_FIXTURE_NOTICE,
      releaseChecks: report.releaseChecks,
      searchChecks: report.searchChecks,
      pages: report.pages,
      websiteTests,
    };
  } finally {
    // Verify the exact absolute mkdtemp target before a recursive Windows removal.
    requireCondition(
      path.dirname(temporary) === parent &&
        path.basename(temporary).startsWith(prefix) &&
        !fs.lstatSync(temporary).isSymbolicLink(),
      'Refusing an unexpected candidate cleanup target.'
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function buildPublishedSnapshot({ publication, metadata }) {
  verifyHistory({ publication, metadata });
  requireCondition(
    metadata['dist-tags'].latest === publication.version,
    'The candidate must equal npm latest before the website can be synchronized.'
  );
  const published = metadata.versions[publication.version];
  const sortedEntries = (object) =>
    Object.entries(object || {}).sort(([a], [b]) => a.localeCompare(b));
  requireCondition(
    sameList(sortedEntries(published.engines), sortedEntries(publication.engines)) &&
      published.license === publication.license &&
      published.description === publication.description,
    'The npm engines, license or description differ from the candidate package.'
  );
  requireCondition(
    typeof metadata.readme === 'string' &&
      normalizeNewlines(metadata.readme) === normalizeNewlines(publication.readme),
    'The published npm README is missing or stale; website synchronization was refused.'
  );
  let previous = Infinity;
  const releases = publication.releases.map((item) => {
    const publishedAt = publicationDate(metadata, item.version);
    requireCondition(
      Date.parse(publishedAt) < previous,
      'Review the selected history: npm publication dates must be newest first.'
    );
    previous = Date.parse(publishedAt);
    return {
      version: item.version,
      publishedAt,
      notesDate: item.notesDate,
      notesSha256: item.notesSha256,
    };
  });
  return {
    schemaVersion: 1,
    version: publication.version,
    reviewedAt: publication.reviewedAt,
    nodeEngine: publication.nodeEngine,
    license: publication.license,
    packs: [...publication.packs],
    tools: [...publication.tools],
    releases,
  };
}

async function fetchOfficialMetadata() {
  try {
    const response = await globalThis.fetch(REGISTRY_URL, {
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    requireCondition(response.ok && response.body, 'npm metadata request failed.');
    const length = response.headers.get('content-length');
    requireCondition(
      length === null || (/^\d+$/.test(length) && Number(length) <= MAX_METADATA_BYTES),
      'npm metadata exceeds the response limit.'
    );
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        requireCondition(size <= MAX_METADATA_BYTES, 'npm metadata exceeds the response limit.');
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
  } catch {
    // Neither remote response bodies nor environment credentials belong in errors.
    throw new Error('Official npm metadata could not be read within the request limits.');
  }
}

function readSources(rootDir) {
  const read = (name) => fs.readFileSync(path.join(rootDir, name), 'utf8');
  const freshModule = (name) => {
    const filename = require.resolve(path.join(rootDir, name));
    delete require.cache[filename];
    return require(filename);
  };
  return {
    pkg: JSON.parse(read('package.json')),
    registry: yaml.load(read('registry.yaml')),
    landing: freshModule('website/content.js'),
    documentation: freshModule('website/docs-content.js'),
    sourceReadme: read('README.md'),
    changelog: read('CHANGELOG.md'),
    release: JSON.parse(read('website/release.json')),
  };
}

function replaceFile(filename, content) {
  requireCondition(
    !fs.lstatSync(path.dirname(filename)).isSymbolicLink(),
    'Refusing a redirected publication directory.'
  );
  if (fs.existsSync(filename)) {
    requireCondition(
      fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(),
      'Refusing a redirected publication file.'
    );
  }
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function runPublicationContent({
  mode,
  rootDir = path.resolve(__dirname, '../..'),
  getMetadata = fetchOfficialMetadata,
} = {}) {
  requireCondition(
    MODES.includes(mode),
    `Choose exactly one mode: ${MODES.map((item) => `--${item}`).join(', ')}.`
  );
  const publication = preparePublication(readSources(rootDir));
  const readmePath = path.join(rootDir, 'README-DIST.md');
  const existing = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : null;
  const matches =
    existing !== null && normalizeNewlines(existing) === normalizeNewlines(publication.readme);
  if (mode === 'write-readme') {
    if (!matches) replaceFile(readmePath, publication.readme);
    return { ok: true, mode, version: publication.version, changed: !matches };
  }
  requireCondition(
    matches,
    'README-DIST.md is stale or missing. Run --write-readme and review the generated content.'
  );
  if (mode === 'check') return { ok: true, mode, version: publication.version, changed: false };
  if (mode === 'validate-candidate') {
    return {
      ok: true,
      mode,
      version: publication.version,
      changed: false,
      ...validateCandidate({ rootDir, publication }),
    };
  }
  let metadata;
  try {
    metadata = await getMetadata();
  } catch {
    throw new Error('Official npm publication could not be verified; no files were changed.');
  }
  if (mode === 'verify-history') {
    return {
      ok: true,
      mode,
      version: publication.version,
      changed: false,
      ...verifyHistory({ publication, metadata }),
    };
  }
  if (mode === 'verify-unpublished') {
    return {
      ok: true,
      mode,
      version: publication.version,
      changed: false,
      ...verifyUnpublished({ publication, metadata }),
    };
  }
  const snapshot = buildPublishedSnapshot({ publication, metadata });
  const target = path.join(rootDir, 'website/release.json');
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  const changed = normalizeNewlines(fs.readFileSync(target, 'utf8')) !== content;
  if (changed) replaceFile(target, content);
  return { ok: true, mode, version: publication.version, changed };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  runPublicationContent({
    mode: args.length === 1 && args[0].startsWith('--') ? args[0].slice(2) : null,
  })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  REGISTRY_URL,
  SITE_URL,
  MAX_METADATA_BYTES,
  REQUEST_TIMEOUT_MS,
  CANDIDATE_WEBSITE_FILES,
  CANDIDATE_NODE_TEST_FILES,
  CANDIDATE_SITE_URL,
  SYNTHETIC_FIXTURE_NOTICE,
  normalizeNewlines,
  changelogEntry,
  notesHash,
  licenseFooter,
  selectReviewedReleases,
  preparePublication,
  generateReadme,
  verifyHistory,
  verifyUnpublished,
  syntheticCandidateSnapshot,
  validateCandidate,
  buildPublishedSnapshot,
  fetchOfficialMetadata,
  runPublicationContent,
};
