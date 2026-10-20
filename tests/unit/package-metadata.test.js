/**
 * npm page metadata and README credits stay true to the registry.
 *
 * The npm page shows package.json `description` and `keywords`, and the README footer
 * (Credits). None of them is generated from the registry, so this file ties them to it:
 * the pack count, the adapter list and every pack name must agree, and the credits in
 * the four READMEs must name every pack and keep the provenance classes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadRegistry } = require('../../tools/build/generate');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const registry = loadRegistry();
const packs = Object.values(registry.packs).sort((a, b) => a.order - b.order);
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const word = (n) => NUMBER_WORDS[n];

describe('package.json description and keywords', () => {
  test('the description is short, factual and agrees with the registry counts', () => {
    expect(pkg.description.length).toBeLessThanOrEqual(200);
    expect(pkg.description.toLowerCase()).toContain(`${word(packs.length)} packs`);
    expect(pkg.description).toContain(
      `adapters for ${word(registry.targets.adapters.length)} AI coding tools`
    );
    for (const phrase of ['ask-first intake', 'swarms', 'safe updates']) {
      expect(pkg.description).toContain(phrase);
    }
  });

  test('every named domain in the description belongs to a registry pack', () => {
    const names = packs.map((pack) => `${pack.display_name} ${pack.summary || ''}`).join(' ');
    expect(names).toMatch(/Design/);
    expect(names).toMatch(/SEO/);
    expect(names).toMatch(/GRC/);
    expect(names).toMatch(/OSINT/);
    expect(names).toMatch(/Memory|memory/);
  });

  test('keywords are unique lowercase tokens, specific and bounded', () => {
    expect(pkg.keywords.length).toBeGreaterThanOrEqual(15);
    expect(pkg.keywords.length).toBeLessThanOrEqual(30);
    expect(new Set(pkg.keywords).size).toBe(pkg.keywords.length);
    for (const keyword of pkg.keywords) expect(keyword).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test('every registry adapter tool is a keyword, and so are the headline capabilities', () => {
    for (const adapter of registry.targets.adapters) expect(pkg.keywords).toContain(adapter.tool);
    for (const keyword of [
      'bmad',
      'multi-agent',
      'agents-md',
      'swarm',
      'intake',
      'design-system',
      'seo',
      'grc',
      'osint',
      'memory',
      'nexus',
    ]) {
      expect(pkg.keywords).toContain(keyword);
    }
  });

  test('the generated npm README opens with the same description', () => {
    expect(read('README-DIST.md')).toContain(`\n${pkg.description}\n`);
  });
});

describe('README credits ledger', () => {
  const files = {
    en: 'README.md',
    fr: 'readme-international/README.fr.md',
    es: 'readme-international/README.es.md',
    de: 'readme-international/README.de.md',
  };
  const credits = (file) => {
    const text = read(file);
    return text.slice(text.search(/^### (Credits|Crédits|Créditos|Danksagung)\s*$/m));
  };

  test.each(Object.entries(files))('%s credits name every registry pack', (_locale, file) => {
    const section = credits(file);
    for (const pack of packs) expect(section).toContain(pack.cli.name);
  });

  test.each(Object.entries(files))(
    '%s credits keep the author, the external sources and the owned package',
    (_locale, file) => {
      const section = credits(file);
      for (const needle of [
        'https://github.com/lrochetta',
        'https://github.com/lrochetta/design-skill',
        'https://github.com/bmad-code-org/BMAD-METHOD',
        'https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance',
        'https://github.com/smixs/osint-skill',
        'https://github.com/apify/agent-skills',
        'https://github.com/multica-ai/andrej-karpathy-skills',
        'Atelier',
        'Lawve.ai',
      ]) {
        expect(section).toContain(needle);
      }
    }
  );

  test('the four credit sections have the same structure', () => {
    const shape = (file) =>
      credits(file)
        .split('\n')
        .map((line) => (/^\*\*/.test(line) ? 'group' : /^- /.test(line) ? 'item' : ''))
        .filter(Boolean)
        .join(',');
    const reference = shape(files.en);
    for (const file of Object.values(files)) expect(shape(file)).toBe(reference);
  });

  test('the generated npm README carries the source credits unchanged', () => {
    expect(read('README-DIST.md').endsWith(`${credits(files.en).trimEnd()}\n`)).toBe(true);
  });
});
