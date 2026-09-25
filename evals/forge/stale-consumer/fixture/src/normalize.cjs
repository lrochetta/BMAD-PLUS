function normalizeLabel(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('A label is required');
  return value.trim();
}

module.exports = { normalizeLabel };
