/**
 * OSINT — Phase −1 Lawful Basis Gate reaches every personal-data entry path (GRC-03)
 *
 * The lawful-basis gate is defined in the bmad-osint-investigate skill and is
 * mandatory before profiling a named person. For three audit cycles it was
 * bypassable: the direct menu items ([LI]/[IG]/[FB]/[PP]/[CE]) and the Phase
 * Router's direct entries (extraction/psychoprofile) reached personal data
 * without referencing the gate. This test fails if any OSINT entry-path source
 * stops referencing the gate, or if the router's personal-data entries stop
 * routing through Phase −1. No capability is removed (CG-02) — the gate governs.
 *
 * Run: npx jest tests/unit/osint-lawful-basis-gate.test.js --coverage=false
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const INVESTIGATE_SKILL = 'osint-agent-package/skills/bmad-osint-investigate/osint/SKILL.md';
const INVESTIGATOR_AGENT = 'osint-agent-package/agents/osint-investigator.md';
const SHADOW_SKILL = 'src/bmad-plus/agents/agent-shadow/SKILL.md';

const PERSONAL_DATA_CODES = ['LI', 'IG', 'FB', 'PP', 'CE'];

describe('every OSINT entry-path source references the lawful-basis gate', () => {
  for (const file of [INVESTIGATE_SKILL, INVESTIGATOR_AGENT, SHADOW_SKILL]) {
    test(`${file} references the Lawful Basis Gate`, () => {
      const text = read(file);
      expect(text).toMatch(/Lawful Basis Gate/);
      // "Phase −1" — tolerate ASCII hyphen, unicode minus (U+2212), en-dash.
      expect(text).toMatch(/Phase[\s−–-]*1/);
    });
  }
});

describe('the two agent menus gate the direct personal-data items', () => {
  for (const file of [INVESTIGATOR_AGENT, SHADOW_SKILL]) {
    test(`${file} names the personal-data codes and the DECLINE fallback`, () => {
      const text = read(file);
      for (const code of PERSONAL_DATA_CODES) {
        expect(text).toMatch(new RegExp(`\\b${code}\\b`));
      }
      // psychoprofile is special-category → Art. 9 must be called out
      expect(text).toMatch(/Art\.\s*9/);
      // the no-basis path must DECLINE, not silently proceed
      expect(text).toMatch(/DECLINE/);
    });
  }
});

describe('the Phase Router routes direct personal-data entries through Phase −1', () => {
  const text = read(INVESTIGATE_SKILL);

  test('the extraction / psychoprofile direct entries pass the gate first', () => {
    // Router entries that ACQUIRE personal data (target Phase 2 extraction or Phase 4
    // psychoprofile) must route through Phase −1 first. Post-processing entries
    // (Phase 5 completeness, Phase 6 reformat) operate on already-collected data.
    const routerLines = text
      .split('\n')
      .filter((l) => l.trim().startsWith('-') && /Phase\s*2\b|Phase\s*4\b/.test(l));
    expect(routerLines.length).toBeGreaterThan(0);
    for (const line of routerLines) {
      expect(line).toMatch(/Phase[\s−–-]*1/);
    }
  });

  test('non-personal / tooling paths are explicitly exempt (capability preserved)', () => {
    expect(text).toMatch(/non-personal/i);
    expect(text).toMatch(/diagnose/i);
  });
});
