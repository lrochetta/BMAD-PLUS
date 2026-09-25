const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

test('the release scrub covers every maintainer adapter declared by the registry', () => {
  const root = path.resolve(__dirname, '../..');
  const registry = yaml.load(fs.readFileSync(path.join(root, 'registry.yaml'), 'utf8'));
  const workflow = yaml.load(
    fs.readFileSync(path.join(root, '.github/workflows/publish-distribution.yml'), 'utf8')
  );
  const rules = workflow.jobs['publish-distribution'].env;
  const directories = rules.SCRUB_DIRS.trim().split(/\s+/);
  const files = new Set(rules.SCRUB_FILES.trim().split(/\s+/));
  const maintainerFiles = new Set([
    registry.targets.spine,
    ...registry.targets.adapters.map((adapter) => adapter.file),
  ]);
  const uncovered = [...maintainerFiles].filter(
    (file) => !files.has(file) && !directories.some((directory) => file.startsWith(`${directory}/`))
  );
  expect(uncovered).toEqual([]);
});
