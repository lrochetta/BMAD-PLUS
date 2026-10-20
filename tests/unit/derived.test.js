const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { execFileSync } = require('node:child_process');
const gen = require('../../tools/build/generate');
const counts = require('../../tools/build/check-counts');

describe('canonical derived registry facts', () => {
  const fresh = () => gen.loadRegistry();

  test('emits exact dimensions, rendered summaries and portable provisioning', () => {
    const derived = gen.buildDerived(fresh());
    expect(derived.packCount).toBe(10);
    expect(derived.installerAgents).toBe(15);
    expect(derived.totalAgents).toBe(48);
    expect(derived.packs.shield).toMatchObject({
      agentCount: 27,
      workflowCount: 11,
      frameworkCount: 27,
      referenceFiles: 79,
    });
    expect(derived.packs['dev-studio']).toMatchObject({ subAgentCount: 6, workflowCount: 38 });
    expect(derived.packs.shield.summary).toBe(
      '27 compliance agents + 11 workflows across 27+ frameworks.'
    );
    expect(derived.pythonPacks).toEqual({
      seo: {
        requirements: ['src', 'bmad-plus', 'packs', 'pack-seo', 'requirements.txt'],
        verifyModules: ['requests', 'bs4', 'defusedxml', 'lxml'],
      },
    });
    expect(JSON.stringify(derived)).not.toContain('portfolio');
    expect(JSON.stringify(derived)).not.toContain('D:/travail');
  });

  test('a new Python runtime is provisioned without an installer edit', () => {
    const registry = fresh();
    registry.packs.backup.runtime.push('python');
    const derived = gen.buildDerived(registry);
    expect(Object.keys(derived.pythonPacks)).toEqual(
      derived.packOrder.filter((id) => registry.packs[id].runtime.includes('python'))
    );
    expect(derived.pythonPacks.backup.requirements).toEqual([
      'src',
      'bmad-plus',
      'packs',
      'pack-backup',
      'requirements.txt',
    ]);
  });

  test.each([false, true])('count gate consumes the same counts (mutated=%s)', (mutate) => {
    const registry = fresh();
    if (mutate) {
      registry.packs.shield.categories[0].agents.push('fixture-agent');
      registry.packs['dev-studio'].categories[0].workflows.push('fixture-workflow');
    }
    const derived = gen.buildDerived(registry);
    const truth = counts.deriveTruth(registry);
    expect(truth).toMatchObject({
      packCount: derived.packCount,
      installerAgents: derived.installerAgents,
      totalAgents: derived.totalAgents,
      languages: derived.languages,
      shieldAgents: derived.packs.shield.agentCount,
      shieldWorkflows: derived.packs.shield.workflowCount,
      shieldCategories: derived.packs.shield.categoryCount,
      shieldFrameworks: derived.packs.shield.frameworkCount,
      shieldReferenceFiles: derived.packs.shield.referenceFiles,
      devStudioSubAgents: derived.packs['dev-studio'].subAgentCount,
      devStudioWorkflows: derived.packs['dev-studio'].workflowCount,
    });
  });

  test('reference count follows files, never a hand-typed number', () => {
    const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-refs-'));
    try {
      const refs = path.join(sourceRoot, 'packs', 'pack-shield', 'references', 'nested');
      fs.mkdirSync(refs, { recursive: true });
      fs.writeFileSync(path.join(refs, 'one.md'), '# Reference');
      fs.writeFileSync(path.join(refs, 'ignored.txt'), 'not a markdown reference');
      let truth = counts.deriveTruth(fresh(), { sourceRoot });
      expect(truth.shieldReferenceFiles).toBe(1);
      expect(counts.checkLine('1 regulatory reference files', truth)).toEqual([]);
      fs.writeFileSync(path.join(refs, 'two.md'), '# Reference');
      truth = counts.deriveTruth(fresh(), { sourceRoot });
      expect(truth.shieldReferenceFiles).toBe(2);
      expect(counts.checkLine('1 regulatory reference files', truth).join('\n')).toContain(
        '2 reference files'
      );
    } finally {
      fs.rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  test('owned counts must use placeholders; standards and version digits stay valid', () => {
    const registry = fresh();
    registry.packs.core.cli.desc = '99 agents';
    expect(() => gen.validateRegistry(registry)).toThrow(/derived placeholders/);
    registry.packs.core.cli.desc = 'ISO 27001, SOC 2, NIST 800-53 and BMAD-METHOD v6.6.0';
    expect(() => gen.validateRegistry(registry)).not.toThrow();
    registry.packs.core.cli.desc = 'Support for the ISO 27001 framework and SOC 2 framework';
    expect(() => gen.validateRegistry(registry)).not.toThrow();
    registry.packs.core.cli.desc = 'ISO 27001 framework support with 99 agents';
    expect(() => gen.validateRegistry(registry)).toThrow(/derived placeholders/);
    expect(gen.buildPacks(fresh())['dev-studio'].desc).toBe(
      'SDLC automation (6 agents, specialized workflows)'
    );
    expect(() => gen.renderSummary({ summary_template: '{unknown_count} agents' }, {})).toThrow(
      /Unknown derived/
    );
  });

  test('module generation preserves project configuration and separates agents/workflows', () => {
    const registry = fresh();
    const template = yaml.load(fs.readFileSync(gen.MODULE_TEMPLATE_PATH, 'utf8'));
    const generated = yaml.load(gen.generateModuleSource(registry));
    for (const [key, value] of Object.entries(template)) {
      if (key !== 'install_packs') expect(generated[key]).toEqual(value);
    }
    expect(generated.packs.shield.workflows).toEqual(registry.packs.shield.workflows);
    expect(generated.packs.shield.categories.some((c) => c.id === 'workflows')).toBe(false);
    expect(generated.packs['dev-studio'].categories[0]).toEqual(
      registry.packs['dev-studio'].categories[0]
    );
    expect(generated.packs.osint.skills).toEqual([]);
    expect(generated.install_packs['multi-select'].map((entry) => entry.value)).toEqual([
      ...gen.buildPackOrder(registry).filter((id) => !registry.packs[id].required),
      'all',
      'none',
    ]);
  });

  test('drift in generated DERIVED and module.yaml goes red then green on regeneration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-derived-'));
    const packsModulePath = path.join(root, 'packs.js');
    const modulePath = path.join(root, 'module.yaml');
    const registry = fresh();
    const runCheck = () =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            '-e',
            'const gen = require(process.argv[1]); console.log(JSON.stringify(gen.check({packsModulePath:process.argv[2],modulePath:process.argv[3]})));',
            require.resolve('../../tools/build/generate'),
            packsModulePath,
            modulePath,
          ],
          { encoding: 'utf8' }
        )
      );
    const write = () => {
      fs.writeFileSync(packsModulePath, gen.generatePacksModuleSource(registry));
      fs.writeFileSync(modulePath, gen.generateModuleSource(registry));
    };
    try {
      write();
      expect(runCheck().ok).toBe(true);
      fs.appendFileSync(packsModulePath, '\nmodule.exports.DERIVED.packCount = 999;\n');
      expect(runCheck().mismatches.join('\n')).toContain('DERIVED.packCount');
      write();
      fs.writeFileSync(
        modulePath,
        fs.readFileSync(modulePath, 'utf8').replace('27 compliance agents', '999 compliance agents')
      );
      expect(runCheck().mismatches.join('\n')).toContain('module.yaml');
      write();
      expect(runCheck().ok).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('derived skill-pack facts', () => {
  test('carry usesSkills, externalModule, pipelines and intake only where declared', () => {
    const registry = gen.loadRegistry();
    const before = gen.buildDerived(registry);
    // The design pack is the live consumer of external_module, intake and a persona's
    // uses_skills (docs/specs/core-orchestration.md §9); every other pack carries none.
    for (const [id, pack] of Object.entries(before.packs)) {
      const declared = id === 'design' ? ['externalModule', 'intake'] : [];
      for (const key of ['usesSkills', 'externalModule', 'pipelines', 'intake']) {
        expect(key in pack).toBe(declared.includes(key));
      }
      for (const persona of pack.personas) {
        expect('usesSkills' in persona).toBe(id === 'design');
      }
    }
    expect(before.packs.design.externalModule).toEqual({
      package: 'design-skill',
      version: '0.2.1',
      skills: ['design', 'design-review', 'redesign'],
    });
    expect(before.packs.design.intake).toBe('intake.yaml');
    expect(before.packs.design.personas.map((persona) => persona.usesSkills)).toEqual([
      ['design', 'design-review', 'redesign'],
    ]);
    registry.packs.shield.uses_skills = ['bmad-plus-uat'];
    registry.packs.shield.personas[0].uses_skills = ['bmad-plus-intake'];
    registry.packs.shield.pipelines = [
      {
        id: 'dpia',
        title: 'Impact assessment',
        steps: [{ workflow: 'dpia-sentinel', gate: 'auto' }],
      },
    ];
    registry.packs.shield.intake = 'intake.yaml';
    registry.packs.maker.external_module = {
      package: 'fake-skill',
      version: '2.3.4',
      skills: ['x'],
    };
    const derived = gen.buildDerived(gen.validateRegistry(registry));
    expect(derived.packs.shield).toMatchObject({
      usesSkills: ['bmad-plus-uat'],
      pipelines: [
        {
          id: 'dpia',
          title: 'Impact assessment',
          steps: [{ workflow: 'dpia-sentinel', gate: 'auto' }],
        },
      ],
      intake: 'intake.yaml',
    });
    expect(derived.packs.shield.personas[0].usesSkills).toEqual(['bmad-plus-intake']);
    expect(derived.packs.shield.requiredResources).toContain(
      '.agents/skills/pack-shield/intake.yaml'
    );
    expect(derived.packs.maker.externalModule).toEqual({
      package: 'fake-skill',
      version: '2.3.4',
      skills: ['x'],
    });
    expect(derived.packs.maker.requiredResources).toEqual([
      '.agents/skills/agent-maker/SKILL.md',
      '.agents/skills/x/SKILL.md',
    ]);
    expect(derived.packCount).toBe(before.packCount);
    expect(derived.totalAgents).toBe(before.totalAgents);
  });
});
