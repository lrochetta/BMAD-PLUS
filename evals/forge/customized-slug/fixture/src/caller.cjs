const { slug } = require('./slug.cjs');
exports.documentKey = (name) => 'notes/' + slug(name) + '.md';
