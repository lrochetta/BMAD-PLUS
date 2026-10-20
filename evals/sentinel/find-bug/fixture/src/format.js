'use strict';

/**
 * Currency formatting helpers.
 */
function formatPrice(cents, currency = 'EUR', locale = 'fr-FR') {
  if (!Number.isInteger(cents)) {
    throw new TypeError('cents must be an integer');
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

module.exports = { formatPrice };
