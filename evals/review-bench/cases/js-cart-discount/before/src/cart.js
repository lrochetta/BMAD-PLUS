'use strict';

/** Sum of line prices, in cents. */
function subtotal(lines) {
  let sum = 0;
  for (const line of lines) sum += line.unitPrice * line.quantity;
  return sum;
}

module.exports = { subtotal };
