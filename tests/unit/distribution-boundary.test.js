const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const workflow = yaml.load(
  fs.readFileSync(path.join(root, '.github/workflows/publish-distribution.yml'), 'utf8')
);
const rules = workflow.jobs['publish-distribution'].env;
const directories = rules.SCRUB_DIRS.trim().split(/\s+/);
const files = new Set(rules.SCRUB_FILES.trim().split(/\s+/));

test('the release scrub covers every maintainer adapter declared by the registry', () => {
  const registry = yaml.load(fs.readFileSync(path.join(root, 'registry.yaml'), 'utf8'));
  const maintainerFiles = new Set([
    registry.targets.spine,
    ...registry.targets.adapters.map((adapter) => adapter.file),
  ]);
  const uncovered = [...maintainerFiles].filter(
    (file) => !files.has(file) && !directories.some((directory) => file.startsWith(`${directory}/`))
  );
  expect(uncovered).toEqual([]);
});

test('the mirror excludes the Ghostwriter pilot and retains the public evaluations', () => {
  expect(directories).toContain('evals/ghostwriter/benchmark-20261119');
  for (const name of ['humanize-chat', 'review-meaning']) {
    const spec = `evals/ghostwriter/${name}/eval.yaml`;
    expect(directories.some((directory) => spec.startsWith(`${directory}/`))).toBe(false);
    expect(files.has(spec)).toBe(false);
    expect(fs.existsSync(path.join(root, spec))).toBe(true);
  }
});
