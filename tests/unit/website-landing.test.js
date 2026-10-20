/**
 * The landing derives its numbers from generated facts and mirrors a few code defaults. These
 * tests fail when the registry, the CLI or the defaults move and the website was not refreshed.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const { buildFacts, FACTS_FILE } = require('../../website/registry-facts');
const data = require('../../website/landing-data');
const { SWARM_DEFAULTS } = require('../../tools/cli/lib/swarm-defaults');
const { DERIVED } = require('../../tools/cli/lib/packs');

describe('website landing facts', () => {
  test('website/registry-facts.json matches registry.yaml (run: node website/registry-facts.js --write)', () => {
    expect(fs.readFileSync(FACTS_FILE, 'utf8')).toBe(
      `${JSON.stringify(buildFacts(root), null, 2)}\n`
    );
  });

  test('the roster adds up to the registry totals, never to a typed number', () => {
    const { packs, languages } = JSON.parse(fs.readFileSync(FACTS_FILE, 'utf8'));
    expect(packs.reduce((sum, pack) => sum + pack.agents.length, 0)).toBe(DERIVED.totalAgents);
    expect(packs).toHaveLength(DERIVED.packCount);
    expect(languages).toEqual(DERIVED.languages);
  });

  test('the swarm numbers shown on the landing are the installer defaults', () => {
    expect(data.SWARM.budget).toBe(SWARM_DEFAULTS.budget);
    expect(data.SWARM.wave).toBe(SWARM_DEFAULTS.wave);
    expect(data.SWARM.example).toBeGreaterThan(data.SWARM.budget);
  });

  test('the CLI table lists exactly the registered commands', () => {
    const entry = fs.readFileSync(path.join(root, 'tools/cli/bmad-plus-cli.js'), 'utf8');
    const direct = [...entry.matchAll(/\.command\('([a-z-]+)/g)].map((match) => match[1]);
    const modules = [...entry.matchAll(/'\.\/commands\/([a-z-]+)'/g)].map((match) => match[1]);
    const fromModules = modules
      .filter(
        (name) => !['install', 'uninstall', 'update', 'doctor', 'scan', 'memory'].includes(name)
      )
      .map((name) => require(`../../tools/cli/commands/${name}`).command.split(' ')[0]);
    const registered = [...new Set([...direct, ...fromModules])].filter(
      (name) => name !== 'memory-journal-cmd'
    );
    expect(data.COMMANDS.map((command) => command.id).sort()).toEqual(registered.sort());
  });

  test('every registry data-handling flow the landing lists exists in the registry facts', () => {
    expect(
      JSON.parse(fs.readFileSync(FACTS_FILE, 'utf8')).dataHandling.map((flow) => flow.id)
    ).toEqual(DERIVED.dataHandling.map((flow) => flow.id));
  });
});
