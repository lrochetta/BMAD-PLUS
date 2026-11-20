/** Role triggers must name agents, personas and pipelines the registry really declares. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const gen = require('../../tools/build/generate');
const triggers = require('../../tools/build/check-triggers');

const registry = gen.loadRegistry();
const clone = () => JSON.parse(JSON.stringify(registry));

const fixture = () => ({
  orchestrator: {
    default_role: 'autopilot',
    auto_triggers: {
      autopilot: { patterns: ['autopilot', 'gère tout'], contexts: ['pack_pipeline_declared'] },
      'parallel-supervisor': { patterns: ['parallel'], reasoning: ['workload_can_be_distributed'] },
    },
  },
  seo: {
    default_role: 'seo-chief',
    auto_triggers: {
      'seo-chief': { patterns: ['SEO'] },
      'seo-scout': { patterns: ['crawl'], contexts: ['site_structure_unknown'] },
    },
  },
});

describe('rules', () => {
  test('the fixture passes against the real registry', () => {
    expect(triggers.checkTriggers(fixture(), registry)).toEqual({ ok: true, problems: [] });
  });

  test('core short names derive from the required pack, never from a hand-typed list', () => {
    expect([...triggers.coreShortNames(registry)]).toEqual([
      'strategist',
      'architect-dev',
      'quality',
      'orchestrator',
    ]);
    const mutated = clone();
    mutated.packs.core.agents.push('agent-planner');
    expect(triggers.coreShortNames(mutated).has('planner')).toBe(true);
  });

  test.each([
    [
      'a key that is neither a Core agent nor a pack',
      (t) => (t.designer = t.orchestrator),
      /designer: neither a Core agent short name nor a pack id/,
    ],
    ['a block that is not a mapping', (t) => (t.seo = 'seo-chief'), /seo: must be a mapping/],
    [
      'an unknown block field',
      (t) => (t.seo.fallback_role = 'seo-chief'),
      /seo: unknown field "fallback_role"/,
    ],
    ['no roles', (t) => (t.seo.auto_triggers = {}), /auto_triggers must be a non-empty mapping/],
    [
      'a default_role outside the roles',
      (t) => (t.seo.default_role = 'seo-judge'),
      /default_role must name one of its auto_triggers/,
    ],
    [
      'a missing default_role',
      (t) => delete t.orchestrator.default_role,
      /orchestrator: default_role/,
    ],
    [
      'empty patterns',
      (t) => (t.seo.auto_triggers['seo-scout'].patterns = []),
      /seo.seo-scout: patterns must be a non-empty list/,
    ],
    [
      'a blank pattern',
      (t) => t.seo.auto_triggers['seo-scout'].patterns.push(' '),
      /seo.seo-scout: patterns must be/,
    ],
    [
      'a context that is not snake_case',
      (t) => (t.seo.auto_triggers['seo-scout'].contexts = ['Site Unknown']),
      /contexts must be a list of snake_case identifiers/,
    ],
    [
      'reasoning given as a string',
      (t) => (t.orchestrator.auto_triggers['parallel-supervisor'].reasoning = 'x'),
      /reasoning must be a list/,
    ],
    [
      'an unknown role field',
      (t) => (t.seo.auto_triggers['seo-chief'].keywords = ['x']),
      /seo.seo-chief: unknown field "keywords"/,
    ],
    [
      'a role that is not a persona of the pack',
      (t) => (t.seo.auto_triggers['seo-writer'] = { patterns: ['write'] }),
      /seo.seo-writer: not a persona or pipeline id of pack "seo"/,
    ],
    [
      'a pattern claimed by two roles of one key',
      (t) => t.seo.auto_triggers['seo-scout'].patterns.push('SEO'),
      /seo: pattern "SEO" is claimed by both seo-chief and seo-scout/,
    ],
    [
      'a pattern listed twice in one role',
      (t) => t.seo.auto_triggers['seo-chief'].patterns.push('SEO'),
      /seo.seo-chief: pattern "SEO" is listed twice/,
    ],
  ])('refuses %s', (_name, mutate, message) => {
    const value = fixture();
    mutate(value);
    const result = triggers.checkTriggers(value, registry);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(message);
  });

  test('a pipeline id of the pack is a valid role; the same pattern under another key is not a clash', () => {
    const mutated = clone();
    mutated.packs.seo.pipelines = [
      {
        id: 'full-audit',
        title: 'Crawl, score, report',
        steps: [
          { agent: 'seo-scout', gate: 'auto' },
          { agent: 'seo-judge', gate: 'notify_only' },
          { agent: 'seo-chief', gate: 'require_approval' },
        ],
      },
    ];
    const value = fixture();
    value.seo.auto_triggers['full-audit'] = { patterns: ['audit SEO', 'SEO audit'] };
    value.orchestrator.auto_triggers.autopilot.patterns.push('SEO');
    expect(triggers.checkTriggers(value, gen.validateRegistry(mutated))).toEqual({
      ok: true,
      problems: [],
    });
    expect(triggers.checkTriggers(value, registry).problems).toEqual([
      'seo.full-audit: not a persona or pipeline id of pack "seo"',
    ]);
  });

  test('a file that is not a mapping is one problem', () => {
    expect(triggers.checkTriggers(['strategist'], registry).problems).toEqual([
      'triggers: must be a mapping',
    ]);
  });
});

describe('the shipped triggers and the CLI', () => {
  test('src/bmad-plus/data/role-triggers.yaml passes and carries the three Core contexts', () => {
    const result = triggers.check();
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    const shipped = yaml.load(fs.readFileSync(triggers.DEFAULT_TRIGGERS_PATH, 'utf8'));
    expect(shipped.orchestrator.auto_triggers.autopilot.contexts).toContain(
      'pack_pipeline_declared'
    );
    expect(shipped.orchestrator.auto_triggers['parallel-supervisor'].contexts).toEqual(
      expect.arrayContaining(['swarm_declared', 'panel_requested'])
    );
  });

  test('main exits 0 on the shipped file in text and JSON; a drifted copy is red through check()', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-triggers-'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(triggers.main(['node', 'x'])).toBe(0);
      expect(log.mock.calls.flat().join('\n')).toContain(
        'OK — src/bmad-plus/data/role-triggers.yaml'
      );
      expect(triggers.main(['node', 'x', '--json'])).toBe(0);
      expect(JSON.parse(log.mock.calls.at(-1)[0])).toMatchObject({
        schemaVersion: 1,
        status: 'ok',
      });
      const drifted = path.join(dir, 'role-triggers.yaml');
      fs.writeFileSync(
        drifted,
        'seo:\n  default_role: seo-writer\n  auto_triggers:\n    seo-writer:\n      patterns: [write]\n'
      );
      const result = triggers.check({ triggersPath: drifted });
      expect(result.ok).toBe(false);
      expect(result.problems).toEqual([
        'seo.seo-writer: not a persona or pipeline id of pack "seo"',
      ]);
      expect(error.mock.calls).toEqual([]);
    } finally {
      log.mockRestore();
      error.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
