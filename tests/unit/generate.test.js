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

  test('all 9 packs are present, in the canonical order', () => {
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
