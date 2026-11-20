/** Build-time Python delivery checks; the npm contract repeats them on the archive. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function portable(file) {
  return (
    typeof file === 'string' &&
    Boolean(file) &&
    !/[\\:\0*?![\]{}]/.test(file) &&
    file.split('/').every((part) => part && part !== '.' && part !== '..')
  );
}

function checkPythonDelivery(registry, { packageRoot, packageJson }) {
  const errors = [];
  const roots = (packageJson.files || []).map((root) => root.replace(/\/$/, ''));
  for (const [id, pack] of Object.entries(registry.packs)) {
    if (!pack.runtime.includes('python')) continue;
    if (!portable(pack.python_package)) {
      errors.push(`${id}: python_package must name a portable package directory`);
      continue;
    }
    const resources = [`${pack.python_package}/requirements.txt`];
    if (pack.python_entry !== undefined) {
      if (!portable(pack.python_entry)) {
        errors.push(`${id}: python_entry must remain inside python_package`);
        continue;
      }
      resources.push(`${pack.python_package}/${pack.python_entry}`);
    }
    for (const file of resources) {
      if (!roots.some((root) => portable(root) && (file === root || file.startsWith(`${root}/`)))) {
        errors.push(`${id}: ${file} is outside package.json files roots`);
      }
      try {
        const target = path.join(packageRoot, file);
        if (!fs.lstatSync(target).isFile()) throw new Error('not a regular file');
        const relative = path.relative(fs.realpathSync(packageRoot), fs.realpathSync(target));
        if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
          throw new Error('outside package');
      } catch {
        errors.push(`${id}: ${file} is missing or is not a regular file inside the package`);
      }
    }
  }
  return errors;
}

function checkSeoMirror(packageRoot) {
  const shipped = path.join(packageRoot, 'src/bmad-plus/packs/pack-seo');
  const tested = path.join(packageRoot, 'oveanet-pack/seo-audit-360');
  const files = (root) =>
    fs
      .readdirSync(path.join(root, 'scripts'))
      .filter((file) => file.endsWith('.py'))
      .sort();
  const shippedFiles = files(shipped);
  const testedFiles = files(tested);
  const errors = [];
  if (JSON.stringify(shippedFiles) !== JSON.stringify(testedFiles))
    errors.push('SEO script inventory differs between shipped and tested sources');
  for (const file of ['requirements.txt', ...shippedFiles.map((file) => `scripts/${file}`)]) {
    try {
      if (
        !fs.readFileSync(path.join(shipped, file)).equals(fs.readFileSync(path.join(tested, file)))
      ) {
        errors.push(`SEO shipped/tested sources differ: ${file}`);
      }
    } catch {
      errors.push(`SEO shipped/tested source is missing: ${file}`);
    }
  }
  return errors;
}

module.exports = { checkPythonDelivery, checkSeoMirror };
