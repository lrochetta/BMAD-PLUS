/**
 * BMAD+ shipped instructions must name things that exist.
 *
 * Four classes of drift found in 0.23.0, each pinned here:
 *  - the installer flag is `--packs`, never `--pack`;
 *  - the "how to start" guide printed by the installer only shows slash commands that the
 *    pack's own files define (no `/seo audit`, `/backup create`, `/animated build`);
 *  - the Animated pack does not tell the user to run a script it does not ship, and loads
 *    fonts from a third party only as an explicit choice for the generated site;
 *  - Maker's integration guide is registry-first, not "edit module.yaml and install.js".
 *
 * Run: npx jest tests/unit/shipped-instructions.test.js --coverage=false
 */

const fs = require('node:fs');
const path = require('node:path');
const { LANGUAGES } = require('../../tools/cli/i18n');

const REPO = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(REPO, ...parts), 'utf8');

function markdownFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(full));
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

describe('installer flag', () => {
  test('no shipped markdown or installer help says `install --pack`', () => {
    const offenders = markdownFiles(path.join(REPO, 'src', 'bmad-plus'))
      .filter((file) => /bmad-plus install[^\n]*--pack(?![s-])/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(REPO, file));
    expect(offenders).toEqual([]);
  });

  test('the install command really declares --packs', () => {
    expect(read('tools', 'cli', 'commands', 'install.js')).toMatch(/--packs <packs>/);
  });
});

describe('installer getting-started guide', () => {
  const installSource = read('tools', 'cli', 'commands', 'install.js');
  const guideStrings = [
    installSource,
    ...Object.values(LANGUAGES).flatMap((lang) =>
      Object.entries(lang)
        .filter(([key]) => key.startsWith('guide_'))
        .map(([, value]) => String(value))
    ),
  ].join('\n');

  test('every /seo subcommand shown is routed by the SEO skill', () => {
    const routed = new Set(
      [
        ...read('src', 'bmad-plus', 'packs', 'pack-seo', 'SKILL.md').matchAll(/`\/seo ([a-z]+)/g),
      ].map((match) => match[1])
    );
    const shown = [...guideStrings.matchAll(/\/seo ([a-z]+)/g)].map((match) => match[1]);
    expect(shown.length).toBeGreaterThan(0);
    for (const sub of shown) expect(routed).toContain(sub);
  });

  test('/backup is shown without a made-up subcommand', () => {
    const agent = read('src', 'bmad-plus', 'packs', 'pack-backup', 'backup-agent.md');
    expect(agent).toMatch(/`\/backup` —/);
    expect(guideStrings).not.toMatch(/\/backup create/);
    expect(guideStrings).toMatch(/"\/backup"/);
  });

  test('no /animated slash command is advertised: the pack activates by phrase', () => {
    expect(guideStrings).not.toMatch(/\/animated\b/);
    const agent = read('src', 'bmad-plus', 'packs', 'pack-animated', 'animated-website-agent.md');
    expect(agent).toContain('"animated website"');
    expect(guideStrings).toContain('animated website from');
  });
});

describe('Animated pack', () => {
  const packDir = path.join(REPO, 'src', 'bmad-plus', 'packs', 'pack-animated');
  const files = markdownFiles(packDir);

  test('every scripts/*.py it tells the user to run is shipped in the pack', () => {
    for (const file of files) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/scripts\/([A-Za-z0-9_]+\.py)/g)) {
        expect(fs.existsSync(path.join(packDir, 'scripts', match[1]))).toBe(true);
      }
    }
  });

  test('frames are extracted with FFmpeg commands that produce the folders the site reads', () => {
    const agent = fs.readFileSync(path.join(packDir, 'animated-website-agent.md'), 'utf8');
    expect(agent).toMatch(/-c:v libwebp/);
    expect(agent).toContain('frames/desktop/frame-%04d.webp');
    expect(agent).toContain('frames/mobile/frame-%04d.webp');
  });

  test('Google Fonts is an explicit, disclosed choice and not the default', () => {
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes('fonts.googleapis.com')) continue;
      expect(text).toMatch(/\*\*Polices système \(défaut\)/);
      expect(text).toMatch(/sur demande explicite/);
      expect(text).toMatch(/BMAD\+ lui-même n'envoie rien à Google/);
    }
    const workflow = fs.readFileSync(
      path.join(packDir, 'templates', 'animated-website-workflow.md'),
      'utf8'
    );
    expect(workflow).toMatch(/system fonts by default/i);
    expect(workflow).not.toContain('fonts.googleapis.com');
  });
});

describe('Maker integration guide', () => {
  const skill = read('src', 'bmad-plus', 'agents', 'agent-maker', 'SKILL.md');

  test('is registry-first and names the real regeneration commands', () => {
    expect(skill).toContain('`registry.yaml`');
    expect(skill).toContain('npm run build');
    expect(skill).toContain('generate-adapters.js --adopt');
    expect(skill).toContain('npm run build:check');
    for (const script of ['build', 'build:check', 'check:counts', 'check:triggers']) {
      expect(require('../../package.json').scripts).toHaveProperty(script);
    }
  });

  test('no longer sends the integrator to hand-edit generated files', () => {
    expect(skill).not.toMatch(/Add pack to `PACKS` object/);
    expect(skill).not.toMatch(/snippet for `module\.yaml`/);
    expect(skill).not.toMatch(/to the `packs:` section\./);
  });
});

describe('Zecher scan workflow', () => {
  test('states the depth that `bmad-plus scan` really defaults to', () => {
    const scan = require('../../tools/cli/commands/scan');
    const depth = scan.options.find(([flag]) => flag.startsWith('--depth'));
    const declared = Number(depth[2]);
    expect(depth[1]).toContain(`default: ${declared}`);
    const text = read('src', 'bmad-plus', 'packs', 'pack-memory', 'zecher-agent.md');
    const stated = text.match(/Depth limit:[^\n]*\(default (\d+) levels/);
    expect(stated).not.toBeNull();
    expect(Number(stated[1])).toBe(declared);
  });
});

describe('OSINT instructions', () => {
  const osintRoot = path.join(REPO, 'osint-agent-package');
  const scriptsDir = path.join(osintRoot, 'skills', 'bmad-osint-investigate', 'osint', 'scripts');
  const instructionFiles = [
    ['agents', 'osint-investigator.md'],
    ['skills', 'bmad-osint-investigate', 'osint', 'SKILL.md'],
    ['skills', 'bmad-osint-investigate', 'osint', 'references', 'tools.md'],
    ['skills', 'bmad-osint-investigate', 'osint', 'references', 'platforms.md'],
    ['skills', 'bmad-osint-investigate', 'osint', 'references', 'content-extraction.md'],
  ].map((parts) => fs.readFileSync(path.join(osintRoot, ...parts), 'utf8'));

  test('the shipped scripts are Python, so no instruction calls a .sh wrapper', () => {
    expect(fs.readdirSync(scriptsDir).some((file) => file.endsWith('.sh'))).toBe(false);
    for (const text of instructionFiles) expect(text).not.toMatch(/\b[a-z-]+\.sh\b/);
  });

  test('every script an instruction names is shipped', () => {
    const shipped = new Set(fs.readdirSync(scriptsDir));
    for (const text of instructionFiles) {
      for (const match of text.matchAll(/\b([a-z_-]+\.py)\b/g)) {
        if (match[1] === 'tg.py') continue; // the user's own Telegram skill, not in this package
        expect(shipped).toContain(match[1]);
      }
    }
  });

  test('the registry agrees with the code: no single key is required, every key read is listed', () => {
    const osint = require('../../tools/build/generate').loadRegistry().packs.osint;
    expect(osint.required_keys).toBeUndefined();
    const keysRead = new Set();
    for (const file of fs.readdirSync(scriptsDir).filter((name) => name.endsWith('.py'))) {
      const text = fs.readFileSync(path.join(scriptsDir, file), 'utf8');
      for (const match of text.matchAll(
        /(?:get_key|environ\.get)\(\s*"([A-Z_]+_(?:KEY|TOKEN|URL))"/g
      ))
        keysRead.add(match[1]);
    }
    expect(keysRead.size).toBeGreaterThan(5);
    keysRead.delete('APIFY_TOKEN'); // apify.py accepts it as an alias of APIFY_API_TOKEN
    for (const key of keysRead) expect(osint.optional_keys).toContain(key);
    expect(fs.readFileSync(path.join(osintRoot, 'SETUP_KEYS.md'), 'utf8')).toMatch(/UNE SEULE clé/);
  });
});

describe('Shield framework statements', () => {
  const gen = require('../../tools/build/generate');
  const shieldDir = path.join(REPO, 'src', 'bmad-plus', 'packs', 'pack-shield');

  test('the registry tags one framework per specialist agent file', () => {
    const shield = gen.loadRegistry().packs.shield;
    const agentFiles = markdownFiles(path.join(shieldDir, 'categories')).filter((file) =>
      file.endsWith('-agent.md')
    );
    expect(agentFiles).toHaveLength(
      shield.categories.flatMap((category) => category.agents).length
    );
    expect(shield.compliance_tags).toHaveLength(agentFiles.length);
    expect(shield.compliance_tags).toContain('DPDPA');
  });

  test('the skill and the orchestrator state the derived framework count', () => {
    const derived = gen.buildDerived(gen.loadRegistry()).packs.shield;
    for (const file of ['SKILL.md', 'shield-orchestrator.md']) {
      const text = fs.readFileSync(path.join(shieldDir, file), 'utf8');
      const stated = [...text.matchAll(/(\d+)\+? (?:regulatory|compliance) frameworks/g)];
      expect(stated.length).toBeGreaterThan(0);
      for (const match of stated) expect(Number(match[1])).toBe(derived.frameworkCount);
    }
  });
});
