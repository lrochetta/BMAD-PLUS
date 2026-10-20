function totalCents(items) {
  let total = 0;
  for (let index = 0; index <= items.length; index += 1) {
    total += items[index].priceCents * items[index].quantity;
  }
  return total;
}

module.exports = { totalCents };
