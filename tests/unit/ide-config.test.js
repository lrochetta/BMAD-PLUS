/** IDE metadata is a view of registry targets, with one detection table. */
const fs = require('node:fs');
const path = require('node:path');
const { IDE_CONFIGS, buildIDEConfigs } = require('../../tools/cli/lib/ide-config');
const { DERIVED } = require('../../tools/cli/lib/packs');

test('every declared tool uses exactly its registry target', () => {
  expect(Object.keys(IDE_CONFIGS)).toEqual(DERIVED.targets.adapters.map((adapter) => adapter.tool));
  for (const { tool, file } of DERIVED.targets.adapters) {
    expect(IDE_CONFIGS[tool].configFile).toBe(file);
    expect(IDE_CONFIGS[tool].name).toBeTruthy();
    expect(Array.isArray(IDE_CONFIGS[tool].detect)).toBe(true);
  }
});

test('additional registry tools are installable without changing a roster or path table', () => {
  const derived = JSON.parse(JSON.stringify(DERIVED));
  derived.targets.adapters.push({ tool: 'future-cli', file: 'FUTURE.md' });
  expect(buildIDEConfigs(derived)['future-cli']).toEqual({
    name: 'future-cli',
    configFile: 'FUTURE.md',
    detect: [],
  });
});

test('all supported tools have detection markers', () => {
  for (const config of Object.values(IDE_CONFIGS)) expect(config.detect.length).toBeGreaterThan(0);
});

test('the compatibility module contains no renderer or duplicated agent roster', () => {
  const compatibility = require('../../tools/cli/lib/ide-config');
  expect(Object.keys(compatibility).sort()).toEqual(['IDE_CONFIGS', 'buildIDEConfigs']);
  const source = fs.readFileSync(path.join(__dirname, '../../tools/cli/lib/ide-config.js'), 'utf8');
  expect(source).not.toMatch(/AGENT_LIST|getAgentsByPacks|function generate/);
});
