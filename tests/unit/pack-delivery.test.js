const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkPythonDelivery, checkSeoMirror } = require('../../tools/build/pack-delivery');
const { loadRegistry } = require('../../tools/build/generate');

const REPO = path.resolve(__dirname, '../..');
const PACKAGE = require('../../package.json');
let root;

function write(file, content = 'fixture') {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function fixture() {
  return {
    packs: {
      example: {
        runtime: ['node', 'python'],
        python_package: 'src/pack',
        python_entry: 'scripts/entry.py',
      },
    },
  };
}
function check(registry = fixture(), files = ['src']) {
  return checkPythonDelivery(registry, { packageRoot: root, packageJson: { files } });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bmad-delivery-'));
  write('src/pack/requirements.txt');
  write('src/pack/scripts/entry.py');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('every declared Python runtime is reachable in the source package', () => {
  expect(checkPythonDelivery(loadRegistry(), { packageRoot: REPO, packageJson: PACKAGE })).toEqual(
    []
  );
  expect(loadRegistry().packs.memory.runtime).toEqual(['node']);
});

test('requires an explicit package and rejects an unshipped runtime even when it exists locally', () => {
  const registry = fixture();
  delete registry.packs.example.python_package;
  expect(check(registry).join('\n')).toMatch(/python_package/);
  registry.packs.example.python_package = 'mcp-server';
  write('mcp-server/requirements.txt');
  write('mcp-server/scripts/entry.py');
  expect(check(registry)).toHaveLength(2);
  expect(check(registry).every((message) => message.includes('outside package.json'))).toBe(true);
});

test('a files root is a path boundary, not a text prefix', () => {
  expect(check(fixture(), ['sr']).join('\n')).toMatch(/outside package.json/);
  expect(check(fixture(), ['src/'])).toEqual([]);
});

test.each(['../outside.py', '/absolute.py', 'scripts\\entry.py', 'C:/outside.py'])(
  'rejects entry escape %s',
  (entry) => {
    const registry = fixture();
    registry.packs.example.python_entry = entry;
    expect(check(registry).join('\n')).toMatch(/inside python_package/);
  }
);

test('a missing archive entry fails even if its declared files root is present', () => {
  fs.unlinkSync(path.join(root, 'src/pack/scripts/entry.py'));
  expect(check().join('\n')).toMatch(/entry.py is missing/);
  fs.mkdirSync(path.join(root, 'src/pack/scripts/entry.py'));
  expect(check().join('\n')).toMatch(/not a regular file/);
});

test('shipped SEO matches the tested toolkit and requirements', () => {
  expect(checkSeoMirror(REPO)).toEqual([]);
});

test('a one-byte change or added script in either SEO source fails the mirror gate', () => {
  for (const prefix of ['src/bmad-plus/packs/pack-seo', 'oveanet-pack/seo-audit-360']) {
    write(`${prefix}/requirements.txt`, 'requests==1\n');
    write(`${prefix}/scripts/seo_fetch.py`, 'x');
  }
  expect(checkSeoMirror(root)).toEqual([]);
  write('src/bmad-plus/packs/pack-seo/scripts/seo_fetch.py', 'y');
  expect(checkSeoMirror(root).join('\n')).toMatch(/seo_fetch.py/);
  write('src/bmad-plus/packs/pack-seo/scripts/seo_fetch.py', 'x');
  write('oveanet-pack/seo-audit-360/scripts/new.py');
  expect(checkSeoMirror(root).join('\n')).toMatch(/inventory differs/);
});
