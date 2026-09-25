const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  productionGraph,
  productionSbom,
  build,
  verify,
  verifyRegistry,
} = require('../../tools/release/supply-chain');

function fixture() {
  const pkg = { name: 'bmad-plus', version: '1.2.3', dependencies: { direct: '^1', shared: '^2' } };
  const lock = {
    lockfileVersion: 3,
    ...pkg,
    packages: {
      '': { ...pkg, devDependencies: { testing: '^1' } },
      'node_modules/direct': {
        version: '1.0.0',
        dependencies: { shared: '^2' },
        optionalDependencies: { absent: '*' },
      },
      'node_modules/shared': { version: '2.0.0' },
      'node_modules/testing': { version: '1.0.0', dev: true, dependencies: { shared: '^2' } },
    },
  };
  const full = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: { component: { 'bom-ref': 'bmad-plus@1.2.3', purl: 'pkg:npm/bmad-plus@1.2.3' } },
    components: ['direct@1.0.0', 'shared@2.0.0', 'testing@1.0.0'].map((ref) => ({
      'bom-ref': ref,
      name: ref.split('@')[0],
      version: ref.split('@')[1],
    })),
    dependencies: [
      { ref: 'bmad-plus@1.2.3', dependsOn: ['direct@1.0.0', 'shared@2.0.0', 'testing@1.0.0'] },
      { ref: 'direct@1.0.0', dependsOn: ['shared@2.0.0'] },
      { ref: 'shared@2.0.0', dependsOn: [] },
      { ref: 'testing@1.0.0', dependsOn: ['shared@2.0.0'] },
    ],
  };
  return { pkg, lock, full };
}

test('production inventory keeps shared dependencies and excludes development-only packages', () => {
  const { pkg, lock, full } = fixture();
  const result = productionSbom(full, pkg, lock);
  expect(result.components.map((c) => c.name)).toEqual(['direct', 'shared']);
  expect(result.dependencies[0].dependsOn).toEqual(['direct@1.0.0', 'shared@2.0.0']);
});

test.each(['component', 'edge', 'identity', 'duplicate'])(
  'rejects an incomplete or inconsistent SBOM: %s',
  (damage) => {
    const { pkg, lock, full } = fixture();
    if (damage === 'component')
      full.components = full.components.filter((c) => c.name !== 'shared');
    if (damage === 'edge') full.dependencies[1].dependsOn = [];
    if (damage === 'identity') full.metadata.component['bom-ref'] = 'bmad-plus@0.0.0';
    if (damage === 'duplicate') full.dependencies.push(full.dependencies[1]);
    expect(() => productionSbom(full, pkg, lock)).toThrow(/SBOM/);
  }
);

test('resolves nested versions independently and rejects missing required dependencies', () => {
  const { pkg, lock } = fixture();
  lock.packages['node_modules/direct/node_modules/shared'] = { version: '3.0.0' };
  const graph = productionGraph(pkg, lock);
  expect([...graph.get('direct@1.0.0')]).toEqual(['shared@3.0.0']);
  expect(graph.has('shared@2.0.0')).toBe(true);
  delete lock.packages['node_modules/shared'];
  expect(() => productionGraph(pkg, lock)).toThrow(/Missing production dependency/);
});

describe('one archive from build to registry', () => {
  let root;
  let cwd;
  let out;
  let npm;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-release-test-'));
    cwd = path.join(root, 'source');
    out = path.join(root, 'artifacts');
    fs.mkdirSync(cwd);
    const { pkg, lock, full } = fixture();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(cwd, 'package-lock.json'), JSON.stringify(lock));
    npm = jest.fn(async (args) => {
      if (args[0] === 'sbom') return JSON.stringify(full);
      if (args[0] === 'pack') {
        const bytes = Buffer.from('archive produced exactly once by npm');
        fs.writeFileSync(path.join(out, 'bmad-plus-1.2.3.tgz'), bytes);
        return JSON.stringify([
          {
            name: 'bmad-plus',
            version: '1.2.3',
            filename: 'bmad-plus-1.2.3.tgz',
            integrity: 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64'),
            files: ['package.json', 'README.md', 'LICENSE', 'THIRD-PARTY-LICENSES.md'].map(
              (file) => ({ path: file })
            ),
          },
        ]);
      }
      throw new Error('Unexpected npm operation');
    });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('reads the archive report of npm 11 and of npm 12 alike', async () => {
    // npm 11 reports a list; npm 12 reports an object keyed by package name. The
    // release job installs npm@latest, so the build must accept both and still
    // check the same identity.
    const npm12 = jest.fn(async (args) => {
      const reported = await npm(args);
      if (args[0] !== 'pack') return reported;
      const [entry] = JSON.parse(reported);
      return JSON.stringify({ [entry.name]: { id: `${entry.name}@${entry.version}`, ...entry } });
    });
    const manifest = await build({ cwd, out, npm: npm12 });
    expect(manifest.archive.filename).toBe('bmad-plus-1.2.3.tgz');
    expect(verify({ cwd, out })).toEqual(manifest);

    const npmSilent = jest.fn(async (args) =>
      args[0] === 'pack' ? JSON.stringify({}) : npm(args)
    );
    await expect(
      build({ cwd, out: path.join(root, 'artifacts-empty-report'), npm: npmSilent })
    ).rejects.toThrow('npm archive identity mismatch.');
  });

  test('verifies the exact artifact and requires matching registry integrity', async () => {
    const manifest = await build({ cwd, out, npm });
    expect(verify({ cwd, out })).toEqual(manifest);
    expect(npm.mock.calls.filter(([args]) => args[0] === 'pack')).toHaveLength(1);
    await expect(
      verifyRegistry({ cwd, out, npm: async () => JSON.stringify(manifest.archive.integrity) })
    ).resolves.toEqual(manifest);
    await expect(verifyRegistry({ cwd, out, npm: async () => '"sha512-wrong"' })).rejects.toThrow(
      /Published npm integrity/
    );
    await expect(build({ cwd, out, npm })).rejects.toThrow(/empty/);
  });

  test.each(['archive', 'sbom', 'lockfile', 'filename'])(
    'refuses changed release evidence: %s',
    async (damage) => {
      await build({ cwd, out, npm });
      if (damage === 'archive') fs.appendFileSync(path.join(out, 'bmad-plus-1.2.3.tgz'), 'changed');
      if (damage === 'sbom') fs.appendFileSync(path.join(out, 'sbom.cdx.json'), ' ');
      if (damage === 'lockfile') fs.appendFileSync(path.join(cwd, 'package-lock.json'), ' ');
      if (damage === 'filename') {
        const file = path.join(out, 'release-manifest.json');
        const data = JSON.parse(fs.readFileSync(file));
        data.archive.filename = '../outside.tgz';
        fs.writeFileSync(file, JSON.stringify(data));
      }
      expect(() => verify({ cwd, out })).toThrow(/changed|identity/);
    }
  );

  test('cannot write generated evidence inside the package being built', async () => {
    await expect(build({ cwd, out: path.join(cwd, 'artifacts'), npm })).rejects.toThrow(/outside/);
    expect(npm).not.toHaveBeenCalled();
  });

  test.each(['missing notice', 'bytecode'])(
    'refuses an invalid package payload: %s',
    async (damage) => {
      const invalid = async (args, options) => {
        const result = JSON.parse(await npm(args, options));
        if (args[0] === 'pack') {
          if (damage === 'bytecode')
            result[0].files.push({ path: 'src/scripts/__pycache__/private.pyc' });
          else
            result[0].files = result[0].files.filter(
              (file) => file.path !== 'THIRD-PARTY-LICENSES.md'
            );
        }
        return JSON.stringify(result);
      };
      await expect(build({ cwd, out, npm: invalid })).rejects.toThrow(
        /cache files|license\/package/
      );
      expect(fs.existsSync(path.join(out, 'release-manifest.json'))).toBe(false);
    }
  );
});
