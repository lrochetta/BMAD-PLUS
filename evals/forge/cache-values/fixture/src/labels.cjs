const { createLookup } = require('./cache.cjs');

function createLabelPicker(read) {
  const lookup = createLookup(read);
  return (id) => ({ id, label: lookup(id) });
}

module.exports = { createLabelPicker };
