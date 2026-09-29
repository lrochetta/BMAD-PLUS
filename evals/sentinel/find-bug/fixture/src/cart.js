'use strict';

/**
 * Shopping cart total calculator. Prices are integers in cents.
 * items: Array<{ priceCents: number, quantity: number }>
 * discountPercent: 0..100
 */
function cartTotalCents(items, discountPercent = 0) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].priceCents * items[i].quantity;
  }
  if (discountPercent > 0) {
    total -= (total * discountPercent) / 100;
  }
  return Math.round(total);
}

module.exports = { cartTotalCents };
