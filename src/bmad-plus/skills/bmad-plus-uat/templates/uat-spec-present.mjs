#!/usr/bin/env node
/**
 * Gate G1 — a version does not leave without saying what a person must check.
 *
 * Fails when no acceptance recipe covers the version in package.json. Copy this
 * file into your project and run it wherever your other checks run: a pre-push
 * hook, a test script, a CI step. It needs nothing but Node.
 *
 *   node scripts/uat-spec-present.mjs
 *   node scripts/uat-spec-present.mjs --version 1.4.0 --dir _bmad-output/uat --json
 *
 * Exit 0 when a recipe covers the version, 1 otherwise. A reminder printed after
 * a deployment protects nothing; this one runs before.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const json = args.includes('--json');
const root = path.resolve(option('project', process.cwd()));
const directory = path.resolve(root, option('dir', '_bmad-output/uat'));

function projectVersion() {
  const explicit = option('version', null);
  if (explicit) return explicit;
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) {
    throw new Error(`no package.json in ${root}; pass --version <x.y.z>`);
  }
  const version = JSON.parse(fs.readFileSync(file, 'utf8')).version;
  if (!version) throw new Error('package.json declares no version');
  return version;
}

/** Recipes that name this version, whether they cover one version or a campaign. */
function covering(version) {
  const specs = path.join(directory, 'specs');
  if (!fs.existsSync(specs)) return [];
  return fs
    .readdirSync(specs)
    .filter((name) => name.endsWith('.json'))
    .filter((name) => {
      try {
        const spec = JSON.parse(fs.readFileSync(path.join(specs, name), 'utf8'));
        // A grouped recipe covers a version because it NAMES it, never because its
        // file name suggests a range.
        return Array.isArray(spec.versions) && spec.versions.includes(version);
      } catch {
        return false;
      }
    })
    .map((name) => name.replace(/\.json$/, ''));
}

try {
  const version = projectVersion();
  const found = covering(version);
  if (json) {
    console.log(JSON.stringify({ version, directory, covering: found, ok: found.length > 0 }, null, 2));
  } else if (found.length) {
    console.log(`uat: ${version} is covered by ${found.join(', ')}`);
  } else {
    console.error(
      `uat: no acceptance recipe covers ${version}.\n` +
        `Write ${path.relative(root, path.join(directory, 'specs'))}/<product>-${version}.json before shipping,\n` +
        `or add ${version} to the versions of a grouped recipe. Ask your agent: "write the recette for this delivery".`
    );
  }
  process.exit(found.length ? 0 : 1);
} catch (error) {
  console.error(`uat: ${error.message}`);
  process.exit(1);
}
