/**
 * Compatibility entry for IDE metadata. Rendering lives in the registry generator.
 * Author: Laurent Rochetta
 */
const adapters = require('../../build/generate-adapters');

module.exports = {
  get IDE_CONFIGS() {
    return adapters.IDE_CONFIGS;
  },
  buildIDEConfigs: adapters.buildIDEConfigs,
};
