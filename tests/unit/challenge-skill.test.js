/** The challenge skill: its contract, the agents that open it, and the phrases that trigger it. */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const gen = require('../../tools/build/generate');
const triggers = require('../../tools/build/check-triggers');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const SKILL = 'src/bmad-plus/skills/bmad-plus-challenge/SKILL.md';
const registry = gen.loadRegistry();

// Every persona that drives the skill, with the file that carries its "When to challenge".
const DRIVERS = {
  'core/agent-strategist': 'src/bmad-plus/agents/agent-strategist/SKILL.md',
  'core/agent-architect-dev': 'src/bmad-plus/agents/agent-architect-dev/SKILL.md',
  'core/agent-quality': 'src/bmad-plus/agents/agent-quality/SKILL.md',
  'core/agent-orchestrator': 'src/bmad-plus/agents/agent-orchestrator/SKILL.md',
  'maker/agent-maker': 'src/bmad-plus/agents/agent-maker/SKILL.md',
  'shield/shield-orchestrator': 'src/bmad-plus/packs/pack-shield/shield-orchestrator.md',
  'seo/seo-chief': 'src/bmad-plus/packs/pack-seo/seo-chief.md',
  'dev-studio/analyst-agent':
    'src/bmad-plus/packs/pack-dev-studio/categories/analysis/analyst-agent.md',
  'dev-studio/pm-agent': 'src/bmad-plus/packs/pack-dev-studio/categories/planning/pm-agent.md',
  'dev-studio/architect-agent':
    'src/bmad-plus/packs/pack-dev-studio/categories/architecture/architect-agent.md',
};

describe('the skill file', () => {
  const text = read(SKILL);
  const [, front] = text.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = yaml.load(front);

  test('is named after its folder and lists its trigger phrases in the description', () => {
    expect(meta.name).toBe('bmad-plus-challenge');
    for (const phrase of [
      'stress-test',
      'challenge my plan',
      'poke holes',
      'grill the plan',
      'challenge mon plan',
      'critique mon plan',
      'trouve les failles',
    ]) {
      expect(meta.description).toContain(`"${phrase}"`);
    }
  });

  test('states the rules the protocol stands on', () => {
    const flat = text.replace(/\s+/g, ' ');
    for (const rule of [
      'at most 6',
      'Never put a question in a round while a prerequisite of it is still open',
      'a bare "yes" accepts it',
      '`answered`',
      '`defaulted`',
      '`unknown`',
      'Soft cap of 5 rounds',
      'nothing is executed and nothing is written',
      '_bmad-output/<subject>/decisions.md',
      '## Adversarial mode',
      '## Called by another agent',
      '## What this skill is not',
      'bmad-plus intake',
    ]) {
      expect(flat).toContain(rule);
    }
  });

  test('names the exact layout of decisions.md', () => {
    const layout = text.match(/```markdown\n([\s\S]*?)```/)[1];
    expect(layout.match(/^#{1,3} .*/gm)).toEqual([
      '# Decisions — <subject>',
      '## Decisions',
      '## Open items',
      '## Next',
    ]);
    expect(layout).toContain('| ID | Decision | Status | Answer | Source | Risk |');
    expect(layout.match(/^\|/gm)).toHaveLength(5);
  });

  test('is a Core skill that no CLI command backs', () => {
    expect(registry.packs.core.skills).toContain('bmad-plus-challenge');
    expect(fs.readdirSync(path.join(root, path.dirname(SKILL)))).toEqual(['SKILL.md']);
  });
});

describe('the agents that open it', () => {
  const declared = [];
  for (const [packId, pack] of Object.entries(registry.packs)) {
    for (const persona of pack.personas || []) {
      if ((persona.uses_skills || []).includes('bmad-plus-challenge'))
        declared.push(`${packId}/${persona.id}`);
    }
  }

  test('the registry declares exactly the personas this test knows', () => {
    expect(declared.sort()).toEqual(Object.keys(DRIVERS).sort());
  });

  test.each(Object.entries(DRIVERS))(
    '%s carries conditions, exclusions and the limits',
    (_id, file) => {
      const text = read(file);
      const at = text.search(/When to [Cc]hallenge/);
      expect(at).toBeGreaterThan(-1);
      const section = text.slice(at, at + 2400);
      expect(section).toContain('bmad-plus-challenge');
      expect(section).toMatch(/Do not (challenge|open)/);
      expect(section).toContain('5 rounds');
      expect(section).toContain('"stop"');
      expect(section).toContain('`decisions.md`');
    }
  );

  test('the four Core agents list it as a capability with code CH', () => {
    for (const file of Object.values(DRIVERS).slice(0, 4)) {
      expect(read(file)).toMatch(/\| CH \| [^|]+ \| bmad-plus-challenge \|/);
    }
  });
});

describe('the trigger phrases', () => {
  const file = yaml.load(read('src/bmad-plus/data/role-triggers.yaml'), {
    schema: yaml.JSON_SCHEMA,
  });

  test('the shipped triggers pass the gate', () => {
    expect(triggers.checkTriggers(file, registry)).toEqual({ ok: true, problems: [] });
  });

  test('the generic phrases, in English and French, open it from Atlas', () => {
    const patterns = file.strategist.auto_triggers.challenge.patterns;
    for (const phrase of [
      'stress-test',
      'challenge my plan',
      'poke holes',
      'grill the plan',
      'challenge mon plan',
      'critique mon plan',
      'trouve les failles',
    ]) {
      expect(patterns).toContain(phrase);
    }
  });

  test('every other driver has phrases of its own subject', () => {
    for (const key of ['architect-dev', 'quality', 'orchestrator'])
      expect(file[key].auto_triggers.challenge.patterns.length).toBeGreaterThan(0);
    expect(file.seo.auto_triggers['seo-chief'].patterns).toContain('challenge the SEO strategy');
    for (const [pack, persona] of [
      ['dev-studio', 'pm-agent'],
      ['dev-studio', 'analyst-agent'],
      ['dev-studio', 'architect-agent'],
      ['shield', 'shield-orchestrator'],
      ['maker', 'agent-maker'],
    ])
      expect(file[pack].auto_triggers[persona].patterns.length).toBeGreaterThan(0);
  });
});
