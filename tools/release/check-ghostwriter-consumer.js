/** Install the exact release archive in a fresh npm consumer and exercise Ghostwriter. */
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verify } = require('./supply-chain');
const { runNpm } = require('../cli/lib/npm-runner');

const repository = path.resolve(__dirname, '../..');
const pack = '.agents/skills/pack-ghostwriter';
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (root, file) => JSON.parse(read(root, file));
const seats = [
  'three-act',
  'hero-journey',
  'freytag-pyramid',
  'story-circle',
  'kishotenketsu',
  'in-medias-res',
  'snowflake-method',
  'story-spine',
  'narrative-arc',
];

function verifyArchiveEntries(entries) {
  const internal =
    /^(?:audit|docs|monitor|mcp-server|brainstorm-laurent|recettes|website|secrets|\.credentials|\.agents|\.git|\.github|\.bmad-plus|_bmad-output)(?:\/|$)/;
  const privateDocuments =
    /(?:^|\/)(?:README-GOLDEN|BMAD_PLUS_GHOSTWRITER_PACK_SPEC|humanizers-et-filigranes)\.md$/i;
  for (const entry of entries) {
    assert(entry.startsWith('package/'), 'Unexpected archive member: ' + entry);
    const file = entry.slice('package/'.length);
    assert(
      !file.includes('\\') && !file.split('/').includes('..'),
      'Invalid archive member: ' + entry
    );
    assert(
      !internal.test(file) && !privateDocuments.test(file),
      'Maintainer file in archive: ' + file
    );
  }
}

function verifyInstalledResources(project, packageRoot, manifest) {
  const required = json(project, pack + '/shared/catalog.json').workflows;
  assert.deepEqual(required.map((item) => item.id).sort(), [
    'agent-output-review',
    'draft',
    'humanize',
    'improve',
    'localize',
    'voice-profile',
  ]);
  const check = (target, source) => {
    assert(
      Object.hasOwn(manifest.fileInventory.files, target),
      'Unowned installed resource: ' + target
    );
    const expected = fs.readFileSync(path.join(packageRoot, 'src/bmad-plus', source));
    assert(expected.length > 0, 'Empty shipped resource: ' + source);
    assert.deepEqual(fs.readFileSync(path.join(project, target)), expected, target);
  };
  for (const { skill, path: workflow } of required) {
    check('.agents/skills/' + skill + '/SKILL.md', 'skills/' + skill + '/SKILL.md');
    check(pack + '/' + workflow, 'packs/pack-ghostwriter/' + workflow);
  }
  assert.deepEqual(
    required.map((item) => item.skill).sort(),
    ['edit', 'humanize', 'localize', 'verify', 'voice', 'write'].map((id) => 'ghostwriter-' + id)
  );
  const jury = json(project, pack + '/workshops/council/jury.json');
  assert.deepEqual(jury.units.list.map((card) => card.id).sort(), [...seats].sort());
  const files = [
    ...seats.flatMap((id) =>
      ['README.md', 'specialist.md'].map((name) => 'workshops/' + id + '/' + name)
    ),
    ...['en', 'fr-FR', 'pt-BR', 'glossary'].map((id) => 'languages/' + id + '.md'),
    ...['config', 'run-manifest', 'voice-profile', 'review-result'].map(
      (id) => 'schemas/' + id + '.schema.json'
    ),
    'workshops/council/README.md',
    'workshops/council/select.cjs',
    'workshops/council/check.cjs',
    'tools/inspect-typography.cjs',
    'intake.yaml',
    'SKILL.md',
    'ghostwriter.md',
    'profiles/service-report-en.yaml',
  ];
  for (const file of files) check(pack + '/' + file, 'packs/pack-ghostwriter/' + file);
}

async function checkConsumer(out) {
  const artifact = verify({ cwd: repository, out });
  const archive = path.join(out, artifact.archive.filename);
  const members = execFileSync('tar', ['-tzf', artifact.archive.filename], {
    cwd: out,
    encoding: 'utf8',
  });
  verifyArchiveEntries(members.trim().split(/\r?\n/));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-ghostwriter-consumer-'));
  try {
    const project = path.join(temp, 'project');
    const brain = path.join(temp, 'brain');
    fs.mkdirSync(project);
    fs.mkdirSync(brain);
    fs.writeFileSync(
      path.join(project, 'package.json'),
      '{"name":"ghostwriter-consumer","private":true}\n'
    );
    const env = {
      PATH: process.env.PATH,
      HOME: temp,
      USERPROFILE: temp,
      BMAD_PLUS_BRAIN: brain,
      NO_COLOR: '1',
    };
    for (const key of ['SystemRoot', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'npm_execpath']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    await runNpm(
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=true',
        '--registry=https://registry.npmjs.org',
        archive,
      ],
      { cwd: project, env, timeout: 120000 }
    );
    const locked = json(project, 'package-lock.json').packages['node_modules/bmad-plus'];
    assert.equal(locked.integrity, artifact.archive.integrity);
    const packageRoot = path.join(project, 'node_modules/bmad-plus');
    const pkg = json(packageRoot, 'package.json');
    assert.equal(pkg.version, artifact.version);
    const publicReadme = fs.existsSync(path.join(repository, 'README-DIST.md'))
      ? 'README-DIST.md'
      : 'README.md';
    assert.equal(
      read(packageRoot, 'README.md').replace(/\r\n/g, '\n'),
      read(repository, publicReadme).replace(/\r\n/g, '\n'),
      'Archive README differs from the reviewed public README'
    );
    const node = (args) =>
      execFileSync(process.execPath, args, { cwd: project, env, encoding: 'utf8', timeout: 60000 });
    const cli = (args) =>
      node([path.join(packageRoot, pkg.bin['bmad-plus']), ...args, '--directory', project]);
    const install = () =>
      cli(['install', '--yes', '--lang', 'en', '--packs', 'ghostwriter', '--tools', 'codex-cli']);
    install();
    const manifest = json(project, '_bmad/.bmad-plus-install.json');
    assert.deepEqual(manifest.packs, ['core', 'ghostwriter']);
    assert.equal(JSON.parse(cli(['doctor', '--json'])).summary.errors, 0);
    verifyInstalledResources(project, packageRoot, manifest);
    const french = '12\u202f€ et un mot\u200bcollé';
    fs.writeFileSync(path.join(project, 'sample.txt'), french);
    const typography = JSON.parse(
      node([path.join(project, pack, 'tools/inspect-typography.cjs'), 'sample.txt'])
    );
    assert.deepEqual(
      typography.entries.map(({ codePoint, classification }) => [codePoint, classification]),
      [
        ['U+202F', 'preserve'],
        ['U+200B', 'review'],
      ]
    );
    assert.equal(read(project, 'sample.txt'), french, 'Inspection modified the document');
    const selected = JSON.parse(
      node([path.join(project, pack, 'workshops/council/select.cjs'), ...seats])
    );
    assert.deepEqual(
      json(project, selected.definition).units.list.map((card) => card.id),
      seats
    );
    const profile = '.bmad-plus/ghostwriter/profiles/support.yaml';
    const custom =
      read(project, pack + '/profiles/service-report-en.yaml').replace(
        /^version: 1$/m,
        'version: 2'
      ) + '\n# Editorial preference of the consumer project\n';
    fs.mkdirSync(path.dirname(path.join(project, profile)), { recursive: true });
    fs.writeFileSync(path.join(project, profile), custom);
    install();
    assert.equal(read(project, profile), custom, 'Reinstallation replaced the customized profile');
    cli(['uninstall', '--yes']);
    assert.equal(read(project, profile), custom, 'Uninstall removed the customized profile');
    assert(!fs.existsSync(path.join(project, pack, 'SKILL.md')));
    console.log(
      `OK: bmad-plus@${pkg.version}, archive SHA-256 ${artifact.archive.sha256}, Ghostwriter consumer install, doctor, council, profile retention and uninstall.`
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
  }
}

if (require.main === module) {
  if (process.argv.length !== 3) {
    console.error(
      'Usage: node tools/release/check-ghostwriter-consumer.js <release-artifact-directory>'
    );
    process.exitCode = 2;
  } else {
    checkConsumer(path.resolve(process.argv[2])).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { verifyArchiveEntries };
