/**
 * BMAD+ CLI — PACKS Unit Tests
 * Sync validation between module.yaml and packs.js
 *
 * Run: npx jest tests/unit/packs.test.js
 */

const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');
const { PACKS } = require('../../tools/cli/lib/packs');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PACKS ↔ module.yaml Sync Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('PACKS ↔ module.yaml Sync', () => {
  test('every pack in module.yaml should exist in packs.js PACKS', () => {
    const moduleYamlPath = path.join(__dirname, '../..', 'src', 'bmad-plus', 'module.yaml');

    const moduleContent = yaml.load(fs.readFileSync(moduleYamlPath, 'utf8'));
    const modulePackIds = Object.keys(moduleContent.packs || {});

    const sharedPackIds = Object.keys(PACKS);

    for (const packId of modulePackIds) {
      expect(sharedPackIds).toContain(packId);
    }
  });

  test('every pack in packs.js PACKS should exist in module.yaml', () => {
    const moduleYamlPath = path.join(__dirname, '../..', 'src', 'bmad-plus', 'module.yaml');

    const moduleContent = yaml.load(fs.readFileSync(moduleYamlPath, 'utf8'));
    const modulePackIds = Object.keys(moduleContent.packs || {});

    const sharedPackIds = Object.keys(PACKS);

    for (const packId of sharedPackIds) {
      expect(modulePackIds).toContain(packId);
    }
  });

  test('pack count should match between module.yaml and packs.js', () => {
    const moduleYamlPath = path.join(__dirname, '../..', 'src', 'bmad-plus', 'module.yaml');

    const moduleContent = yaml.load(fs.readFileSync(moduleYamlPath, 'utf8'));
    const modulePackCount = Object.keys(moduleContent.packs || {}).length;
    const sharedPackCount = Object.keys(PACKS).length;

    expect(sharedPackCount).toBe(modulePackCount);
  });
});
