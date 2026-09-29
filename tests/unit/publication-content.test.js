const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const {
  REGISTRY_URL,
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
  preparePublication,
  generateReadme,
  selectReviewedReleases,
  verifyHistory,
  verifyUnpublished,
  syntheticCandidateSnapshot,
  validateCandidate,
  buildPublishedSnapshot,
  fetchOfficialMetadata,
  runPublicationContent,
} = require('../../tools/release/publication-content');

const LOCALES = ['en', 'fr', 'es', 'de'];
const DATES = { '0.14.0': '2026-09-09', '0.13.0': '2026-09-07', '0.12.2': '2026-07-16' };
const FOOTER = [
  '## License',
  '',
  'MIT — original package and imported source notices follow.',
  '',
  '### Credits',
  '',
  '**Creator**',
  '- Laurent Rochetta',
  '',
  '**External sources**',
  '- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)',
  '- [OSINT](https://github.com/smixs/osint-skill) (MIT)',
  '- Apify Actor Runner (MIT)',
  '- Karpathy Guardrails (MIT)',
  '',
  'Copyright Original Contributors. Preserve this entire imported notice.',
].join('\n');

let rootDir;

function sources() {
  const pkg = {
    name: 'bmad-plus',
    version: '0.14.0',
    description: 'Project-local AI development workflows with clear roles and safe updates',
    engines: { node: '>=20.0.0' },
    license: 'MIT',
  };
  const roles = [
    { name: 'Atlas', job: 'Strategy', summary: 'Define the goal.' },
    { name: 'Forge', job: 'Development', summary: 'Implement one story.' },
    { name: 'Sentinel', job: 'Quality', summary: 'Check the result.' },
    { name: 'Nexus', job: 'Coordination', summary: 'Plan dependent work.' },
  ];
  const registry = {
    product: { code: pkg.name, version: pkg.version },
    runtimes: { node: { min_version: '20.0.0' } },
    targets: {
      spine: 'AGENTS.md',
      integration: { execution: 'host-managed', lifecycle_events: 'not-integrated' },
      adapters: [
        { tool: 'claude-code', file: 'CLAUDE.md' },
        { tool: 'codex-cli', file: '.codex/AGENTS.md' },
      ],
    },
    packs: {
      seo: { order: 1, cli: { name: 'SEO' } },
      core: { order: 0, cli: { name: 'Core' }, personas: roles.map(({ name }) => ({ name })) },
    },
  };
  const landing = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      {
        roles: globalThis.structuredClone(roles),
        packs: [
          ['Core', `${locale} development workflows.`],
          ['SEO', `${locale} search workflows.`],
        ],
      },
    ])
  );
  const documentation = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      {
        steps: [
          {
            id: 'prepare',
            title: 'Open the project',
            body: 'Open a terminal in your repository.',
            type: 'terminal',
            code: 'node --version',
            outcome: 'Requires Node.js v20 or newer.',
          },
          {
            id: 'install',
            title: 'Install the selected release',
            body: 'Select tools and packs.',
            type: 'terminal',
            code: 'npx bmad-plus@{version} install',
            outcome: 'Reopen your AI coding tool.',
          },
          {
            id: 'activate',
            title: 'See the roles',
            body: 'Ask your assistant to load AGENTS.md.',
            type: 'assistant',
            code: 'bmad-help',
            outcome: 'There is no extra initialization command.',
          },
        ],
        examples: [
          {
            id: 'feature',
            title: 'Build one feature',
            context: 'Use a concrete scope.',
            prompt: 'Forge, implement the first approved story and ask Sentinel for a review.',
            result: 'Expected result: a change with verification evidence.',
          },
        ],
        releaseChanges: Object.fromEntries(
          Object.keys(DATES).map((version) => [
            version,
            {
              title: `${locale} title ${version}`,
              summary: `${locale} reviewed summary ${version}`,
              items: [
                `${locale} reviewed improvement ${version}`,
                `${locale} checked behavior ${version}`,
              ],
            },
          ])
        ),
      },
    ])
  );
  const changelog = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    ...Object.entries(DATES).flatMap(([version, date]) => [
      `## [${version}] - ${date}`,
      '',
      '### Added',
      '',
      `- Detailed implementation notes for ${version}.`,
      '- PRIVATE_INTERNAL_TRACE_DONT_PUBLISH',
      '',
    ]),
    '## [0.11.0] - 2026-07-02',
    '',
    '- A local version never published on npm.',
    '',
  ].join('\n');
  return {
    pkg,
    registry,
    landing,
    documentation,
    changelog,
    sourceReadme: `# Source README\n\nPrivate development details.\n\n${FOOTER}\n`,
    release: {
      schemaVersion: 1,
      version: '0.13.0',
      reviewedAt: '2026-09-09',
      packs: ['Previously published pack'],
      tools: ['Previously published adapter'],
      releases: [],
    },
  };
}

function metadata(publication) {
  return {
    name: 'bmad-plus',
    'dist-tags': { latest: publication.version },
    versions: {
      '0.14.0': {
        name: 'bmad-plus',
        version: '0.14.0',
        description: publication.description,
        engines: { ...publication.engines },
        license: publication.license,
      },
      '0.13.0': { name: 'bmad-plus', version: '0.13.0' },
      '0.12.2': { name: 'bmad-plus', version: '0.12.2' },
    },
    time: {
      '0.14.0': '2026-09-09T10:30:18.001Z',
      '0.13.0': '2026-09-08T02:32:18.074Z',
      '0.12.2': '2026-07-17T12:13:31.485Z',
    },
    readme: publication.readme,
  };
}

function candidateSources() {
  const input = sources();
  const projectRoot = path.resolve(__dirname, '../..');
  input.registry = yaml.load(fs.readFileSync(path.join(projectRoot, 'registry.yaml'), 'utf8'));
  input.registry.product.version = input.pkg.version;
  input.landing = globalThis.structuredClone(require('../../website/content'));
  input.documentation = globalThis.structuredClone(require('../../website/docs-content'));
  for (const locale of LOCALES) {
    const template = Object.values(input.documentation[locale].releaseChanges)[0];
    input.documentation[locale].releaseChanges = Object.fromEntries(
      Object.keys(DATES).map((version) => [
        version,
        {
          title: `${template.title} (${version})`,
          summary: `${template.summary} (${version})`,
          items: [...template.items],
        },
      ])
    );
  }
  return input;
}

function writeCandidateFixture(input) {
  writeFixture(input, generateReadme(input));
  const actualWebsite = path.resolve(__dirname, '../../website');
  for (const file of CANDIDATE_WEBSITE_FILES) {
    if (!['content.js', 'docs-content.js'].includes(file)) {
      fs.copyFileSync(path.join(actualWebsite, file), path.join(rootDir, 'website', file));
    }
  }
  // These source-side artifacts must neither be copied to the candidate nor altered.
  fs.writeFileSync(path.join(rootDir, 'website/linkedin-profile.md'), 'Private profile notes');
  fs.mkdirSync(path.join(rootDir, 'website/qa-output'));
  fs.writeFileSync(path.join(rootDir, 'website/qa-output/browser-report.json'), '{"private":true}');
  fs.mkdirSync(path.join(rootDir, 'website/dist'));
  fs.writeFileSync(path.join(rootDir, 'website/dist/index.html'), 'Existing public build');
}

function writeFixture(input, readme = 'Previous npm README\n') {
  fs.mkdirSync(path.join(rootDir, 'website'), { recursive: true });
  const files = {
    'package.json': JSON.stringify(input.pkg),
    'registry.yaml': yaml.dump(input.registry),
    'website/content.js': `module.exports = ${JSON.stringify(input.landing)};\n`,
    'website/docs-content.js': `module.exports = ${JSON.stringify(input.documentation)};\n`,
    'website/release.json': `${JSON.stringify(input.release, null, 2)}\n`,
    'README.md': input.sourceReadme,
    'README-DIST.md': readme,
    'CHANGELOG.md': input.changelog,
  };
  for (const [file, value] of Object.entries(files))
    fs.writeFileSync(path.join(rootDir, file), value);
}

function fixtureBytes() {
  const files = {};
  function visit(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relative + '/');
      else files[relative] = fs.readFileSync(absolute).toString('base64');
    }
  }
  visit(rootDir);
  return files;
}

function fakeResponse(chunks, { length = null, ok = true } = {}) {
  const remaining = chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  const reader = {
    read: jest.fn(async () =>
      remaining.length ? { value: remaining.shift(), done: false } : { done: true }
    ),
    cancel: jest.fn(async () => {}),
    releaseLock: jest.fn(),
  };
  return {
    ok,
    headers: { get: jest.fn(() => length) },
    body: { getReader: jest.fn(() => reader) },
    reader,
  };
}

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bmad-publication-'));
});

afterEach(() => {
  jest.restoreAllMocks();
  if (
    path.dirname(rootDir) !== fs.realpathSync(os.tmpdir()) ||
    !path.basename(rootDir).startsWith('bmad-publication-')
  ) {
    throw new Error('Unexpected publication fixture cleanup target');
  }
  fs.rmSync(rootDir, { recursive: true, force: true });
});

test('generates the npm README from candidate facts and English editorial copy, preserving every credit', () => {
  const input = sources();
  const before = JSON.stringify(input);
  const publication = preparePublication(input);
  const readme = publication.readme;
  expect(readme).toContain(input.pkg.description);
  expect(readme).toContain(
    '[![Version](https://img.shields.io/badge/version-0.14.0-blue)](https://www.npmjs.com/package/bmad-plus)'
  );
  expect(readme).toContain('[Release history and update guide]');
  expect(readme).not.toContain('[Full release notes and update guide]');
  expect(readme).toContain('**Version 0.14.0** · Node.js `>=20.0.0` · MIT');
  expect(readme).toContain('```sh\nnpx bmad-plus@0.14.0 install\n```');
  expect(readme).toContain('```text\nbmad-help\n```');
  expect(readme).toContain('https://bmad-plus.rochetta.fr/docs/#start');
  expect(readme).toContain('https://bmad-plus.rochetta.fr/docs/#examples');
  expect(readme).toContain('host-managed');
  expect(readme).toContain('your tool supplies the model, permissions, command execution');
  expect(readme).toContain('no extra initialization command');
  expect(readme).toContain(input.documentation.en.examples[0].prompt);
  expect(readme).toContain('| Atlas | Strategy | Define the goal. |');
  expect(readme).toContain('| Core | en development workflows. |');
  expect(readme).toContain('| Version | Release-notes date | Reviewed summary |');
  expect(readme).toContain('| 0.13.0 | 2026-09-07 | en reviewed summary 0.13.0 |');
  expect(readme).not.toContain('PRIVATE_INTERNAL_TRACE_DONT_PUBLISH');
  expect(readme).not.toContain('0.11.0');
  expect(readme).not.toContain('{version}');
  expect(readme.endsWith(`${FOOTER}\n`)).toBe(true);
  expect(publication.packs).toEqual(['Core', 'SEO']);
  expect(publication.tools).toEqual(['Claude Code', 'Codex CLI']);
  expect(JSON.stringify(input)).toBe(before);
  expect(generateReadme(input)).toBe(readme);
});

test('hashes only the selected normalized CHANGELOG entry, including the last entry at EOF', () => {
  const input = sources();
  const lfEntry = changelogEntry(input.changelog, '0.14.0');
  expect(changelogEntry(input.changelog.replaceAll('\n', '\r\n'), '0.14.0')).toBe(lfEntry);
  expect(lfEntry).not.toContain('## [0.13.0]');
  expect(changelogEntry('## [0.14.0] — 2026-09-09\n\n- Final entry.', '0.14.0')).toBe(
    '## [0.14.0] — 2026-09-09\n\n- Final entry.'
  );
  expect(preparePublication(input).releases[0].notesSha256).toBe(notesHash(lfEntry));
});

test('uses three complete reviewed versions, ignoring unpublished future notes and unreviewed older entries', () => {
  const input = sources();
  input.documentation.en.releaseChanges['0.15.0'] = { title: 'Future draft' };
  input.documentation.en.releaseChanges['0.13.9'] = { title: 'Incomplete old draft' };
  const releases = selectReviewedReleases({
    version: input.pkg.version,
    documentation: input.documentation,
    changelog: input.changelog,
  });
  expect(releases.map((item) => item.version)).toEqual(['0.14.0', '0.13.0', '0.12.2']);
});

test('requires three reviewed entries and does not silently substitute unreviewed local versions', () => {
  const input = sources();
  delete input.documentation.fr.releaseChanges['0.12.2'];
  expect(() => preparePublication(input)).toThrow('Three reviewed releases');
});

test.each([
  [
    'missing candidate translation',
    (input) => {
      delete input.documentation.fr.releaseChanges['0.14.0'];
    },
    /all four languages/,
  ],
  [
    'empty candidate summary',
    (input) => {
      input.documentation.de.releaseChanges['0.14.0'].summary = ' ';
    },
    /all four languages/,
  ],
  [
    'different translation item counts',
    (input) => {
      input.documentation.es.releaseChanges['0.14.0'].items.pop();
    },
    /all four languages/,
  ],
  [
    'missing locale',
    (input) => {
      delete input.documentation.de;
    },
    /German/,
  ],
  [
    'missing candidate notes',
    (input) => {
      input.changelog = input.changelog.replace('## [0.14.0]', '## [0.14.1]');
    },
    /CHANGELOG entry/,
  ],
  [
    'empty candidate notes',
    (input) => {
      input.changelog = input.changelog.replace(
        changelogEntry(input.changelog, '0.14.0'),
        '## [0.14.0] - 2026-09-09\n\n### Added'
      );
    },
    /CHANGELOG entry/,
  ],
  [
    'duplicate candidate notes',
    (input) => {
      input.changelog += '\n## [0.14.0] - 2026-09-09\n\n- Duplicate.\n';
    },
    /duplicate CHANGELOG/,
  ],
  [
    'invalid notes date',
    (input) => {
      input.changelog = input.changelog.replace('2026-09-09', '2026-02-30');
    },
    /real CHANGELOG notes date/,
  ],
  [
    'version mismatch',
    (input) => {
      input.registry.product.version = '0.13.0';
    },
    /same package and version/,
  ],
  [
    'prerelease candidate',
    (input) => {
      input.pkg.version = '0.14.0-beta.1';
    },
    /exact stable version/,
  ],
  [
    'wrong package',
    (input) => {
      input.pkg.name = 'some-other-package';
    },
    /bmad-plus package/,
  ],
  [
    'missing description',
    (input) => {
      delete input.pkg.description;
    },
    /description, license/,
  ],
  [
    'inconsistent Node minimum',
    (input) => {
      input.pkg.engines.node = '>=22.0.0';
    },
    /registry runtime/,
  ],
  [
    'pack translation drift',
    (input) => {
      input.landing.es.packs[1][0] = 'Extra pack';
    },
    /es: landing packs/,
  ],
  [
    'missing landing pack',
    (input) => {
      input.landing.en.packs.pop();
    },
    /en: landing packs/,
  ],
  [
    'duplicate pack ordering',
    (input) => {
      input.registry.packs.seo.order = 0;
    },
    /unique ordering/,
  ],
  [
    'role mismatch',
    (input) => {
      input.landing.fr.roles[0].name = 'Another role';
    },
    /fr: landing roles/,
  ],
  [
    'unknown adapter',
    (input) => {
      input.registry.targets.adapters[0].tool = 'unknown-host';
    },
    /recognized adapters/,
  ],
  [
    'duplicate adapter',
    (input) => {
      input.registry.targets.adapters.push(input.registry.targets.adapters[0]);
    },
    /recognized adapters/,
  ],
  [
    'unreviewed integration claim',
    (input) => {
      input.registry.targets.integration.execution = 'native-runtime';
    },
    /execution wording/,
  ],
  [
    'missing review date',
    (input) => {
      delete input.release.reviewedAt;
    },
    /explicit, real reviewedAt/,
  ],
  [
    'review date before notes',
    (input) => {
      input.release.reviewedAt = '2026-09-08';
    },
    /predates/,
  ],
  [
    'invalid review date',
    (input) => {
      input.release.reviewedAt = '2026-02-30';
    },
    /explicit, real reviewedAt/,
  ],
  [
    'unversioned install command',
    (input) => {
      input.documentation.en.steps[1].code = 'npx bmad-plus install';
    },
    /explicitly versioned/,
  ],
  [
    'missing license footer',
    (input) => {
      input.sourceReadme = '# No footer';
    },
    /License footer/,
  ],
  [
    'missing credits',
    (input) => {
      input.sourceReadme = '## License\nMIT\n';
    },
    /license credits/,
  ],
])('refuses %s before writing any publication file', async (_name, change, error) => {
  const input = sources();
  change(input);
  writeFixture(input);
  const before = fixtureBytes();
  const getMetadata = jest.fn();
  await expect(
    runPublicationContent({ mode: 'write-readme', rootDir, getMetadata })
  ).rejects.toThrow(error);
  expect(fixtureBytes()).toEqual(before);
  expect(getMetadata).not.toHaveBeenCalled();
});

test('keeps the entire license footer when CRLF input contains multiple source notices', () => {
  expect(licenseFooter(`# Intro\r\n\r\n${FOOTER.replaceAll('\n', '\r\n')}\r\n`)).toBe(FOOTER);
});

test('writes and checks only the candidate README without accessing npm or changing the website', async () => {
  const input = sources();
  writeFixture(input);
  const original = fixtureBytes();
  const getMetadata = jest.fn();
  await expect(
    runPublicationContent({ mode: 'write-readme', rootDir, getMetadata })
  ).resolves.toEqual({ ok: true, mode: 'write-readme', version: '0.14.0', changed: true });
  const after = fixtureBytes();
  expect(after['README-DIST.md']).not.toEqual(original['README-DIST.md']);
  delete after['README-DIST.md'];
  delete original['README-DIST.md'];
  expect(after).toEqual(original);
  await expect(
    runPublicationContent({ mode: 'check', rootDir, getMetadata })
  ).resolves.toMatchObject({ ok: true, changed: false });
  await expect(
    runPublicationContent({ mode: 'write-readme', rootDir, getMetadata })
  ).resolves.toMatchObject({ ok: true, changed: false });
  expect(getMetadata).not.toHaveBeenCalled();
});

test.each(['check', 'verify-history', 'sync-published'])(
  '%s refuses a stale local README without fetching or writing',
  async (mode) => {
    writeFixture(sources());
    const before = fixtureBytes();
    const getMetadata = jest.fn();
    await expect(runPublicationContent({ mode, rootDir, getMetadata })).rejects.toThrow(
      'README-DIST.md is stale'
    );
    expect(fixtureBytes()).toEqual(before);
    expect(getMetadata).not.toHaveBeenCalled();
  }
);

test('check accepts CRLF but catches editorial drift in the source README footer', async () => {
  const input = sources();
  const readme = generateReadme(input);
  writeFixture(input, readme.replaceAll('\n', '\r\n'));
  await expect(runPublicationContent({ mode: 'check', rootDir })).resolves.toMatchObject({
    ok: true,
  });
  fs.appendFileSync(path.join(rootDir, 'README.md'), 'An additional imported copyright notice.\n');
  const before = fixtureBytes();
  await expect(runPublicationContent({ mode: 'check', rootDir })).rejects.toThrow(
    'README-DIST.md is stale'
  );
  expect(fixtureBytes()).toEqual(before);
});

test('verifies historical publication before publish while the candidate is absent and npm README is older', async () => {
  const input = sources();
  const publication = preparePublication(input);
  writeFixture(input, publication.readme);
  const npm = metadata(publication);
  delete npm.versions['0.14.0'];
  delete npm.time['0.14.0'];
  npm['dist-tags'].latest = '0.13.0';
  npm.readme = 'Older published README';
  const before = fixtureBytes();
  await expect(
    runPublicationContent({ mode: 'verify-history', rootDir, getMetadata: async () => npm })
  ).resolves.toEqual({
    ok: true,
    mode: 'verify-history',
    version: '0.14.0',
    changed: false,
    latestVersion: '0.13.0',
    verifiedVersions: ['0.13.0', '0.12.2'],
  });
  expect(fixtureBytes()).toEqual(before);
});

test('rejects local CHANGELOG history that npm never published', () => {
  const publication = preparePublication(sources());
  const npm = metadata(publication);
  delete npm.versions['0.12.2'];
  expect(() => verifyHistory({ publication, metadata: npm })).toThrow(
    '0.12.2: the version is not present'
  );
});

test('synchronizes only after package facts and README match; publication dates come from npm', async () => {
  const input = sources();
  const publication = preparePublication(input);
  writeFixture(input, publication.readme);
  const npm = metadata(publication);
  npm.readme = npm.readme.replaceAll('\n', '\r\n');
  const before = fixtureBytes();
  const getMetadata = jest.fn(async () => npm);
  await expect(
    runPublicationContent({ mode: 'sync-published', rootDir, getMetadata })
  ).resolves.toMatchObject({ ok: true, changed: true });
  const after = fixtureBytes();
  const snapshot = JSON.parse(fs.readFileSync(path.join(rootDir, 'website/release.json'), 'utf8'));
  expect(snapshot).toEqual(buildPublishedSnapshot({ publication, metadata: npm }));
  expect(snapshot).toMatchObject({
    schemaVersion: 1,
    version: '0.14.0',
    reviewedAt: '2026-09-09',
    nodeEngine: '>=20.0.0',
    license: 'MIT',
    packs: ['Core', 'SEO'],
    tools: ['Claude Code', 'Codex CLI'],
  });
  expect(snapshot.releases[1]).toEqual({
    version: '0.13.0',
    publishedAt: npm.time['0.13.0'],
    notesDate: '2026-09-07',
    notesSha256: notesHash(changelogEntry(input.changelog, '0.13.0')),
  });
  delete before['website/release.json'];
  delete after['website/release.json'];
  expect(after).toEqual(before);
  expect(getMetadata).toHaveBeenCalledTimes(1);
  await expect(
    runPublicationContent({ mode: 'sync-published', rootDir, getMetadata })
  ).resolves.toMatchObject({ ok: true, changed: false });
});

test.each([
  [
    'wrong npm package',
    (npm) => {
      npm.name = 'another-package';
    },
    /different package/,
  ],
  [
    'unknown npm latest',
    (npm) => {
      delete npm['dist-tags'];
    },
    /npm latest is unknown/,
  ],
  [
    'npm latest has no version record',
    (npm) => {
      delete npm.versions['0.14.0'];
    },
    /npm latest is unknown/,
  ],
  [
    'prerelease latest',
    (npm) => {
      npm['dist-tags'].latest = '0.15.0-beta.1';
    },
    /stable release/,
  ],
  [
    'stale candidate',
    (npm) => {
      npm['dist-tags'].latest = '0.15.0';
      npm.versions['0.15.0'] = { version: '0.15.0' };
    },
    /older than npm latest/,
  ],
  [
    'candidate not yet latest',
    (npm) => {
      npm['dist-tags'].latest = '0.13.0';
    },
    /must equal npm latest/,
  ],
  [
    'published README stale',
    (npm) => {
      npm.readme = 'Unrelated older README';
    },
    /npm README is missing or stale/,
  ],
  [
    'published README absent',
    (npm) => {
      delete npm.readme;
    },
    /npm README is missing or stale/,
  ],
  [
    'README differs only by trailing spaces',
    (npm) => {
      npm.readme += ' ';
    },
    /npm README is missing or stale/,
  ],
  [
    'description differs',
    (npm) => {
      npm.versions['0.14.0'].description = 'Unreviewed description';
    },
    /engines, license or description/,
  ],
  [
    'license differs',
    (npm) => {
      npm.versions['0.14.0'].license = 'UNLICENSED';
    },
    /engines, license or description/,
  ],
  [
    'Node engine differs',
    (npm) => {
      npm.versions['0.14.0'].engines.node = '>=22.0.0';
    },
    /engines, license or description/,
  ],
  [
    'another engine differs',
    (npm) => {
      npm.versions['0.14.0'].engines.npm = '>=11';
    },
    /engines, license or description/,
  ],
  [
    'history is unpublished',
    (npm) => {
      delete npm.versions['0.12.2'];
    },
    /not present in official npm/,
  ],
  [
    'timestamp is missing',
    (npm) => {
      delete npm.time['0.14.0'];
    },
    /real npm publication timestamp/,
  ],
  [
    'timestamp is an invalid date',
    (npm) => {
      npm.time['0.14.0'] = '2026-02-30T10:30:18.001Z';
    },
    /real npm publication timestamp/,
  ],
  [
    'timestamp is only a notes date',
    (npm) => {
      npm.time['0.14.0'] = '2026-09-09';
    },
    /real npm publication timestamp/,
  ],
  [
    'history publication order differs',
    (npm) => {
      npm.time['0.12.2'] = '2026-09-09T12:00:00.000Z';
    },
    /newest first/,
  ],
])('sync refuses %s and leaves every fixture byte intact', async (_name, change, error) => {
  const input = sources();
  const publication = preparePublication(input);
  writeFixture(input, publication.readme);
  const before = fixtureBytes();
  const npm = metadata(publication);
  change(npm);
  await expect(
    runPublicationContent({ mode: 'sync-published', rootDir, getMetadata: async () => npm })
  ).rejects.toThrow(error);
  expect(fixtureBytes()).toEqual(before);
});

test('an unavailable npm registry causes no mutation and does not expose arbitrary error details', async () => {
  const input = sources();
  writeFixture(input, generateReadme(input));
  const before = fixtureBytes();
  const getMetadata = async () => {
    throw new Error('https://token:secret@example.com PRIVATE_TOKEN');
  };
  await expect(
    runPublicationContent({ mode: 'sync-published', rootDir, getMetadata })
  ).rejects.toThrow('Official npm publication could not be verified; no files were changed.');
  expect(fixtureBytes()).toEqual(before);
});

test('an unsupported mode is rejected before reading or writing the source tree', async () => {
  await expect(runPublicationContent({ mode: 'publish-now', rootDir })).rejects.toThrow(
    'Choose exactly one mode'
  );
  expect(fixtureBytes()).toEqual({});
});

test('the official registry reader uses HTTPS, a bounded deadline, no redirects and no credentials', async () => {
  const response = fakeResponse(['{"name":', '"bmad-plus"}']);
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const timeout = jest.spyOn(globalThis.AbortSignal, 'timeout');
  await expect(fetchOfficialMetadata()).resolves.toEqual({ name: 'bmad-plus' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(REGISTRY_URL, {
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: expect.any(globalThis.AbortSignal),
  });
  expect(REGISTRY_URL).toBe('https://registry.npmjs.org/bmad-plus');
  expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  expect(REQUEST_TIMEOUT_MS).toBe(15000);
  expect(response.reader.cancel).toHaveBeenCalledTimes(1);
});

test.each([
  ['HTTP rejection', () => fakeResponse(['PRIVATE_RESPONSE'], { ok: false })],
  ['malformed JSON', () => fakeResponse(['PRIVATE_RESPONSE_NOT_JSON'])],
  [
    'oversized Content-Length',
    () => fakeResponse(['{}'], { length: String(MAX_METADATA_BYTES + 1) }),
  ],
  ['oversized streamed body', () => fakeResponse([Buffer.alloc(MAX_METADATA_BYTES + 1)])],
])('registry reader rejects %s without including remote contents', async (_name, response) => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(response());
  await expect(fetchOfficialMetadata()).rejects.toThrow(
    'Official npm metadata could not be read within the request limits.'
  );
});

test('a registry timeout aborts verification without surfacing the network error', async () => {
  const controller = new globalThis.AbortController();
  jest.spyOn(globalThis.AbortSignal, 'timeout').mockReturnValue(controller.signal);
  jest.spyOn(globalThis, 'fetch').mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('PRIVATE_TIMEOUT_DETAILS')), {
          once: true,
        });
      })
  );
  const pending = fetchOfficialMetadata();
  controller.abort();
  await expect(pending).rejects.toThrow(
    'Official npm metadata could not be read within the request limits.'
  );
});

test('newline normalization changes line endings without hiding other README edits', () => {
  expect(normalizeNewlines('a\r\nb \r\n')).toBe('a\nb \n');
});

test('candidate rendering uses explicit synthetic fixtures and cannot serve as publication evidence', () => {
  const publication = preparePublication(sources());
  const snapshot = syntheticCandidateSnapshot(publication);
  expect(snapshot).toMatchObject({
    schemaVersion: 1,
    version: publication.version,
    syntheticFixtures: true,
    publicationVerified: false,
    deployable: false,
    fixtureNotice: SYNTHETIC_FIXTURE_NOTICE,
  });
  expect(snapshot.releases.map((item) => item.publishedAt)).toEqual([
    '2000-01-03T00:00:00.000Z',
    '2000-01-02T00:00:00.000Z',
    '2000-01-01T00:00:00.000Z',
  ]);
  expect(snapshot.releases[0].notesSha256).toBe(publication.releases[0].notesSha256);
  expect(snapshot.reviewedAt).toBe(publication.reviewedAt);
  expect(CANDIDATE_SITE_URL).toBe('https://bmad-plus-candidate-synthetic.invalid');
});

test('validates the real renderer and search checks in an isolated, nondeployable directory and removes it', () => {
  const input = candidateSources();
  const publication = preparePublication(input);
  writeCandidateFixture(input);
  const before = fixtureBytes();
  let temporary;
  const runner = jest.fn((command, args, options) => {
    const nodeTests = args.includes('--test');
    temporary = options.cwd;
    expect(path.dirname(temporary)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(temporary)).toMatch(/^bmad-candidate-synthetic-/);
    expect(fs.existsSync(path.join(temporary, 'website/dist'))).toBe(nodeTests);
    expect(fs.readdirSync(path.join(temporary, 'website')).sort()).toEqual(
      [...CANDIDATE_WEBSITE_FILES, 'release.json', ...(nodeTests ? ['dist'] : [])].sort()
    );
    for (const file of CANDIDATE_WEBSITE_FILES) {
      expect(fs.readFileSync(path.join(temporary, 'website', file))).toEqual(
        fs.readFileSync(path.join(rootDir, 'website', file))
      );
    }
    expect(fs.readFileSync(path.join(temporary, 'CHANGELOG.md'))).toEqual(
      fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'))
    );
    expect(fs.readFileSync(path.join(temporary, 'package.json'))).toEqual(
      fs.readFileSync(path.join(rootDir, 'package.json'))
    );
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(temporary, 'website/release.json'), 'utf8')
    );
    expect(snapshot.syntheticFixtures).toBe(true);
    expect(options).toMatchObject({
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      shell: false,
      windowsHide: true,
      env: { NODE_OPTIONS: '', NODE_PATH: '', SITE_URL: CANDIDATE_SITE_URL },
    });
    const result = spawnSync(command, args, options);
    expect(result.status).toBe(0);
    expect(
      fs.readFileSync(
        path.join(temporary, 'website/dist/SYNTHETIC-VALIDATION-NEVER-DEPLOY.txt'),
        'utf8'
      )
    ).toContain('SYNTHETIC FIXTURES');
    expect(fs.readFileSync(path.join(temporary, 'website/dist/_headers'), 'utf8')).toContain(
      'X-Robots-Tag: noindex, nofollow'
    );
    return result;
  });
  const result = validateCandidate({ rootDir, publication, runner });
  expect(result).toMatchObject({
    syntheticFixtures: true,
    publicationVerified: false,
    deployable: false,
    artifactsRetained: false,
    pages: 8,
    message: SYNTHETIC_FIXTURE_NOTICE,
  });
  expect(result.releaseChecks).toBeGreaterThan(100);
  expect(result.searchChecks).toBeGreaterThan(100);
  expect(result.websiteTests).toBeGreaterThan(1);
  expect(JSON.stringify(result)).not.toContain('publishedAt');
  expect(JSON.stringify(result)).not.toContain(temporary);
  expect(fs.existsSync(temporary)).toBe(false);
  expect(fixtureBytes()).toEqual(before);
  expect(runner).toHaveBeenCalledTimes(2);
  expect(runner.mock.calls[1][1]).toEqual([
    '--test',
    '--test-reporter=tap',
    ...CANDIDATE_NODE_TEST_FILES.map((file) => path.join('website', file)),
  ]);
});

test('validate-candidate checks every locale and the built site without npm access or source writes', async () => {
  const input = candidateSources();
  writeCandidateFixture(input);
  const before = fixtureBytes();
  const getMetadata = jest.fn();
  await expect(
    runPublicationContent({ mode: 'validate-candidate', rootDir, getMetadata })
  ).resolves.toMatchObject({
    ok: true,
    mode: 'validate-candidate',
    changed: false,
    version: '0.14.0',
    syntheticFixtures: true,
    publicationVerified: false,
    deployable: false,
    artifactsRetained: false,
    pages: 8,
  });
  expect(getMetadata).not.toHaveBeenCalled();
  expect(fixtureBytes()).toEqual(before);
});

test.each([
  [
    'French install command',
    (input) => {
      input.documentation.fr.steps.find((step) => step.id === 'install').code =
        'npx unreviewed-package install';
    },
    /fr: translated shell command install/,
  ],
  [
    'French update command',
    (input) => {
      input.documentation.fr.updateActions[0].code = 'npx bmad-plus an-unreviewed-command';
    },
    /fr: update command/,
  ],
  [
    'Spanish legacy command',
    (input) => {
      input.documentation.es.legacyCode = 'npx bmad-plus destructive-update';
    },
    /es: legacyCode/,
  ],
  [
    'German command type',
    (input) => {
      const step = input.documentation.de.steps.find((item) => item.id === 'install');
      step.type = 'assistant';
      step.code = 'npx unreviewed-package install';
    },
    /de: translated command type or code/,
  ],
])(
  'candidate validation refuses altered %s and removes all synthetic artifacts',
  async (_name, change, error) => {
    const input = candidateSources();
    change(input);
    writeCandidateFixture(input);
    const before = fixtureBytes();
    const mkdir = jest.spyOn(fs, 'mkdtempSync');
    const getMetadata = jest.fn();
    await expect(
      runPublicationContent({ mode: 'validate-candidate', rootDir, getMetadata })
    ).rejects.toThrow(error);
    const temporary = mkdir.mock.results.find(
      (result) =>
        typeof result.value === 'string' &&
        path.basename(result.value).startsWith('bmad-candidate-synthetic-')
    )?.value;
    expect(temporary).toBeTruthy();
    expect(fs.existsSync(temporary)).toBe(false);
    expect(fixtureBytes()).toEqual(before);
    expect(getMetadata).not.toHaveBeenCalled();
  }
);

test('a real rendering failure also removes the temporary candidate tree and preserves the original build', async () => {
  const input = candidateSources();
  writeCandidateFixture(input);
  fs.appendFileSync(
    path.join(rootDir, 'website/build.js'),
    '\nthrow new Error("Controlled fixture renderer failure");\n'
  );
  const before = fixtureBytes();
  const mkdir = jest.spyOn(fs, 'mkdtempSync');
  await expect(runPublicationContent({ mode: 'validate-candidate', rootDir })).rejects.toThrow(
    'Controlled fixture renderer failure'
  );
  const temporary = mkdir.mock.results[0].value;
  expect(fs.existsSync(temporary)).toBe(false);
  expect(fixtureBytes()).toEqual(before);
});

test('a failed validation process cannot leave candidate fixtures behind', () => {
  const input = candidateSources();
  writeCandidateFixture(input);
  const before = fixtureBytes();
  let temporary;
  const runner = (_command, _args, options) => {
    temporary = options.cwd;
    return { stdout: '{}', status: null, error: { code: 'ETIMEDOUT' }, signal: 'SIGKILL' };
  };
  expect(() =>
    validateCandidate({ rootDir, publication: preparePublication(input), runner })
  ).toThrow('within the process limits');
  expect(fs.existsSync(temporary)).toBe(false);
  expect(fixtureBytes()).toEqual(before);
});

test.each(['check-release.test.js', 'check-search.test.js'])(
  'a failure in %s blocks publication and hides captured test output',
  async (file) => {
    const input = candidateSources();
    writeCandidateFixture(input);
    fs.appendFileSync(
      path.join(rootDir, 'website', file),
      '\nrequire("node:test")("Synthetic fixture failure", () => { throw new Error("PRIVATE_NODE_TEST_OUTPUT"); });\n'
    );
    const before = fixtureBytes();
    const mkdir = jest.spyOn(fs, 'mkdtempSync');
    let failure;
    try {
      await runPublicationContent({ mode: 'validate-candidate', rootDir });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toContain('Candidate website Node tests failed before publication');
    expect(failure.message).not.toContain('PRIVATE_NODE_TEST_OUTPUT');
    expect(fs.existsSync(mkdir.mock.results[0].value)).toBe(false);
    expect(fixtureBytes()).toEqual(before);
  }
);

test('verify-unpublished passes only while the candidate has no npm version record', async () => {
  const input = sources();
  const publication = preparePublication(input);
  writeFixture(input, publication.readme);
  const before = fixtureBytes();
  const npm = metadata(publication);
  npm['dist-tags'].latest = '0.13.0';
  delete npm.versions['0.14.0'];
  delete npm.time['0.14.0'];
  const getMetadata = jest.fn(async () => npm);
  await expect(
    runPublicationContent({ mode: 'verify-unpublished', rootDir, getMetadata })
  ).resolves.toMatchObject({
    ok: true,
    changed: false,
    candidateUnpublished: true,
    latestVersion: '0.13.0',
    verifiedVersions: ['0.13.0', '0.12.2'],
  });
  expect(getMetadata).toHaveBeenCalledTimes(1);
  expect(fixtureBytes()).toEqual(before);
});

test.each(['0.13.0', '0.14.0', '0.15.0'])(
  'verify-unpublished refuses existing candidates when npm latest is %s',
  async (latest) => {
    const input = sources();
    const publication = preparePublication(input);
    writeFixture(input, publication.readme);
    const before = fixtureBytes();
    const npm = metadata(publication);
    npm['dist-tags'].latest = latest;
    npm.versions[latest] ||= { version: latest };
    await expect(
      runPublicationContent({ mode: 'verify-unpublished', rootDir, getMetadata: async () => npm })
    ).rejects.toThrow('already published on npm. Use landing_only recovery');
    expect(fixtureBytes()).toEqual(before);
    try {
      verifyUnpublished({ publication, metadata: npm });
    } catch (error) {
      expect(error).toMatchObject({ code: 'ALREADY_PUBLISHED', recovery: 'landing_only' });
    }
  }
);
