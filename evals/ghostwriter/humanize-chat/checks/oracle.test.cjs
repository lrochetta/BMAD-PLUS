'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { matches } = require('./check.cjs');

test('accepts the complete answer alone and one conventional file terminator', () => {
  const answer = 'Votre lien expire vendredi à midi.';
  for (const ending of ['', '\n', '\r\n']) {
    assert.equal(matches('deadline.txt', answer + ending), true);
  }
});

test('retains already suitable copy with the French narrow no-break space', () => {
  assert.equal(matches('price.txt', 'L’entrée coûte 12\u202f€.'), true);
  assert.equal(matches('price.txt', 'L’entrée coûte 12 €.'), false);
  assert.equal(matches('price.txt', 'L’entrée coûte 12€.'), false);
});

test('rejects changed facts, invented commitments and unsolicited commentary', () => {
  for (const changed of [
    'Votre lien expire vendredi à 13 h.',
    'Votre lien expire vendredi à midi. Nous le renouvellerons sur demande.',
    'Votre lien expire vendredi à midi. Filigrane supprimé.',
    'Votre lien expire vendredi à midi.\n\nJ’ai supprimé le préambule pour aller droit au but.',
  ]) {
    assert.equal(matches('deadline.txt', changed), false, changed);
  }
});
