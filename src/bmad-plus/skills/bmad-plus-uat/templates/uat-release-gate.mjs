#!/usr/bin/env node
/**
 * Gate G3 — production waits for a human run that was read and classified.
 *
 * Resolves the recipe covering the version in package.json, then runs
 * `bmad-plus uat gate` on it. Exit 0 only when the gate passes: a finished run,
 * answering the current revision of the recipe, with every failure classified and
 * every writing step confirmed read-only.
 *
 *   node scripts/uat-release-gate.mjs
 *   node scripts/uat-release-gate.mjs --id myproduct-1.4.0
 *   node scripts/uat-release-gate.mjs --cli node_modules/bmad-plus/tools/cli/bmad-plus-cli.js
 *   BMAD_PLUS_CLI=/path/to/bmad-plus-cli.js node scripts/uat-release-gate.mjs
 *
 * Exit codes mirror the command: 0 passed · 1 failed · 2 awaiting a run ·
 * 3 the run answered another revision · 4 the gate could not be run at all.
 *
 * The gate establishes that the run is complete, current and classified. It never
 * establishes that the tester looked at the right place: that stays human-observed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const root = path.resolve(option('project', process.cwd()));
const directory = option('dir', '_bmad-output/uat');
const specs = path.join(root, directory, 'specs');

function resolveId() {
  const explicit = option('id', null);
  if (explicit) return explicit;
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) throw new Error(`no package.json in ${root}; pass --id <recipe>`);
  const version = JSON.parse(fs.readFileSync(file, 'utf8')).version;
  if (!fs.existsSync(specs)) throw new Error(`no recipe folder at ${specs}`);
  const covering = fs
    .readdirSync(specs)
    .filter((name) => name.endsWith('.json'))
    .filter((name) => {
      try {
        const spec = JSON.parse(fs.readFileSync(path.join(specs, name), 'utf8'));
        return Array.isArray(spec.versions) && spec.versions.includes(version);
      } catch {
        return false;
      }
    });
  if (covering.length !== 1) {
    throw new Error(
      covering.length
        ? `${covering.length} recipes name ${version}; pass --id to choose one`
        : `no recipe names ${version}; write it before deploying`
    );
  }
  return covering[0].replace(/\.json$/, '');
}

/**
 * The CLI's own entry point, run by this Node: an explicit one, or the copy
 * installed in the project. Never a shell, never `npx` — a `.cmd` shim cannot be
 * spawned without a shell on Windows, and a gate must not depend on a download.
 */
function command() {
  const candidates = [
    option('cli', null),
    process.env.BMAD_PLUS_CLI,
    path.join(root, 'node_modules', 'bmad-plus', 'tools', 'cli', 'bmad-plus-cli.js'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(root, candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  throw new Error(
    'no BMAD+ CLI to run the gate with. Install bmad-plus in this project ' +
      '(npm install --save-dev bmad-plus) or set BMAD_PLUS_CLI to its bmad-plus-cli.js. ' +
      'A missing gate is not a passing gate.'
  );
}

try {
  const id = resolveId();
  const cli = command();
  const child = spawnSync(
    process.execPath,
    [cli, 'uat', 'gate', id, '--directory', root, '--dir', directory, '--json'],
    { encoding: 'utf8', timeout: 120000, windowsHide: true }
  );

  // The verdict is read from the gate's own answer, not guessed from an exit code:
  // a CLI that never ran also exits non-zero, and that is a different problem.
  let verdict = null;
  try {
    const parsed = JSON.parse(child.stdout);
    if (parsed && typeof parsed.status === 'string') verdict = parsed;
  } catch {
    verdict = null;
  }
  if (!verdict) {
    console.error(
      `uat: the gate could not be run for ${id}` +
        `${child.error ? ` (${child.error.message})` : ''}.\n` +
        `${(child.stdout || '').trim()}${(child.stderr || '').trim()}\n` +
        'Install the CLI in this project, or set BMAD_PLUS_CLI to its path. ' +
        'A missing gate is not a passing gate.'
    );
    process.exit(4);
  }

  const explanation = {
    passed: `${id}: human-observed, complete, current and triaged.`,
    failed: `${id} did not pass its gate — production stays where it is.`,
    awaiting: `${id} has no finished run yet — someone still has to play it.`,
    stale: `${id} was answered on another revision of the recipe — replay the affected steps.`,
  };
  const code = { passed: 0, failed: 1, awaiting: 2, stale: 3 }[verdict.status] ?? 4;
  const report = code === 0 ? console.log : console.error;
  report(explanation[verdict.status] || `${id}: unexpected gate status "${verdict.status}".`);
  for (const reason of verdict.reasons || []) report(`  - ${reason}`);
  process.exit(code);
} catch (error) {
  console.error(`uat: ${error.message}`);
  process.exit(4);
}
