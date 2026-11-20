#!/usr/bin/env node
/**
 * BMAD+ Build — role triggers must reference real things (core-orchestration §6).
 *
 * `src/bmad-plus/data/role-triggers.yaml` tells the host when to switch roles. A
 * trigger that names an agent nobody ships, a persona a pack does not have or a
 * pipeline that does not exist is dead weight at best and a wrong activation at
 * worst, so every key is resolved against registry.yaml:
 *   - a top-level key is a Core agent short name (its id without `agent-`) or a pack id;
 *   - `default_role` is one of the key's `auto_triggers`;
 *   - each role has a non-empty `patterns` list of non-empty strings; `contexts` and
 *     `reasoning`, when present, are lists of snake_case identifiers;
 *   - under a pack key, each role is a persona id of that pack or one of its pipeline ids;
 *   - an exact pattern repeated across two roles of one key is an error.
 *
 * Usage:
 *   node tools/build/check-triggers.js            # exit 1 on any problem
 *   node tools/build/check-triggers.js --json     # machine-readable report
 *
 * Author: Laurent Rochetta
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { loadRegistry, DEFAULT_REGISTRY_PATH } = require('./generate');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_TRIGGERS_PATH = path.join(
  REPO_ROOT,
  'src',
  'bmad-plus',
  'data',
  'role-triggers.yaml'
);
const CORE_PACK = 'core';
const AGENT_PREFIX = 'agent-';
const IDENTIFIER_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const ROLE_KEYS = new Set(['patterns', 'contexts', 'reasoning']);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Core agent short names: the ids of the required pack without their `agent-` prefix. */
function coreShortNames(registry) {
  const core = registry.packs[CORE_PACK];
  return new Set(
    (core ? core.agents : [])
      .filter((id) => id.startsWith(AGENT_PREFIX))
      .map((id) => id.slice(AGENT_PREFIX.length))
  );
}

function checkRole(key, roleId, role, problems) {
  const where = `${key}.${roleId}`;
  if (!isPlainObject(role)) {
    problems.push(`${where}: must be a mapping`);
    return;
  }
  for (const field of Object.keys(role)) {
    if (!ROLE_KEYS.has(field)) problems.push(`${where}: unknown field "${field}"`);
  }
  if (
    !Array.isArray(role.patterns) ||
    role.patterns.length === 0 ||
    role.patterns.some((pattern) => typeof pattern !== 'string' || pattern.trim() === '')
  ) {
    problems.push(`${where}: patterns must be a non-empty list of non-empty strings`);
  }
  for (const field of ['contexts', 'reasoning']) {
    if (role[field] === undefined) continue;
    if (
      !Array.isArray(role[field]) ||
      role[field].some((item) => typeof item !== 'string' || !IDENTIFIER_RE.test(item))
    ) {
      problems.push(`${where}: ${field} must be a list of snake_case identifiers`);
    }
  }
}

/**
 * Validate parsed triggers against a loaded registry.
 * @returns {{ ok: boolean, problems: string[] }}
 */
function checkTriggers(triggers, registry) {
  const problems = [];
  if (!isPlainObject(triggers)) return { ok: false, problems: ['triggers: must be a mapping'] };
  const shortNames = coreShortNames(registry);
  for (const [key, block] of Object.entries(triggers)) {
    const pack = registry.packs[key];
    if (!shortNames.has(key) && !pack) {
      problems.push(`${key}: neither a Core agent short name nor a pack id`);
      continue;
    }
    if (!isPlainObject(block)) {
      problems.push(`${key}: must be a mapping`);
      continue;
    }
    for (const field of Object.keys(block)) {
      if (field !== 'default_role' && field !== 'auto_triggers')
        problems.push(`${key}: unknown field "${field}"`);
    }
    const roles = block.auto_triggers;
    if (!isPlainObject(roles) || Object.keys(roles).length === 0) {
      problems.push(`${key}: auto_triggers must be a non-empty mapping of roles`);
      continue;
    }
    if (typeof block.default_role !== 'string' || !Object.hasOwn(roles, block.default_role)) {
      problems.push(`${key}: default_role must name one of its auto_triggers`);
    }
    const allowed = pack
      ? new Set([
          ...(pack.personas || []).map((persona) => persona.id),
          ...(pack.pipelines || []).map((pipeline) => pipeline.id),
        ])
      : null;
    const seen = new Map();
    for (const [roleId, role] of Object.entries(roles)) {
      if (allowed && !allowed.has(roleId)) {
        problems.push(`${key}.${roleId}: not a persona or pipeline id of pack "${key}"`);
      }
      checkRole(key, roleId, role, problems);
      if (!isPlainObject(role) || !Array.isArray(role.patterns)) continue;
      for (const pattern of role.patterns) {
        if (typeof pattern !== 'string') continue;
        const owner = seen.get(pattern);
        if (owner === undefined) seen.set(pattern, roleId);
        else if (owner === roleId)
          problems.push(`${key}.${roleId}: pattern "${pattern}" is listed twice`);
        else
          problems.push(`${key}: pattern "${pattern}" is claimed by both ${owner} and ${roleId}`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Load both files and check; never throws on a trigger problem, only on unreadable input. */
function check({
  triggersPath = DEFAULT_TRIGGERS_PATH,
  registryPath = DEFAULT_REGISTRY_PATH,
} = {}) {
  const registry = loadRegistry(registryPath);
  const triggers = yaml.load(fs.readFileSync(triggersPath, 'utf8'), { schema: yaml.JSON_SCHEMA });
  const result = checkTriggers(triggers, registry);
  return { file: path.relative(REPO_ROOT, triggersPath).split(path.sep).join('/'), ...result };
}

function main(argv) {
  const args = argv.slice(2);
  const result = check();
  if (args.includes('--json')) {
    console.log(
      JSON.stringify({ schemaVersion: 1, status: result.ok ? 'ok' : 'invalid', ...result }, null, 2)
    );
    return result.ok ? 0 : 1;
  }
  if (result.ok) {
    console.log(
      `OK — ${result.file} references only agents, personas and pipelines of registry.yaml.`
    );
    return 0;
  }
  console.error(`TRIGGER DRIFT — ${result.file} names things registry.yaml does not declare:`);
  for (const problem of result.problems) console.error(`  - ${problem}`);
  return 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = { DEFAULT_TRIGGERS_PATH, coreShortNames, checkTriggers, check, main };
