/** Build one npm archive and a checked production SBOM; publish these exact bytes. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { runNpm } = require('../cli/lib/npm-runner');

const REQUIRED_FILES = ['package.json', 'README.md', 'LICENSE', 'THIRD-PARTY-LICENSES.md'];
const digest = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  crypto.createHash(algorithm).update(bytes).digest(encoding);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const requireThat = (condition, message) => {
  if (!condition) throw new Error(message);
};

/**
 * `npm pack --json` returns a list up to npm 11 and an object keyed by package
 * name from npm 12 on. The release job installs npm@latest, so both shapes reach
 * this code; the identity checks below stay the same for either.
 */
function packedEntries(output) {
  const value = JSON.parse(output);
  const entries = Array.isArray(value) ? value : Object.values(value);
  requireThat(
    entries.every(
      (entry) => entry && typeof entry === 'object' && typeof entry.filename === 'string'
    ),
    'npm pack did not report packaged archives.'
  );
  return entries;
}

function productionGraph(pkg, lock) {
  requireThat(
    lock.lockfileVersion >= 2 && lock.packages?.[''],
    'A modern npm lockfile is required.'
  );
  requireThat(
    lock.name === pkg.name && lock.version === pkg.version,
    'Package/lock identity mismatch.'
  );
  requireThat(
    JSON.stringify(lock.packages[''].dependencies) === JSON.stringify(pkg.dependencies),
    'Package/lock production dependency mismatch.'
  );
  const graph = new Map();
  const pending = [''];
  const visited = new Set();
  const identity = (location) => {
    if (!location) return `${pkg.name}@${pkg.version}`;
    const item = lock.packages[location];
    requireThat(item && !item.link && item.version, `Unsupported lock entry: ${location}`);
    return `${item.name || location.split('node_modules/').pop()}@${item.version}`;
  };
  const resolve = (location, name) => {
    let ancestor = location;
    for (;;) {
      const candidate = `${ancestor ? ancestor + '/' : ''}node_modules/${name}`;
      if (lock.packages[candidate]) return candidate;
      if (!ancestor) return null;
      const index = ancestor.lastIndexOf('/node_modules/');
      ancestor = index < 0 ? '' : ancestor.slice(0, index);
    }
  };
  while (pending.length) {
    const location = pending.shift();
    if (visited.has(location)) continue;
    visited.add(location);
    const item = lock.packages[location];
    const ref = identity(location);
    const edges = graph.get(ref) || new Set();
    graph.set(ref, edges);
    const dependencies = {
      ...item.dependencies,
      ...item.optionalDependencies,
      ...(location ? item.peerDependencies : {}),
    };
    for (const name of Object.keys(dependencies)) {
      const target = resolve(location, name);
      const optional =
        Object.hasOwn(item.optionalDependencies || {}, name) ||
        item.peerDependenciesMeta?.[name]?.optional;
      if (!target && optional) continue;
      requireThat(target, `Missing production dependency ${name} of ${ref}.`);
      edges.add(identity(target));
      pending.push(target);
    }
  }
  return graph;
}

function productionSbom(full, pkg, lock) {
  const graph = productionGraph(pkg, lock);
  const root = `${pkg.name}@${pkg.version}`;
  requireThat(
    full.bomFormat === 'CycloneDX' && full.metadata?.component?.['bom-ref'] === root,
    'SBOM package identity mismatch.'
  );
  requireThat(
    full.metadata.component.purl === `pkg:npm/${pkg.name}@${pkg.version}`,
    'SBOM package URL mismatch.'
  );
  const components = (full.components || []).filter((item) => graph.has(item['bom-ref']));
  const found = new Set(components.map((item) => item['bom-ref']));
  requireThat(
    found.size === graph.size - 1 && found.size === components.length,
    'SBOM production component coverage mismatch.'
  );
  for (const component of components) {
    requireThat(
      component['bom-ref'] === `${component.name}@${component.version}`,
      'SBOM component identity mismatch.'
    );
  }
  const dependencies = (full.dependencies || [])
    .filter((item) => graph.has(item.ref))
    .map((item) => ({
      ref: item.ref,
      dependsOn: (item.dependsOn || []).filter((ref) => graph.has(ref)).sort(),
    }));
  requireThat(
    new Set(dependencies.map((item) => item.ref)).size === graph.size &&
      dependencies.length === graph.size,
    'SBOM dependency graph is incomplete.'
  );
  for (const item of dependencies) {
    requireThat(
      JSON.stringify(item.dependsOn) === JSON.stringify([...graph.get(item.ref)].sort()),
      `SBOM production edges mismatch: ${item.ref}`
    );
  }
  return { ...full, components, dependencies };
}

async function build({ cwd, out, npm = runNpm }) {
  cwd = path.resolve(cwd);
  out = path.resolve(out);
  const relative = path.relative(cwd, out);
  requireThat(
    relative.startsWith('..' + path.sep) || path.isAbsolute(relative),
    'Release artifacts must be outside the package worktree.'
  );
  fs.mkdirSync(out, { recursive: true });
  requireThat(fs.readdirSync(out).length === 0, 'Release output directory must be empty.');
  const pkg = readJson(path.join(cwd, 'package.json'));
  const lock = readJson(path.join(cwd, 'package-lock.json'));
  requireThat(
    pkg.name === 'bmad-plus' && /^\d+\.\d+\.\d+$/.test(pkg.version),
    'A stable bmad-plus package is required.'
  );
  // npm --omit=dev can omit shared production dependencies. Generate the full
  // locked graph, select its production closure, and check every node and edge.
  const full = JSON.parse(
    await npm(['sbom', '--package-lock-only', '--sbom-format=cyclonedx', '--sbom-type=framework'], {
      cwd,
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    })
  );
  const sbom = productionSbom(full, pkg, lock);
  const packed = packedEntries(
    await npm(['pack', '--json', '--ignore-scripts', '--pack-destination', out], {
      cwd,
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    })
  );
  const filename = `bmad-plus-${pkg.version}.tgz`;
  requireThat(
    packed.length === 1 &&
      packed[0].filename === filename &&
      packed[0].name === pkg.name &&
      packed[0].version === pkg.version,
    'npm archive identity mismatch.'
  );
  const shipped = new Set(packed[0].files.map((file) => file.path));
  requireThat(
    ![...shipped].some(
      (file) => file.split('/').includes('__pycache__') || /\.py[co]$/i.test(file)
    ),
    'Interpreter cache files must not be published.'
  );
  requireThat(
    REQUIRED_FILES.every((file) => shipped.has(file)),
    'Required license/package files are missing.'
  );
  const archive = fs.readFileSync(path.join(out, filename));
  const integrity = `sha512-${digest(archive, 'sha512', 'base64')}`;
  requireThat(packed[0].integrity === integrity, 'npm archive integrity mismatch.');
  const sbomBytes = Buffer.from(JSON.stringify(sbom, null, 2) + '\n');
  const manifest = {
    schemaVersion: 1,
    name: pkg.name,
    version: pkg.version,
    archive: { filename, bytes: archive.length, sha256: digest(archive), integrity },
    sbom: {
      filename: 'sbom.cdx.json',
      sha256: digest(sbomBytes),
      components: sbom.components.length,
    },
    packageLockSha256: digest(fs.readFileSync(path.join(cwd, 'package-lock.json'))),
    scope: 'Locked npm production dependencies; bundled source notices are shipped separately.',
    attestation: 'Maintainer-generated inventory and hashes; not an npm provenance attestation.',
  };
  fs.writeFileSync(path.join(out, 'sbom.cdx.json'), sbomBytes, { flag: 'wx' });
  fs.writeFileSync(
    path.join(out, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' }
  );
  return verify({ cwd, out });
}

function verify({ cwd, out }) {
  const pkg = readJson(path.join(cwd, 'package.json'));
  const manifest = readJson(path.join(out, 'release-manifest.json'));
  requireThat(
    manifest.schemaVersion === 1 &&
      manifest.name === pkg.name &&
      manifest.version === pkg.version &&
      manifest.archive?.filename === `bmad-plus-${pkg.version}.tgz` &&
      manifest.sbom?.filename === 'sbom.cdx.json',
    'Release manifest identity mismatch.'
  );
  const archive = fs.readFileSync(path.join(out, manifest.archive.filename));
  requireThat(
    archive.length === manifest.archive.bytes &&
      digest(archive) === manifest.archive.sha256 &&
      `sha512-${digest(archive, 'sha512', 'base64')}` === manifest.archive.integrity,
    'Release archive was changed.'
  );
  const sbomBytes = fs.readFileSync(path.join(out, 'sbom.cdx.json'));
  requireThat(digest(sbomBytes) === manifest.sbom.sha256, 'Release SBOM was changed.');
  const lockBytes = fs.readFileSync(path.join(cwd, 'package-lock.json'));
  requireThat(digest(lockBytes) === manifest.packageLockSha256, 'Release lockfile was changed.');
  const sbom = productionSbom(JSON.parse(sbomBytes), pkg, JSON.parse(lockBytes));
  requireThat(sbom.components.length === manifest.sbom.components, 'Release SBOM count mismatch.');
  return manifest;
}

async function verifyRegistry({ cwd, out, npm = runNpm }) {
  const manifest = verify({ cwd, out });
  const integrity = JSON.parse(
    await npm(
      [
        'view',
        `bmad-plus@${manifest.version}`,
        'dist.integrity',
        '--json',
        '--prefer-online',
        '--registry=https://registry.npmjs.org',
      ],
      { cwd, timeout: 20000 }
    )
  );
  // npm can answer with nothing or stale metadata while its publish-time scan runs;
  // naming what it served tells a delay apart from a different archive.
  requireThat(
    integrity === manifest.archive.integrity,
    `Published npm integrity does not match the checked release archive (npm served ${JSON.stringify(integrity)}).`
  );
  return manifest;
}

if (require.main === module) {
  (async () => {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      options: { out: { type: 'string' } },
    });
    const commands = { build, verify, 'verify-registry': verifyRegistry };
    requireThat(
      positionals.length === 1 && commands[positionals[0]] && values.out,
      'Usage: node tools/release/supply-chain.js build|verify|verify-registry --out DIRECTORY'
    );
    const result = await commands[positionals[0]]({ cwd: process.cwd(), out: values.out });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  })().catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
}

module.exports = { productionGraph, productionSbom, build, verify, verifyRegistry };
