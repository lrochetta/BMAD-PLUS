/**
 * Dependabot may only open minor bumps of the MCP server's ML stack when the
 * functional smoke that validates them actually runs in CI.
 */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const load = (file) => yaml.load(fs.readFileSync(path.join(root, file), 'utf8'));

// Packages that break across minors (see mcp-server/requirements.txt).
const ML_STACK = ['mcp', 'chromadb', 'sentence-transformers', 'torch'];
const MINOR = 'version-update:semver-minor';

function smokeJob(workflow) {
  return Object.entries(workflow.jobs).find(([, job]) =>
    (job.steps || []).some((step) => /\bsmoke\/smoke\.py\b/.test(step.run || ''))
  );
}

function mcpServerIgnores(config) {
  const entry = config.updates.find(
    (update) => update['package-ecosystem'] === 'pip' && update.directory === '/mcp-server'
  );
  return new Map(
    (entry.ignore || []).map((rule) => [rule['dependency-name'], rule['update-types'] || []])
  );
}

describe('MCP server dependency gate', () => {
  const [jobId, job] = smokeJob(load('.github/workflows/ci.yml')) || [];
  const ignores = mcpServerIgnores(load('.github/dependabot.yml'));

  it('finds the CI job that runs the functional smoke', () => {
    expect(jobId).toBe('mcp-server-image');
  });

  it('keeps minor ML updates ignored while that job is conditional', () => {
    const smokeAlwaysRuns = job.if === undefined;
    for (const name of ML_STACK) {
      expect({ name, ignored: ignores.get(name) || [] }).toEqual({
        name,
        ignored: smokeAlwaysRuns ? expect.any(Array) : expect.arrayContaining([MINOR]),
      });
    }
  });
});
