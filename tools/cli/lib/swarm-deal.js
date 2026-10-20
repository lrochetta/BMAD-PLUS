/** Deterministic dealing: the same profile, n and seed give the same cards, on any platform. */
'use strict';

const crypto = require('node:crypto');

const WORD = 2 ** 32;

/** A counter-mode generator over SHA-256: the stream depends on the seed alone. */
class Dealer {
  constructor(seed) {
    this.seed = String(seed);
    this.block = 0;
    this.words = [];
  }

  next() {
    if (!this.words.length) {
      const digest = crypto
        .createHash('sha256')
        .update(this.seed + ':' + this.block)
        .digest();
      this.block += 1;
      for (let offset = 0; offset < digest.length; offset += 4)
        this.words.push(digest.readUInt32BE(offset));
    }
    return this.words.shift();
  }

  /** Uniform integer in [0, n): values above the last full cycle are rejected, never folded. */
  below(n) {
    const limit = WORD - (WORD % n);
    let value = this.next();
    while (value >= limit) value = this.next();
    return value % n;
  }

  between(low, high) {
    if (Number.isInteger(low) && Number.isInteger(high)) return low + this.below(high - low + 1);
    return Math.round((low + (this.next() / WORD) * (high - low)) * 100) / 100;
  }

  shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const other = this.below(index + 1);
      [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
  }
}

/** Largest-remainder quotas: the counts add up to n exactly and follow the shares. */
function quotas(shares, n) {
  const exact = shares.map((share) => share * n);
  const counts = exact.map((value) => Math.floor(value));
  let left = n - counts.reduce((sum, count) => sum + count, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left === 0) break;
    counts[index] += 1;
    left -= 1;
  }
  return counts;
}

function unitId(prefix, position, n) {
  return prefix + String(position).padStart(Math.max(3, String(n).length), '0');
}

function dealCards(profile, n, seed, idPrefix) {
  const dealer = new Dealer(seed);
  const slots = profile.dimensions.map((dimension) => {
    const counts = quotas(
      dimension.values.map((entry) => entry.share),
      n
    );
    const column = [];
    counts.forEach((count, index) => {
      for (let k = 0; k < count; k += 1) column.push(index);
    });
    return dealer.shuffle(column);
  });
  const cards = [];
  for (let position = 0; position < n; position += 1) {
    const card = { id: unitId(idPrefix, position + 1, n) };
    profile.dimensions.forEach((dimension, index) => {
      const entry = dimension.values[slots[index][position]];
      card[dimension.name] = entry.value;
      // A note is a field of the whole dimension, so every card carries it, empty or not.
      if (dimension.values.some((value) => value.note !== null))
        card[dimension.name + '_note'] = entry.note ?? '';
      for (const [name, [low, high]] of Object.entries(entry.ranges))
        card[name] = dealer.between(low, high);
    });
    for (const [name, [low, high]] of Object.entries(profile.ranges))
      card[name] = dealer.between(low, high);
    for (const [name, pool] of Object.entries(profile.pools))
      card[name] = pool[dealer.below(pool.length)];
    cards.push(card);
  }
  return cards;
}

function listCards(units, idPrefix) {
  const cards = units.map((unit, index) => ({
    ...unit,
    id: unit.id ?? unitId(idPrefix, index + 1, units.length),
  }));
  // Answer files are named by id, and some file systems fold case.
  if (new Set(cards.map((card) => card.id.toLowerCase())).size !== cards.length)
    throw new Error('Swarm: jury unit ids must be distinct once dealt, whatever their case.');
  return cards;
}

module.exports = { Dealer, quotas, unitId, dealCards, listCards };
