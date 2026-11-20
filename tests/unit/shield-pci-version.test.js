/** The PCI DSS agent names one version everywhere: the one it defaults to, v4.0.1. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const shield = path.join(root, 'src/bmad-plus/packs/pack-shield');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

// "PCI DSS v4.0" that is not the start of "v4.0.1".
const BARE_V40 = /PCI DSS v4\.0(?!\.\d)/;

describe('PCI DSS version naming', () => {
  const surfaces = {
    'pack README table': [read(shield, 'README.md'), /\| `pci-dss-agent` \| ([^|]+) \|/],
    'orchestrator table': [
      read(shield, 'shield-orchestrator.md'),
      /\| `pci-dss-agent` \| ([^|]+) \|/,
    ],
    'pack skill list': [read(shield, 'SKILL.md'), /\*\*(PCI DSS v[\d.]+)\*\*/],
    'agent header': [
      read(shield, 'categories/industry-compliance/pci-dss-agent.md'),
      /\*\*Framework:\*\* (PCI DSS v[\d.]+)/,
    ],
    'website facts': [
      read(root, 'website/registry-facts.js'),
      /'pci-dss-agent': \['(PCI DSS v[\d.]+)'/,
    ],
  };

  test.each(Object.keys(surfaces))('%s names v4.0.1', (surface) => {
    const [text, pattern] = surfaces[surface];
    const match = text.match(pattern);
    expect(match).not.toBeNull();
    expect(match[1].trim()).toBe('PCI DSS v4.0.1');
  });

  test('no Shield page or listing quotes a bare v4.0 as the framework version', () => {
    const files = [
      read(root, 'website/docs-pages/shield.js'),
      read(root, 'website/docs-pages/agents-roster.js'),
      read(root, 'website/registry-facts.json'),
    ];
    for (const text of files) expect(text).not.toMatch(BARE_V40);
  });
});
