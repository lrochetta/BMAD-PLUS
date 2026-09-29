/**
 * Compliance control references: `FRAMEWORK:ID`, e.g. `ISO27001:A.8.28`, `SOC2:CC8.1`,
 * `GDPR:Art.32(1)(b)`. Framework names are the Shield pack's compliance tags. Each framework
 * has a closed grammar built from its published numbering, so a mistyped or invented control
 * is refused instead of travelling into a checklist or an assurance case as if it were real.
 */
'use strict';

const range = (prefix, last) => Array.from({ length: last }, (_, i) => `${prefix}${i + 1}`);

/** ISO/IEC 27001:2022 Annex A: themes 5 to 8 and their control counts. */
const ISO27001 = new Set([
  ...range('A.5.', 37),
  ...range('A.6.', 8),
  ...range('A.7.', 14),
  ...range('A.8.', 34),
]);

/** SOC 2 Trust Services Criteria (2017, revised points of focus 2022). */
const SOC2 = new Set(
  Object.entries({
    CC1: 5,
    CC2: 3,
    CC3: 4,
    CC4: 2,
    CC5: 3,
    CC6: 8,
    CC7: 5,
    CC8: 1,
    CC9: 2,
    A1: 3,
    C1: 2,
    PI1: 5,
    P1: 1,
    P2: 1,
    P3: 2,
    P4: 3,
    P5: 2,
    P6: 7,
    P7: 1,
    P8: 1,
  }).flatMap(([series, last]) => range(`${series}.`, last))
);

/** NIST SP 800-53 Rev. 5: control count per family; enhancements are written `AC-2(1)`. */
const NIST_800_53 = {
  AC: 25,
  AT: 6,
  AU: 16,
  CA: 9,
  CM: 14,
  CP: 13,
  IA: 13,
  IR: 10,
  MA: 7,
  MP: 8,
  PE: 23,
  PL: 11,
  PM: 32,
  PS: 9,
  PT: 8,
  RA: 10,
  SA: 23,
  SC: 51,
  SI: 23,
  SR: 12,
};

/** `Art.N`, optionally a paragraph `(n)` and a point `(x)`, within the act's article count. */
function article(last) {
  const form = /^Art\.([1-9]\d{0,2})(?:\(([1-9]\d?)\)(?:\(([a-z])\))?)?$/;
  return (id) => {
    const match = form.exec(id);
    return Boolean(match) && Number(match[1]) <= last;
  };
}

const FRAMEWORKS = {
  ISO27001: { example: 'A.8.28', valid: (id) => ISO27001.has(id) },
  SOC2: { example: 'CC8.1', valid: (id) => SOC2.has(id) },
  GDPR: { example: 'Art.32(1)(b)', valid: article(99) },
  'EU-AI-Act': { example: 'Art.50', valid: article(113) },
  NIS2: { example: 'Art.21(2)(d)', valid: article(46) },
  'NIST-800-53': {
    example: 'AC-6(1)',
    valid: (id) => {
      const match = /^([A-Z]{2})-([1-9]\d?)(?:\(([1-9]\d?)\))?$/.exec(id);
      return Boolean(match) && Number(match[2]) <= (NIST_800_53[match[1]] || 0);
    },
  },
};

const REF = /^([A-Za-z0-9-]{2,20}):(\S{1,40})$/;

/**
 * Check one reference. Returns the reference split into framework and id, or throws with
 * the reason and the accepted form.
 */
function parseControl(ref) {
  const match = typeof ref === 'string' ? REF.exec(ref) : null;
  if (!match) throw new Error(`"${ref}" is not a control reference (FRAMEWORK:ID)`);
  const [, framework, id] = match;
  const grammar = FRAMEWORKS[framework];
  if (!grammar)
    throw new Error(
      `"${ref}": no control catalog for ${framework} (${Object.keys(FRAMEWORKS).join(', ')})`
    );
  if (!grammar.valid(id))
    throw new Error(
      `"${ref}" names no ${framework} control (e.g. ${framework}:${grammar.example})`
    );
  return { framework, id };
}

/** A list of references: each valid, none repeated. Returns the list unchanged. */
function parseControls(list, where) {
  if (!Array.isArray(list) || !list.length)
    throw new Error(`${where}: controls must be a non-empty list of FRAMEWORK:ID references`);
  const seen = new Set();
  for (const ref of list) {
    try {
      parseControl(ref);
    } catch (error) {
      throw new Error(`${where}: ${error.message}`, { cause: error });
    }
    if (seen.has(ref)) throw new Error(`${where}: control ${ref} is listed twice`);
    seen.add(ref);
  }
  return [...list];
}

module.exports = { FRAMEWORKS, parseControl, parseControls };
