/**
 * BMAD+ design pack — Atelier arrives as a referenced package, not a copy.
 *
 * The pack's three skills (design, design-review, redesign) are the files of the
 * pinned npm dependency `design-skill`; the installer copies them into
 * .agents/skills/<id>/ and the persona shipped here drives them. These tests fail
 * when the registry, package.json and the installed dependency disagree, when a
 * declared skill has no SKILL.md in the dependency, when the persona or the
 * dispatcher stop naming the skills they route into, when the intake no longer
 * passes the contract, or when the triggers name a persona the pack does not have.
 *
 * Run: npx jest tests/unit/design-pack-shipping.test.js --coverage=false
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { validateIntake, listQuestions } = require('../../tools/build/intake-contract');
const { PACKS, DERIVED } = require('../../tools/cli/lib/packs');

const REPO = path.join(__dirname, '..', '..');
const PACK = path.join(REPO, 'src', 'bmad-plus', 'packs', 'pack-design');
const registry = yaml.load(fs.readFileSync(path.join(REPO, 'registry.yaml'), 'utf8'));
const pack = registry.packs.design;
const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
const SKILLS = ['design', 'design-review', 'redesign'];

describe('the design pack takes its skills from the pinned design-skill dependency', () => {
  test('registry, package.json and the egress doctrine agree on the module', () => {
    expect(pack.external_module).toEqual({
      package: 'design-skill',
      version: '0.2.1',
      skills: SKILLS,
    });
    expect(pkg.dependencies['design-skill']).toBe(pack.external_module.version);
    expect(registry.data_handling.runtime_dependencies).toContain('design-skill');
    expect(pack.skills).toEqual([]);
    expect(PACKS.design.externalModule).toEqual(pack.external_module);
  });

  test('the installed dependency is the declared version and ships every declared skill', () => {
    const manifestPath = require.resolve('design-skill/package.json', { paths: [REPO] });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toBe('design-skill');
    expect(manifest.version).toBe(pack.external_module.version);
    const moduleRoot = path.dirname(manifestPath);
    for (const id of SKILLS) {
      expect(fs.statSync(path.join(moduleRoot, 'skills', id, 'SKILL.md')).isFile()).toBe(true);
    }
    // The router loads reference modules and presets on demand; the copy must carry them.
    const references = path.join(moduleRoot, 'skills', 'design', 'references');
    expect(
      fs.readdirSync(references).filter((name) => name.endsWith('.md')).length
    ).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(references, 'presets'))).toBe(true);
  });

  test('no Atelier skill is duplicated inside the BMAD+ tree', () => {
    for (const id of SKILLS) {
      expect(fs.existsSync(path.join(PACK, id))).toBe(false);
      expect(fs.existsSync(path.join(REPO, 'src', 'bmad-plus', 'skills', id))).toBe(false);
    }
  });

  test('the installed layout requires the persona, the dispatcher, the intake and each skill', () => {
    expect(DERIVED.packs.design.requiredResources).toEqual([
      '.agents/skills/pack-design/design-engine.md',
      '.agents/skills/design/SKILL.md',
      '.agents/skills/design-review/SKILL.md',
      '.agents/skills/redesign/SKILL.md',
      '.agents/skills/pack-design/SKILL.md',
      '.agents/skills/pack-design/intake.yaml',
    ]);
  });
});

describe('the persona and the dispatcher route into the installed skills', () => {
  const persona = fs.readFileSync(path.join(PACK, 'design-engine.md'), 'utf8');
  const dispatcher = fs.readFileSync(path.join(PACK, 'SKILL.md'), 'utf8');

  test.each(SKILLS)('both name .agents/skills/%s/SKILL.md', (id) => {
    const installed = `.agents/skills/${id}/SKILL.md`;
    expect(persona).toContain(installed);
    expect(dispatcher).toContain(installed);
  });

  test('the persona runs the intake before design work and refuses to improvise rules', () => {
    expect(persona).toMatch(/bmad-plus-intake/);
    expect(persona).toContain('.agents/skills/pack-design/intake.yaml');
    expect(persona).toMatch(/do not improvise design rules/i);
    // The persona quotes the skill's delivery checklist; it does not restate its rules.
    expect(persona).toMatch(/delivery checklist/i);
    expect(persona).not.toMatch(/WCAG|OKLCH|contrast ratio/);
  });

  test('the dispatcher carries the five commands and the missing-installation rule', () => {
    expect(dispatcher).toMatch(/^name: design-engine$/m);
    expect(dispatcher).toMatch(/^description: >/m);
    for (const command of [
      '/design read',
      '/design build <surface>',
      '/design review <path or url>',
      '/design redesign',
      '/design tokens',
    ]) {
      expect(dispatcher).toContain(command);
    }
    expect(dispatcher).toMatch(/## Missing installation/);
    expect(dispatcher).toMatch(/bmad-plus doctor/);
  });

  test('the persona is the registry persona that drives the three skills', () => {
    expect(pack.agents).toEqual(['design-engine']);
    expect(pack.doctor.pack_agents).toEqual(['design-engine.md']);
    expect(pack.personas).toEqual([
      expect.objectContaining({ id: 'design-engine', name: 'Atelier', uses_skills: SKILLS }),
    ]);
    const manifest = yaml.load(
      fs.readFileSync(path.join(PACK, 'bmad-skill-manifest.yaml'), 'utf8')
    );
    expect(manifest).toMatchObject({ type: 'pack', pack: 'design', module: 'bmad-plus' });
  });
});

describe('the design read is a valid intake', () => {
  const intake = yaml.load(fs.readFileSync(path.join(PACK, pack.intake), 'utf8'), {
    schema: yaml.JSON_SCHEMA,
  });

  test('passes the contract and belongs to the pack', () => {
    expect(validateIntake(intake)).toEqual({ ok: true, problems: [] });
    expect(intake).toMatchObject({ id: 'design-read', pack: 'design', language: 'user' });
    expect(PACKS.design.intake).toBe('intake.yaml');
  });

  test('must-haves carry a risk and no default; the dials and the stack carry no default either', () => {
    const questions = listQuestions(intake);
    const mustHaves = questions.filter((question) => question.must_have === true);
    expect(mustHaves.map((question) => question.id)).toEqual(['surface_kind', 'audience', 'job']);
    for (const question of mustHaves) {
      expect(question.risk_if_unknown).toEqual(expect.any(String));
      expect('default' in question).toBe(false);
    }
    const defaults = Object.fromEntries(
      questions.filter((q) => 'default' in q).map((q) => [q.id, q.default])
    );
    expect(defaults).toEqual({
      design_system: 'none',
      aesthetic_family: 'none',
      accessibility_target: 'AA',
      languages: 'one language, LTR',
    });
    // A dial the user does not set is inferred by the router from the surface, not
    // proposed by the intake; the stack is read from the project.
    for (const id of ['variance', 'motion', 'density']) {
      const dial = questions.find((question) => question.id === id);
      expect(dial).toMatchObject({ kind: 'number', min: 1, max: 10 });
      expect('default' in dial).toBe(false);
      expect(dial.must_have).not.toBe(true);
    }
    expect('default' in questions.find((question) => question.id === 'stack')).toBe(false);
    for (const question of questions) {
      expect(question.feeds.every((feed) => feed.startsWith('brief.md#'))).toBe(true);
    }
  });
});

describe('the triggers reference the pack persona', () => {
  test('design.default_role is the persona and its patterns cover build, review and redesign', () => {
    const triggers = yaml.load(
      fs.readFileSync(path.join(REPO, 'src', 'bmad-plus', 'data', 'role-triggers.yaml'), 'utf8'),
      { schema: yaml.JSON_SCHEMA }
    );
    expect(triggers.design.default_role).toBe('design-engine');
    expect(Object.keys(triggers.design.auto_triggers)).toEqual(['design-engine']);
    const { patterns, contexts, reasoning } = triggers.design.auto_triggers['design-engine'];
    expect(patterns).toEqual(
      expect.arrayContaining(['Atelier', '/design', 'accessibility', 'redesign', 'design tokens'])
    );
    // Bare words that Forge's architect role and Sentinel's UX review already claim stay out.
    for (const shared of ['design', 'UI', 'UX', 'interface', 'dashboard']) {
      expect(patterns).not.toContain(shared);
    }
    expect(contexts).toEqual(
      expect.arrayContaining(['frontend_changes', 'new_page', 'design_tokens_missing'])
    );
    expect(reasoning).toEqual(['ui_looks_generic', 'accessibility_unverified']);
  });
});
