/** Public diagnostic facts must survive packaging without build-time sources. */
const gen = require('../../tools/build/generate');

const fresh = () => gen.loadRegistry();

describe('generated diagnostic contract', () => {
  test('declares BMAD integration limits without claiming host execution support', () => {
    const registry = fresh();
    const { diagnostics } = gen.buildDerived(registry);
    expect(diagnostics.schemaVersion).toBe(1);
    expect(diagnostics.runtimeMinimums).toEqual({ node: '20.0.0', python: '3.11' });
    expect(Object.keys(diagnostics.integrations)).toEqual(
      registry.targets.adapters.map(({ tool }) => tool)
    );
    for (const { tool, file } of registry.targets.adapters) {
      expect(diagnostics.integrations[tool]).toEqual({
        instructionFile: file,
        execution: 'host-managed',
        lifecycleEvents: 'not-integrated',
      });
    }
  });

  test('derives required files from loose and packaged installation layouts', () => {
    const { packs } = gen.buildDerived(fresh());
    expect(packs.core.requiredResources).toEqual([
      '.agents/skills/agent-strategist/SKILL.md',
      '.agents/skills/agent-architect-dev/SKILL.md',
      '.agents/skills/agent-quality/SKILL.md',
      '.agents/skills/agent-orchestrator/SKILL.md',
      '.agents/skills/bmad-plus-autopilot/SKILL.md',
      '.agents/skills/bmad-plus-parallel/SKILL.md',
      '.agents/skills/bmad-plus-sync/SKILL.md',
      '.agents/skills/bmad-plus-uat/SKILL.md',
      '.agents/data/role-triggers.yaml',
    ]);
    expect(packs.seo.requiredResources).toEqual([
      '.agents/skills/pack-seo/seo-scout.md',
      '.agents/skills/pack-seo/seo-chief.md',
      '.agents/skills/pack-seo/seo-judge.md',
      '.agents/skills/pack-seo/SKILL.md',
      '.agents/skills/pack-seo/scripts/seo_fetch.py',
    ]);
    expect(packs.memory.requiredResources).toEqual([
      '.agents/skills/pack-memory/zecher-agent.md',
      '.agents/skills/pack-memory/memory-orchestrator.md',
    ]);
  });

  test('retains required Dev Studio entry declarations and the lean Memory runtime', () => {
    const { packs, pythonPacks } = gen.buildDerived(fresh());
    expect(packs['dev-studio'].requiredResources).toEqual(
      expect.arrayContaining([
        '.agents/skills/dev-studio/SKILL.md',
        '.agents/skills/pack-dev-studio/categories/planning/create-ux-design.md',
        '.agents/skills/pack-dev-studio/categories/planning/steps/step-01-init.md',
      ])
    );
    expect(packs.memory.runtimes).toEqual(['node']);
    expect(pythonPacks.memory).toBeUndefined();
  });

  test('runtime requirements follow registry changes and returned facts are independent', () => {
    const registry = fresh();
    registry.packs.backup.runtime.push('python');
    registry.runtimes.python.min_version = '3.12';
    const derived = gen.buildDerived(registry);
    expect(derived.packs.backup.runtimes).toEqual(['node', 'python']);
    expect(derived.diagnostics.runtimeMinimums.python).toBe('3.12');
    derived.packs.backup.runtimes.push('other');
    expect(registry.packs.backup.runtime).toEqual(['node', 'python']);
  });

  test('emitted module needs neither registry.yaml nor a build-time module at runtime', () => {
    const registry = fresh();
    const module = { exports: {} };
    const unavailable = () => {
      throw new Error('Build-time dependency unavailable in consumer');
    };
    new Function('module', 'require', gen.generatePacksModuleSource(registry))(module, unavailable);
    expect(module.exports.DERIVED.diagnostics).toEqual(gen.buildDerived(registry).diagnostics);
    expect(module.exports.DERIVED.packs['dev-studio'].requiredResources).toContain(
      '.agents/skills/pack-dev-studio/categories/planning/steps/step-01-init.md'
    );
  });

  test.each(['../outside.md', '/absolute.md', 'C:/outside.md', 'nested\\outside.md', {}, null])(
    'rejects invalid extra resource declaration %p before generating a diagnostic target',
    (resource) => {
      const registry = fresh();
      registry.packs.backup.doctor.required_resources = [resource];
      expect(() => gen.validateRegistry(registry)).toThrow(/portable relative file path/);
    }
  );

  test('rejects undefined runtimes instead of generating an unverifiable requirement', () => {
    const registry = fresh();
    registry.packs.backup.runtime = ['unknown'];
    expect(() => gen.validateRegistry(registry)).toThrow(/known runtimes/);
  });

  test('rejects invented lifecycle integration claims', () => {
    const registry = fresh();
    registry.targets.integration.lifecycle_events = 'observed';
    expect(() => gen.validateRegistry(registry)).toThrow(/delivered instruction integration/);
  });
});
