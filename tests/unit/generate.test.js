/**
 * BMAD+ Build — registry.yaml SSOT Migration Proof
 *
 * Proves that the root registry.yaml + tools/build/generate.js reproduce the
 * hand-written tools/cli/lib/packs.js EXACTLY (deep-strict equality on
 * PACKS, PACK_ORDER, EXPECTED_AGENTS). Once this holds, packs.js can become a
 * thin re-export of generated data without any behavior change.
 *
 * Run: npx jest tests/unit/generate.test.js
 */

const fs = require('node:fs');
const path = require('node:path');
const current = require('../../tools/cli/lib/packs');
const gen = require('../../tools/build/generate');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('registry.yaml SSOT — migration proof against packs.js', () => {
  const registry = gen.loadRegistry();

  test('generated PACKS deep-equals tools/cli/lib/packs.js PACKS', () => {
    expect(gen.buildPacks(registry)).toStrictEqual(current.PACKS);
  });

  test('generated PACK_ORDER deep-equals tools/cli/lib/packs.js PACK_ORDER', () => {
    expect(gen.buildPackOrder(registry)).toStrictEqual(current.PACK_ORDER);
  });

  test('generated EXPECTED_AGENTS deep-equals tools/cli/lib/packs.js EXPECTED_AGENTS', () => {
    expect(gen.buildExpectedAgents(registry)).toStrictEqual(current.EXPECTED_AGENTS);
  });

  test('all 10 packs are present, in the canonical order', () => {
    expect(gen.buildPackOrder(registry)).toEqual([
      'core',
      'osint',
      'maker',
      'shield',
      'seo',
      'memory',
      'dev-studio',
      'backup',
      'animated',
      'design',
    ]);
  });

  test('check() passes against the live repo (no drift)', () => {
    const result = gen.check();
    expect(result.mismatches).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('product.version matches package.json version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(registry.product.version).toBe(pkg.version);
  });
});

describe('generated module source (drop-in packs.js replacement)', () => {
  const registry = gen.loadRegistry();

  test('evaluating the emitted source yields exports identical to packs.js', () => {
    const source = gen.generatePacksModuleSource(registry);
    const sandbox = { exports: {} };
    new Function('module', 'exports', source)(sandbox, sandbox.exports);
    expect(sandbox.exports).toStrictEqual({
      PACKS: current.PACKS,
      PACK_ORDER: current.PACK_ORDER,
      EXPECTED_AGENTS: current.EXPECTED_AGENTS,
      DERIVED: current.DERIVED,
    });
  });

  test('emitted source is marked auto-generated', () => {
    expect(gen.generatePacksModuleSource(registry)).toContain('AUTO-GENERATED, DO NOT EDIT');
  });
});

describe('registry validation & drift detection', () => {
  const clone = () => JSON.parse(JSON.stringify(gen.loadRegistry()));

  test('rejects a registry without packs', () => {
    expect(() => gen.validateRegistry({})).toThrow(/missing top-level "packs"/);
  });

  test('rejects a pack missing its cli block', () => {
    const registry = clone();
    delete registry.packs.core.cli;
    expect(() => gen.validateRegistry(registry)).toThrow(/pack "core": missing "cli" block/);
  });

  test('rejects duplicate order values', () => {
    const registry = clone();
    registry.packs.osint.order = registry.packs.core.order;
    expect(() => gen.validateRegistry(registry)).toThrow(/duplicate order/);
  });

  test('rejects a packaged pack without doctor.pack_agents', () => {
    const registry = clone();
    delete registry.packs.shield.doctor;
    expect(() => gen.validateRegistry(registry)).toThrow(/doctor\.pack_agents/);
  });

  test('buildPacks omits `required` and `data` keys exactly like packs.js does', () => {
    const packs = gen.buildPacks(gen.loadRegistry());
    expect(packs.core.required).toBe(true);
    expect('required' in packs.osint).toBe(false);
    expect('data' in packs.core).toBe(true);
    expect(packs.maker.data).toEqual([]);
    expect('data' in packs.shield).toBe(false);
    expect(packs.osint.externalPackage).toBe('osint-agent-package');
    expect('externalPackage' in packs.core).toBe(false);
  });

  test('declared install source paths must exist', () => {
    const packs = gen.buildPacks(gen.loadRegistry());
    expect(gen.checkSourcePaths(packs)).toEqual([]);
    packs.core.agents.push('agent-that-does-not-exist');
    packs.shield.packDir = 'pack-missing';
    const missing = gen.checkSourcePaths(packs).join('\n');
    expect(missing).toContain(
      'PACKS.core: declared source path does not exist: src/bmad-plus/agents/agent-that-does-not-exist'
    );
    expect(missing).toContain('src/bmad-plus/packs/pack-missing');
  });

  test('loose packs need no pack_dir; packaged agents are not agent directories', () => {
    const packs = gen.buildPacks(gen.loadRegistry());
    expect('packDir' in packs.core).toBe(false);
    expect(packs.core.agents).toContain('agent-strategist');
    expect(packs.shield.agents).toEqual([]);
    expect(packs.shield.packDir).toBe('pack-shield');
    const registry = clone();
    delete registry.packs.seo.pack_dir;
    expect(() => gen.validateRegistry(registry)).toThrow(/pack "seo": missing "pack_dir"/);
  });

  test('a drifted registry is caught by check()', () => {
    // Write a mutated copy of the registry and run check() against it.
    const os = require('node:os');
    const yaml = require('js-yaml');
    const registry = clone();
    registry.packs.seo.cli.desc = 'DRIFTED DESCRIPTION';
    const tmp = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-registry-')),
      'registry.yaml'
    );
    fs.writeFileSync(tmp, yaml.dump(registry), 'utf8');
    try {
      const result = gen.check({ registryPath: tmp });
      expect(result.ok).toBe(false);
      expect(result.mismatches.join('\n')).toContain('PACKS.seo');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });
});

describe('skill packs: uses_skills, external_module, pipelines and intake', () => {
  const os = require('node:os');
  const fresh = () => JSON.parse(JSON.stringify(gen.loadRegistry()));
  const pipeline = () => ({
    id: 'privacy-run',
    title: 'From impact assessment to notice',
    steps: [
      { workflow: 'dpia-sentinel', gate: 'require_approval' },
      { agent: 'shield-orchestrator', gate: 'notify_only' },
      { workflow: 'privacy-notice-gen', gate: 'auto' },
    ],
  });
  const fakeModule = (root, { version = '1.0.0', skills = ['x'] } = {}) => {
    const dir = path.join(root, 'node_modules', 'fake-skill');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'fake-skill', version })
    );
    for (const id of skills) {
      fs.mkdirSync(path.join(dir, 'skills', id), { recursive: true });
      fs.writeFileSync(path.join(dir, 'skills', id, 'SKILL.md'), '# ' + id);
    }
    return dir;
  };
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-skillpacks-'));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('the four fields are emitted only when declared, so other packs do not change', () => {
    const registry = fresh();
    registry.packs.shield.pipelines = [pipeline()];
    registry.packs.shield.intake = 'intake.yaml';
    registry.packs.shield.uses_skills = ['bmad-plus-uat'];
    registry.packs.maker.external_module = {
      package: 'fake-skill',
      version: '1.0.0',
      skills: ['x'],
    };
    registry.packs.maker.personas[0].uses_skills = ['x', 'bmad-plus-intake'];
    const packs = gen.buildPacks(gen.validateRegistry(registry));
    expect(packs.shield).toMatchObject({
      usesSkills: ['bmad-plus-uat'],
      pipelines: [pipeline()],
      intake: 'intake.yaml',
    });
    expect(Object.keys(packs.shield)).toEqual([
      'name',
      'icon',
      'agents',
      'skills',
      'packDir',
      'packSrcDir',
      'usesSkills',
      'pipelines',
      'intake',
      'desc',
    ]);
    expect(packs.maker.externalModule).toEqual({
      package: 'fake-skill',
      version: '1.0.0',
      skills: ['x'],
    });
    expect('usesSkills' in packs.maker).toBe(false);
    for (const id of ['core', 'osint', 'seo', 'memory', 'dev-studio', 'backup', 'animated']) {
      expect(packs[id]).toEqual(current.PACKS[id]);
    }
  });

  test.each([
    [
      'a pack skill nobody ships',
      (r) => (r.packs.core.uses_skills = ['brand-voice']),
      /uses_skills: skill brand-voice is shipped by no pack/,
    ],
    [
      'a persona skill nobody ships',
      (r) => (r.packs.seo.personas[1].uses_skills = ['seo-magic']),
      /persona seo-chief: uses_skills: skill seo-magic is shipped by no pack/,
    ],
    [
      'an empty uses_skills',
      (r) => (r.packs.core.uses_skills = []),
      /non-empty list of distinct skill ids/,
    ],
    [
      'a repeated id',
      (r) => (r.packs.core.uses_skills = ['bmad-plus-uat', 'bmad-plus-uat']),
      /distinct skill ids/,
    ],
    [
      'an external_module with a range',
      (r) =>
        (r.packs.maker.external_module = {
          package: 'fake-skill',
          version: '^1.0.0',
          skills: ['x'],
        }),
      /external_module.version must be an exact version/,
    ],
    [
      'an external_module with a bad name',
      (r) =>
        (r.packs.maker.external_module = {
          package: 'Fake Skill',
          version: '1.0.0',
          skills: ['x'],
        }),
      /external_module.package must be an npm package name/,
    ],
    [
      'an external_module without skills',
      (r) =>
        (r.packs.maker.external_module = { package: 'fake-skill', version: '1.0.0', skills: [] }),
      /external_module.skills: must be a non-empty list/,
    ],
    [
      'an external_module with a stray field',
      (r) =>
        (r.packs.maker.external_module = {
          package: 'fake-skill',
          version: '1.0.0',
          skills: ['x'],
          path: 'y',
        }),
      /takes exactly package, version and skills/,
    ],
    [
      'a skill both in-tree and from the module',
      (r) =>
        (r.packs.core.external_module = {
          package: 'fake-skill',
          version: '1.0.0',
          skills: ['bmad-plus-uat'],
        }),
      /both shipped in-tree and taken from the module/,
    ],
    [
      'pipelines that are empty',
      (r) => (r.packs.shield.pipelines = []),
      /pipelines must be a non-empty list/,
    ],
    [
      'a pipeline with a stray field',
      (r) => (r.packs.shield.pipelines = [{ ...pipeline(), owner: 'x' }]),
      /takes exactly id, title and steps/,
    ],
    [
      'two pipelines with one id',
      (r) => (r.packs.shield.pipelines = [pipeline(), pipeline()]),
      /pipeline ids must be distinct/,
    ],
    [
      'a pipeline without a title',
      (r) => (r.packs.shield.pipelines = [{ ...pipeline(), title: '' }]),
      /pipeline privacy-run: needs a title/,
    ],
    [
      'a pipeline without steps',
      (r) => (r.packs.shield.pipelines = [{ ...pipeline(), steps: [] }]),
      /needs at least one step/,
    ],
    [
      'a step naming both workflow and agent',
      (r) =>
        (r.packs.shield.pipelines = [
          {
            ...pipeline(),
            steps: [{ workflow: 'dpia-sentinel', agent: 'shield-orchestrator', gate: 'auto' }],
          },
        ]),
      /step 1: names exactly one of workflow or agent/,
    ],
    [
      'a step naming neither',
      (r) => (r.packs.shield.pipelines = [{ ...pipeline(), steps: [{ gate: 'auto' }] }]),
      /names exactly one of workflow or agent/,
    ],
    [
      'a workflow the pack does not declare',
      (r) =>
        (r.packs.shield.pipelines = [
          { ...pipeline(), steps: [{ workflow: 'create-prd', gate: 'auto' }] },
        ]),
      /workflow create-prd is not declared by the pack/,
    ],
    [
      'an agent of another pack',
      (r) =>
        (r.packs.shield.pipelines = [
          { ...pipeline(), steps: [{ agent: 'gdpr-agent', gate: 'auto' }] },
        ]),
      /agent gdpr-agent is not declared by the pack/,
    ],
    [
      'a gate outside the enum',
      (r) =>
        (r.packs.shield.pipelines = [
          { ...pipeline(), steps: [{ workflow: 'dpia-sentinel', gate: 'ask' }] },
        ]),
      /gate must be one of require_approval\|notify_only\|auto/,
    ],
    [
      'a step with a stray field',
      (r) =>
        (r.packs.shield.pipelines = [
          { ...pipeline(), steps: [{ workflow: 'dpia-sentinel', gate: 'auto', retry: 2 }] },
        ]),
      /takes workflow or agent, and gate/,
    ],
    [
      'an intake on a loose pack without pack_dir',
      (r) => (r.packs.core.intake = 'intake.yaml'),
      /intake needs a pack_dir/,
    ],
    [
      'an intake that is not a path',
      (r) => (r.packs.shield.intake = 7),
      /intake must be a file path/,
    ],
    [
      'an intake that traverses',
      (r) => (r.packs.shield.intake = '../intake.yaml'),
      /portable relative file path/,
    ],
  ])('rejects %s', (_name, mutate, message) => {
    const registry = fresh();
    mutate(registry);
    expect(() => gen.validateRegistry(registry)).toThrow(message);
  });

  test('a pipeline may name a sub-agent and a category workflow; uses_skills may name Core and module skills', () => {
    const registry = fresh();
    registry.packs['dev-studio'].pipelines = [
      {
        id: 'plan',
        title: 'Brief to stories',
        steps: [
          { workflow: 'product-brief', gate: 'require_approval' },
          { agent: 'architect-agent', gate: 'auto' },
        ],
      },
    ];
    registry.packs.maker.external_module = {
      package: 'fake-skill',
      version: '1.0.0',
      skills: ['x'],
    };
    registry.packs['dev-studio'].uses_skills = ['x', 'bmad-plus-uat', 'dev-studio'];
    expect(() => gen.validateRegistry(registry)).not.toThrow();
  });

  test('checkExternalModules proves the pinned dependency, the installed version and every skill', () => {
    const registry = fresh();
    // The fixture roots below carry only fake-skill; the live design pack resolves its
    // module from the repository root and is covered by design-pack-shipping.test.js.
    delete registry.packs.design;
    registry.packs.maker.external_module = {
      package: 'fake-skill',
      version: '1.0.0',
      skills: ['x', 'y'],
    };
    registry.data_handling.runtime_dependencies.push('fake-skill');
    gen.validateRegistry(registry);
    const packageJson = { dependencies: { 'fake-skill': '1.0.0' } };
    // Node remembers a failed lookup for the life of the process: the empty root is its own tree.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-skillpacks-empty-'));
    try {
      expect(
        gen.checkExternalModules(registry, { packageRoot: empty, packageJson }).join('\n')
      ).toMatch(/cannot be resolved from the repository root/);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
    fakeModule(root, { skills: ['x'] });
    expect(gen.checkExternalModules(registry, { packageRoot: root, packageJson })).toEqual([
      'PACKS.maker: external_module fake-skill: skills/y/SKILL.md is missing',
    ]);
    fakeModule(root, { skills: ['x', 'y'] });
    expect(gen.checkExternalModules(registry, { packageRoot: root, packageJson })).toEqual([]);
    fakeModule(root, { version: '1.0.1', skills: ['x', 'y'] });
    expect(gen.checkExternalModules(registry, { packageRoot: root, packageJson })).toEqual([
      'PACKS.maker: external_module fake-skill: installed fake-skill@1.0.1, declared 1.0.0',
    ]);
    fakeModule(root, { skills: ['x', 'y'] });
    const loose = gen.checkExternalModules(registry, {
      packageRoot: root,
      packageJson: { dependencies: { 'fake-skill': '^1.0.0' } },
    });
    expect(loose).toEqual([
      'PACKS.maker: external_module fake-skill: package.json must pin dependencies["fake-skill"] to exactly "1.0.0" (found "^1.0.0")',
    ]);
    expect(
      gen.checkExternalModules(registry, { packageRoot: root, packageJson: {} }).join('\n')
    ).toContain('(found undefined)');
    registry.data_handling.runtime_dependencies.pop();
    expect(gen.checkExternalModules(registry, { packageRoot: root, packageJson })).toEqual([
      'PACKS.maker: external_module fake-skill: missing from data_handling.runtime_dependencies',
    ]);
    fs.writeFileSync(path.join(root, 'node_modules', 'fake-skill', 'package.json'), '{');
    registry.data_handling.runtime_dependencies.push('fake-skill');
    expect(
      gen.checkExternalModules(registry, { packageRoot: root, packageJson }).join('\n')
    ).toMatch(/unreadable package.json/);
  });

  test('checkIntakes requires the file in the pack directory, valid, and owned by that pack', () => {
    const registry = fresh();
    // The fixture root has no pack-design directory; the live intake is checked at the end.
    delete registry.packs.design;
    registry.packs.shield.intake = 'intake.yaml';
    gen.validateRegistry(registry);
    const file = path.join(root, 'src', 'bmad-plus', 'packs', 'pack-shield', 'intake.yaml');
    expect(gen.checkIntakes(registry, { packageRoot: root })).toEqual([
      'PACKS.shield: intake src/bmad-plus/packs/pack-shield/intake.yaml: file does not exist',
    ]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      'schema_version: 1\nid: shield-read\npack: shield\ntitle: Shield read\nsections: []\n'
    );
    expect(gen.checkIntakes(registry, { packageRoot: root })).toEqual([
      'PACKS.shield: intake src/bmad-plus/packs/pack-shield/intake.yaml: intake: "sections" must be a non-empty list',
    ]);
    const valid =
      'schema_version: 1\nid: shield-read\npack: PACK\ntitle: Shield read\nsections:\n' +
      '  - id: scope\n    title: Scope\n    questions:\n' +
      '      - { id: regime, ask: Which regime?, kind: choice, choices: [gdpr, ccpa], must_have: true, risk_if_unknown: Wrong agent. }\n';
    fs.writeFileSync(file, valid.replace('PACK', 'seo'));
    expect(gen.checkIntakes(registry, { packageRoot: root })).toEqual([
      'PACKS.shield: intake src/bmad-plus/packs/pack-shield/intake.yaml: declares pack "seo" instead of "shield"',
    ]);
    fs.writeFileSync(file, valid.replace('PACK', 'shield'));
    expect(gen.checkIntakes(registry, { packageRoot: root })).toEqual([]);
    fs.writeFileSync(file, 'sections: [\n');
    expect(gen.checkIntakes(registry, { packageRoot: root }).join('\n')).toMatch(/intake.yaml: /);
    expect(gen.checkIntakes(fresh())).toEqual([]);
  });
});
