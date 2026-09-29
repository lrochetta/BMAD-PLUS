exports.deletionCandidates = (entries, keep) => entries.slice(0, -keep).map((entry) => entry.path);
