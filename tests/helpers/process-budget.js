'use strict';
/**
 * Time and cleanup budgets for suites that start real processes (node, git, npm).
 *
 * Jest's 5 s default assumes in-process work. A test that spawns N children pays
 * N process start-ups, and on Windows each start-up costs far more than on Linux
 * (Defender scans, no fork). Under a loaded machine the same suite blew through
 * fixed 5/25/30 s limits even though every assertion would have passed. The
 * budget therefore scales with the number of processes a test starts, and is
 * never used to relax an assertion: it only bounds how long Jest waits.
 *
 * BMAD_TEST_SPAWN_BUDGET_MS overrides the per-process allowance (e.g. a slow
 * runner or a contended laptop) without editing any suite.
 */
const fs = require('node:fs');

const DEFAULT_SPAWN_BUDGET_MS = process.platform === 'win32' ? 4000 : 2000;
const override = Number(process.env.BMAD_TEST_SPAWN_BUDGET_MS);
const SPAWN_BUDGET_MS =
  Number.isInteger(override) && override > 0 ? override : DEFAULT_SPAWN_BUDGET_MS;

/**
 * Timeout for a test (or hook) that starts at most `spawns` processes.
 * `floor` keeps any limit a suite already had on fast platforms.
 */
function spawnTimeout(spawns, { floor = 5000 } = {}) {
  return Math.max(floor, 5000 + spawns * SPAWN_BUDGET_MS);
}

/**
 * Remove a fixture tree, retrying transient Windows locks (EPERM/EBUSY/ENOTEMPTY
 * while a just-exited child, an indexer or antivirus still holds a handle).
 * Node only retries those codes, so a real permission defect still throws.
 */
function removeTree(directory, { force = false } = {}) {
  fs.rmSync(directory, { recursive: true, force, maxRetries: 10, retryDelay: 200 });
}

module.exports = { SPAWN_BUDGET_MS, spawnTimeout, removeTree };
