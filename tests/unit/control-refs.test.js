/** Compliance control references: closed grammars checked against the Shield references. */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { FRAMEWORKS, parseControl, parseControls } = require('../../tools/cli/lib/control-refs');

const root = path.resolve(__dirname, '../..');
const references = path.join(root, 'src/bmad-plus/packs/pack-shield/references');
const read = (file) => fs.readFileSync(path.join(references, file), 'utf8');

describe('control references', () => {
  it('accept real controls of every catalogued framework', () => {
    for (const ref of [
      'ISO27001:A.5.1',
      'ISO27001:A.5.37',
      'ISO27001:A.8.34',
      'SOC2:CC8.1',
      'SOC2:PI1.5',
      'SOC2:P6.7',
      'GDPR:Art.5(1)(c)',
      'GDPR:Art.99',
      'EU-AI-Act:Art.113',
      'NIS2:Art.21(2)(d)',
      'NIST-800-53:AC-6(1)',
      'NIST-800-53:SC-51',
    ])
      expect(parseControl(ref)).toEqual({
        framework: ref.slice(0, ref.indexOf(':')),
        id: ref.slice(ref.indexOf(':') + 1),
      });
  });

  it('refuse invented, out-of-range and malformed controls with the reason', () => {
    const refused = {
      'ISO27001:A.8.35': /names no ISO27001 control/,
      'ISO27001:A.9.1': /names no ISO27001 control/,
      'ISO27001:A.12.4.1': /names no ISO27001 control/,
      'SOC2:CC10.1': /names no SOC2 control/,
      'GDPR:Art.100': /names no GDPR control/,
      'GDPR:Art.0': /names no GDPR control/,
      'GDPR:Article 32': /not a control reference/,
      'NIS2:Art.47': /names no NIS2 control/,
      'NIST-800-53:AC-26': /names no NIST-800-53 control/,
      'NIST-800-53:XY-1': /names no NIST-800-53 control/,
      'HIPAA:164.312': /no control catalog for HIPAA/,
      'A.8.28': /not a control reference/,
    };
    for (const [ref, reason] of Object.entries(refused))
      expect(() => parseControl(ref)).toThrow(reason);
    expect(() => parseControl(42)).toThrow(/not a control reference/);
  });

  it('refuse an empty list and a repeated control', () => {
    expect(() => parseControls([], 'rule x')).toThrow(/rule x: controls must be a non-empty/);
    expect(() => parseControls('SOC2:CC8.1', 'rule x')).toThrow(/non-empty list/);
    expect(() => parseControls(['SOC2:CC8.1', 'SOC2:CC8.1'], 'rule x')).toThrow(/listed twice/);
    expect(parseControls(['SOC2:CC8.1', 'GDPR:Art.32'], 'rule x')).toEqual([
      'SOC2:CC8.1',
      'GDPR:Art.32',
    ]);
  });
});

describe('the catalogs match what Shield ships', () => {
  it('name only frameworks the Shield pack tags', () => {
    const registry = yaml.load(fs.readFileSync(path.join(root, 'registry.yaml'), 'utf8'));
    const tags = registry.packs.shield.compliance_tags;
    for (const framework of Object.keys(FRAMEWORKS)) expect(tags).toContain(framework);
  });

  it('accept every ISO 27001:2022 Annex A control of the reference, and no other', () => {
    const ids = [...read('iso27001/annex-a-2022.md').matchAll(/^\| (A\.[5-8]\.\d+) \|/gm)].map(
      (m) => m[1]
    );
    expect(ids).toHaveLength(93);
    for (const id of ids) expect(() => parseControl(`ISO27001:${id}`)).not.toThrow();
    expect(() => parseControl('ISO27001:A.5.38')).toThrow();
  });

  it('accept every SOC 2 criterion the reference numbers', () => {
    const ids = [...read('soc2/controls.md').matchAll(/^\| ((?:CC|A|C|PI)\d\.\d) \|/gm)].map(
      (m) => m[1]
    );
    expect(ids.length).toBeGreaterThanOrEqual(40);
    for (const id of ids) expect(() => parseControl(`SOC2:${id}`)).not.toThrow();
  });

  it('know every NIST 800-53 family the reference describes', () => {
    const families = [
      ...read('nist-800-53/control-families.md').matchAll(/^## ([A-Z]{2}) — /gm),
    ].map((m) => m[1]);
    expect(families).toHaveLength(20);
    for (const family of families)
      expect(() => parseControl(`NIST-800-53:${family}-1`)).not.toThrow();
  });
});
