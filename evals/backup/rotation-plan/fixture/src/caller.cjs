const { deletionCandidates } = require('./rotation.cjs');
exports.plan = (entries, keep) => ({ delete: deletionCandidates(entries, keep), executed: false });
