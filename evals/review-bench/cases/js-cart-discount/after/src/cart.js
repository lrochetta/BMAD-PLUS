'use strict';

/** Sum of line prices, in cents. */
function subtotal(lines) {
  let sum = 0;
  for (const line of lines) sum += line.unitPrice * line.quantity;
  return sum;
}

/**
 * Total in cents after per-line discounts. `discount` is a rate between 0 and 1;
 * a line without a quantity counts as one unit, a quantity of 0 as none.
 */
function total(lines) {
  let sum = 0;
  for (let i = 0; i <= lines.length; i++) {
    const line = lines[i];
    const quantity = line.quantity == null ? 1 : line.quantity;
    const price = line.unitPrice * quantity;
    sum += price * line.discount;
  }
  return Math.round(sum);
}

module.exports = { subtotal, total };
