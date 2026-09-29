const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { listPackFiles, copyPackFiles } = require('../../tools/cli/lib/pack-copy');

test('running a Python pack locally does not install or claim interpreter caches', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-pack-cache-'));
  try {
    const source = path.join(root, 'source', 'packs', 'fixture');
    const projectDir = path.join(root, 'consumer');
    fs.mkdirSync(path.join(source, 'scripts', '__pycache__'), { recursive: true });
    fs.writeFileSync(path.join(source, 'SKILL.md'), '# Fixture\n');
    fs.writeFileSync(path.join(source, 'scripts', 'run.py'), 'print("source")\n');
    fs.writeFileSync(
      path.join(source, 'scripts', '__pycache__', 'run.cpython-314.pyc'),
      'local bytecode'
    );
    fs.writeFileSync(path.join(source, 'scripts', 'legacy.pyc'), 'legacy bytecode');
    fs.writeFileSync(path.join(source, 'scripts', 'legacy.pyo'), 'optimized bytecode');
    const inventory = {};
    const options = {
      bmadSrc: path.join(root, 'source'),
      projectRoot: root,
      projectDir,
      targetAgentsDir: path.join(projectDir, '.agents', 'skills'),
      targetDataDir: path.join(projectDir, '.agents', 'data'),
      pack: { packDir: 'fixture', packSrcDir: 'packs' },
      inventory,
    };
    expect(listPackFiles(options).files).toHaveLength(2);
    copyPackFiles(options);
    expect(Object.keys(inventory)).toEqual([
      '.agents/skills/fixture/SKILL.md',
      '.agents/skills/fixture/scripts/run.py',
    ]);
    expect(fs.readdirSync(path.join(projectDir, '.agents/skills/fixture/scripts'))).toEqual([
      'run.py',
    ]);
    expect(
      fs.readFileSync(path.join(source, 'scripts/__pycache__/run.cpython-314.pyc'), 'utf8')
    ).toBe('local bytecode');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
