const { selectFrame } = require('./motion.cjs');
exports.currentAsset = (progress, assets, options) => {
  const index = selectFrame(progress, assets.length, options);
  return index === null ? 'placeholder' : assets[index];
};
