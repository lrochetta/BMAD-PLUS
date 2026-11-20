'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => JSON.parse(fs.readFileSync(path.join(process.argv[2], name), 'utf8'));
const source = read('source.json');
const proposals = read('candidates.json');
const report = read('review.json');

// These pairs anchor the defect to the changed clause. Quoting the whole sentence
// or a shorter excerpt that shows the changed meaning both satisfy the exercise.
const expected = {
  merle: { 'eligibility-bound': ['plus de 18', 'jusqu’à 18'] },
  chene: {},
  silex: { 'unsupported-price': ['tarif de l’intervention reste à fixer', 'l’intervention sont gratuits'] },
  roseau: { 'protected-variable': ['{atelier_id}', '{site_id}'] },
  lin: {
    'commitment-strength': ['peut proposer', 'secrétariat propose'],
    'eligibility-condition': ['dossier complet', 'même si le dossier est incomplet'],
  },
};

assert.equal(report.external_verification, 'not-performed');
assert.ok(Array.isArray(report.reviews), 'reviews must be an array');
assert.deepEqual(report.reviews.map((row) => row.id).sort(), Object.keys(expected).sort(),
  'cover each proposal exactly once');

for (const { id, unit, decision, findings } of report.reviews) {
  const candidate = proposals[id];
  assert.equal(unit, candidate.unit, `${id}: review the correct source clause`);
  const issues = expected[id];
  const codes = Object.keys(issues);
  assert.equal(decision, codes.length === 0 ? 'keep' : 'revise', `${id}: wrong editorial decision`);
  assert.ok(Array.isArray(findings), `${id}: missing findings array`);
  assert.deepEqual(findings.map((item) => item.code).sort(), codes.sort(),
    `${id}: issue coverage`);

  for (const { code, source_quote, candidate_quote } of findings) {
    const [sourceAnchor, candidateAnchor] = issues[code];
    for (const [quote, sentence, anchor] of [
      [source_quote, source[unit], sourceAnchor],
      [candidate_quote, candidate.text, candidateAnchor],
    ]) {
      assert.equal(typeof quote, 'string', `${id} ${code}: missing quote`);
      assert.ok(sentence.includes(quote) && quote.toLowerCase().includes(anchor),
        `${id} ${code}: quote the changed meaning from the corresponding clause`);
    }
  }
}
