function createLookup(read) {
  const values = new Map();
  return (key) => {
    if (values.get(key)) return values.get(key);
    const value = read(key);
    values.set(key, value);
    return value;
  };
}

module.exports = { createLookup };
