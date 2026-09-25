/**
 * BMAD+ Build — Multi-CLI Adapter Generator (Pillar 5) tests
 *
 * Proves that tools/build/generate-adapters.js:
 *   - emits a spine reference + a tool-specific notes block for EVERY
 *     targets.adapters[] entry declared in registry.yaml,
 *   - derives all counts from the registry (never hardcoded),
 *   - detects drifted/missing on-disk adapters via --check,
 *   - generates the SPINE (AGENTS.md) + injects the hand-authored project
 *     instructions (tools/build/adapters.config.js) into every file,
 *   - keeps the ADOPTED repo-root adapters + spine drift-free (load-bearing).
 *
 * Run: npx jest tests/unit/generate-adapters.test.js
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadRegistry, buildDerived } = require('../../tools/build/generate');
const adapters = require('../../tools/build/generate-adapters');

const registry = loadRegistry();
const clone = () => JSON.parse(JSON.stringify(registry));
const derived = buildDerived(registry);

describe('pure installed-project renderer', () => {
  test('filters personas by installed pack and includes required Core', () => {
    const core = adapters.renderUserConfig(derived, { packs: ['core'] });
    expect(core).toContain('**Atlas**');
    expect(core).not.toContain('**Shadow**');
    const osint = adapters.renderUserConfig(derived, { packs: ['osint'] });
    expect(osint).toContain('**Atlas**');
    expect(osint).toContain('**Shadow**');
    expect(osint).not.toContain('**Zecher**');
    expect(osint).toContain('Packs (2): Core, OSINT');
  });

  test('includes the memory protocol only with Memory selected', () => {
    for (const packs of [['core'], ['core', 'memory']]) {
      for (const { content } of adapters.generateUserFiles(derived, { packs })) {
        expect(content.includes('## Memory Protocol (Karpathy Guardrails)')).toBe(
          packs.includes('memory')
        );
      }
    }
  });

  test('uses the registry personas including Hebrew names and System Architect', () => {
    for (const { content } of adapters.generateUserFiles(derived)) {
      expect(content).toContain('**Bezalel** (בצלאל) — System Architect');
      expect(content).not.toContain('System Architecture');
    }
    const updated = JSON.parse(JSON.stringify(derived));
    updated.packs.core.personas[0].name = 'Registry-only Persona';
    expect(adapters.renderUserConfig(updated)).toContain('**Registry-only Persona**');
    expect(adapters.renderUserConfig(updated)).not.toContain('**Atlas**');
  });

  test('contains only customer context, never repository owner or source paths', () => {
    for (const { content } of adapters.generateUserFiles(derived, {
      userName: 'Alice',
      language: 'Spanish',
    })) {
      expect(content).toContain('User name: Alice');
      expect(content).toContain('Default language: Spanish');
      expect(content).not.toMatch(
        /laurent|Laurent|src\/bmad-plus|monitor\/|mcp-server\/|readme-international|D:\/?travail/i
      );
      expect(content).toContain(adapters.GENERATED_MARKER);
      expect(content).toContain(adapters.USER_CONFIG_MARKER);
    }
  });

  test('renders without I/O and does not mutate its inputs', () => {
    const before = JSON.stringify(derived);
    const read = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('Renderer performed I/O');
    });
    try {
      expect(adapters.generateUserFiles(derived).length).toBeGreaterThan(1);
      expect(adapters.renderUserConfig(derived)).toContain('Agent Spine');
    } finally {
      read.mockRestore();
    }
    expect(JSON.stringify(derived)).toBe(before);
  });

  test('emits the common root spine and deduplicates shared adapter files', () => {
    const files = adapters.generateUserFiles(derived);
    expect(files.map((entry) => entry.file)).toEqual([
      derived.targets.spine,
      ...new Set(derived.targets.adapters.map((adapter) => adapter.file)),
    ]);
    expect(files[0].content).toBe(adapters.renderUserConfig(derived));
    expect(files.find((entry) => entry.file === 'GEMINI.md').tools).toEqual([
      'gemini-cli',
      'antigravity',
    ]);
  });

  test('nested adapters reference the root spine with a correct relative link', () => {
    for (const { file, content, spine } of adapters.generateUserFiles(derived)) {
      if (spine) continue;
      const relative = path.posix.relative(path.posix.dirname(file), derived.targets.spine);
      expect(content).toContain('[AGENTS.md](' + relative + ')');
      if (file.endsWith('.mdc'))
        expect(content).toMatch(/^---\ndescription:.*\nalwaysApply: true\n---\n/);
    }
  });

  test('selects only requested tools while always retaining the common spine', () => {
    const files = adapters.generateUserFiles(derived, { tools: ['antigravity'] });
    expect(files.map((entry) => entry.file)).toEqual(['AGENTS.md', 'GEMINI.md']);
    expect(files[1].content).toContain('## Tool notes — antigravity');
    expect(files[1].content).not.toContain('## Tool notes — gemini-cli');
    expect(adapters.generateUserFiles(derived, { tools: [] }).map((entry) => entry.file)).toEqual([
      'AGENTS.md',
    ]);
  });

  test('rejects unknown pack or tool choices instead of silently losing them', () => {
    expect(() => adapters.renderUserConfig(derived, { packs: ['missing'] })).toThrow(
      /Unknown pack/
    );
    expect(() => adapters.generateUserFiles(derived, { tools: ['missing'] })).toThrow(
      /Unknown tool/
    );
  });
});

describe('foreign project rendering with --target', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-target-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  const run = (tmp, ...options) =>
    adapters.main(['node', 'generate-adapters', '--target', tmp, ...options]);

  test('writes customer files using generated runtime facts without raw registry reads', () => {
    const read = jest.spyOn(fs, 'readFileSync');
    expect(run(tmp, '--packs', 'core,memory', '--user-name', 'Alice', '--language', 'French')).toBe(
      0
    );
    expect(read.mock.calls.some(([file]) => String(file).endsWith('registry.yaml'))).toBe(false);
    const expected = adapters.generateUserFiles(derived, {
      packs: ['core', 'memory'],
      userName: 'Alice',
      language: 'French',
    });
    for (const { file, content } of expected)
      expect(fs.readFileSync(path.join(tmp, file), 'utf8')).toBe(content);
    expect(
      run(tmp, '--packs', 'core,memory', '--user-name', 'Alice', '--language', 'French', '--check')
    ).toBe(0);
    fs.appendFileSync(path.join(tmp, 'CLAUDE.md'), '\nDrift\n');
    expect(
      run(tmp, '--packs', 'core,memory', '--user-name', 'Alice', '--language', 'French', '--check')
    ).toBe(1);
  });

  test('refuses foreign files as a batch and requires explicit --force', () => {
    fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# Hand-authored instructions\n');
    expect(run(tmp)).toBe(1);
    expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(false);
    expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8')).toContain('Hand-authored');
    expect(run(tmp, '--force')).toBe(0);
    expect(fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8')).toContain(
      adapters.USER_CONFIG_MARKER
    );
    expect(run(tmp)).toBe(0);
  });

  test('does not treat a repository-adopted file as an installed customer file', () => {
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), adapters.generateAllFiles(registry)[0].content);
    expect(run(tmp)).toBe(1);
    expect(fs.readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8')).toContain('User name: laurent');
  });

  test.each(['--adopt', '--out-dir'])('rejects --target combined with %s', (option) => {
    expect(run(tmp, option, tmp)).toBe(1);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  test.each([
    '../outside.md',
    '/outside.md',
    'C:/outside.md',
    '.cursor/../../outside.md',
    '.cursor\\outside.md',
  ])('rejects escaping declared targets: %s', (file) => {
    const modified = JSON.parse(JSON.stringify(derived));
    modified.targets.adapters[0].file = file;
    expect(() =>
      adapters.writeUserAdapters({ outDir: tmp, derived: modified, force: true })
    ).toThrow(/relative project path/);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  test('refuses a nested junction before writing any adapter, even with --force', () => {
    const project = path.join(tmp, 'project');
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(project);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'Keep this');
    fs.symlinkSync(outside, path.join(project, '.cursor'), 'junction');
    expect(run(project, '--force')).toBe(1);
    expect(fs.existsSync(path.join(project, 'AGENTS.md'))).toBe(false);
    expect(fs.readdirSync(outside)).toEqual(['keep.txt']);
  });
});

describe('adapter generation from registry targets', () => {
  const generated = adapters.generateAllAdapters(registry);
  const spine = registry.targets.spine;

  test('emits one file per unique targets.adapters[].file entry', () => {
    const uniqueFiles = [...new Set(registry.targets.adapters.map((a) => a.file))];
    expect(generated.map((g) => g.file).sort()).toEqual(uniqueFiles.sort());
  });

  test('every registry adapter tool gets a tool-specific notes block in its file', () => {
    for (const { tool, file } of registry.targets.adapters) {
      const out = generated.find((g) => g.file === file);
      expect(out).toBeDefined();
      expect(out.tools).toContain(tool);
      expect(out.content).toContain(`## Tool notes — ${tool}`);
    }
  });

  test('every adapter references the spine as source of truth', () => {
    for (const { content } of generated) {
      expect(content).toContain(`**${spine}**`);
      expect(content).toContain(`spine ${spine}`);
    }
  });

  test('every adapter is marked auto-generated', () => {
    for (const { content } of generated) {
      expect(content).toContain('AUTO-GENERATED');
      expect(content).toContain('DO NOT EDIT');
    }
  });

  test('tools sharing a file are grouped into a single adapter', () => {
    const byFile = new Map();
    for (const { tool, file } of registry.targets.adapters) {
      byFile.set(file, [...(byFile.get(file) || []), tool]);
    }
    for (const [file, tools] of byFile) {
      const out = generated.find((g) => g.file === file);
      expect(out.tools).toEqual(tools);
    }
  });

  test('.mdc adapters carry Cursor rule frontmatter', () => {
    const mdc = generated.filter((g) => g.file.endsWith('.mdc'));
    expect(mdc.length).toBeGreaterThan(0);
    for (const { content } of mdc) {
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain('alwaysApply: true');
    }
  });

  test('unknown adapter tools get fallback notes instead of crashing', () => {
    const mutated = clone();
    mutated.targets.adapters.push({ tool: 'future-cli', file: 'FUTURE.md' });
    const out = adapters.generateAllAdapters(mutated).find((g) => g.file === 'FUTURE.md');
    expect(out.content).toContain('## Tool notes — future-cli');
    expect(out.content).toContain('future-cli reads `FUTURE.md`.');
  });
});

describe('registry facts are computed, never hardcoded', () => {
  test('pack count and installer agent totals come from the registry lists', () => {
    const facts = adapters.buildRegistryFacts(registry);
    const expectedPackCount = Object.keys(registry.packs).length;
    const expectedAgentTotal = Object.values(registry.packs).reduce(
      (n, p) => n + p.agents.length,
      0
    );
    expect(facts.packCount).toBe(expectedPackCount);
    expect(facts.installerAgentCount).toBe(expectedAgentTotal);

    const [{ content }] = adapters.generateAllAdapters(registry);
    expect(content).toContain(`Packs (${expectedPackCount}):`);
    expect(content).toContain(`Installer agents (${expectedAgentTotal}`);
  });

  test('shield agent/workflow/framework counts are summed from its declared lists', () => {
    const facts = adapters.buildRegistryFacts(registry);
    const shield = facts.packs.find((p) => p.id === 'shield');
    const declared = registry.packs.shield;
    const categoryAgents = declared.categories.reduce((n, c) => n + c.agents.length, 0);
    expect(shield.categoryAgentCount).toBe(categoryAgents);
    expect(shield.workflowCount).toBe(declared.workflows.length);
    expect(shield.frameworkCount).toBe(declared.compliance_tags.length);
  });

  test('mutating the registry changes the generated counts (proof of derivation)', () => {
    const mutated = clone();
    mutated.packs.core.agents.push('agent-extra');
    const before = adapters.buildRegistryFacts(registry);
    const after = adapters.buildRegistryFacts(mutated);
    expect(after.installerAgentCount).toBe(before.installerAgentCount + 1);

    const content = adapters
      .generateAllAdapters(mutated)
      .find((g) => g.tools.includes('claude-code')).content;
    expect(content).toContain(`Installer agents (${before.installerAgentCount + 1}`);
  });

  test('product name and version are pulled from registry.product', () => {
    const [{ content }] = adapters.generateAllAdapters(registry);
    expect(content).toContain(`${registry.product.display_name} v${registry.product.version}`);
  });
});

describe('targets validation', () => {
  test('rejects a registry without targets', () => {
    const mutated = clone();
    delete mutated.targets;
    expect(() => adapters.generateAllAdapters(mutated)).toThrow(/missing top-level "targets"/);
  });

  test('rejects an empty spine', () => {
    const mutated = clone();
    mutated.targets.spine = '';
    expect(() => adapters.generateAllAdapters(mutated)).toThrow(/targets\.spine/);
  });

  test('rejects an adapter entry without tool/file', () => {
    const mutated = clone();
    mutated.targets.adapters.push({ tool: 'broken' });
    expect(() => adapters.generateAllAdapters(mutated)).toThrow(/targets\.adapters\[\d+\]/);
  });
});

describe('--check drift detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-adapters-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('freshly written adapters pass check()', () => {
    adapters.writeAdapters({ outDir: tmpDir });
    const result = adapters.check({ outDir: tmpDir });
    expect(result.mismatches).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('a drifted sample is detected', () => {
    adapters.writeAdapters({ outDir: tmpDir });
    const victim = path.join(tmpDir, 'CLAUDE.md');
    fs.appendFileSync(victim, '\nHand-edited drift line\n', 'utf8');
    const result = adapters.check({ outDir: tmpDir });
    expect(result.ok).toBe(false);
    expect(result.mismatches.join('\n')).toContain('CLAUDE.md: content differs');
  });

  test('a missing adapter is detected', () => {
    adapters.writeAdapters({ outDir: tmpDir });
    fs.rmSync(path.join(tmpDir, 'CONVENTIONS.md'));
    const result = adapters.check({ outDir: tmpDir });
    expect(result.ok).toBe(false);
    expect(result.mismatches.join('\n')).toContain('CONVENTIONS.md: missing on disk');
  });

  test('main() returns 0 on clean check and 1 on drift', () => {
    adapters.writeAdapters({ outDir: tmpDir });
    const silence = jest.spyOn(console, 'log').mockImplementation(() => {});
    const silenceErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(adapters.main(['node', 'x', '--check', '--out-dir', tmpDir])).toBe(0);
      fs.appendFileSync(path.join(tmpDir, 'GEMINI.md'), 'drift', 'utf8');
      expect(adapters.main(['node', 'x', '--check', '--out-dir', tmpDir])).toBe(1);
    } finally {
      silence.mockRestore();
      silenceErr.mockRestore();
    }
  });

  test('committed previews under tools/build/generated-adapters/ are drift-free', () => {
    const result = adapters.check();
    expect(result.mismatches).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('spine generation (targets.spine → AGENTS.md)', () => {
  const files = adapters.generateAllFiles(registry);
  const spineEntry = files.find((f) => f.spine === true);

  test('generateAllFiles emits the spine plus every adapter', () => {
    expect(spineEntry).toBeDefined();
    expect(spineEntry.file).toBe(registry.targets.spine);
    const adapterFiles = [...new Set(registry.targets.adapters.map((a) => a.file))];
    expect(files.map((f) => f.file).sort()).toEqual(
      [registry.targets.spine, ...adapterFiles].sort()
    );
  });

  test('the spine is marked auto-generated and names both sources of truth', () => {
    expect(spineEntry.content).toContain('AUTO-GENERATED');
    expect(spineEntry.content).toContain('DO NOT EDIT');
    expect(spineEntry.content).toContain('registry.yaml');
    expect(spineEntry.content).toContain('tools/build/adapters.config.js');
  });

  test('the spine carries the full hand-authored roster and rules (nothing lost)', () => {
    for (const marker of [
      '**Atlas**',
      '**Zecher**',
      'Memory Protocol (Karpathy Guardrails)',
      'Commit Rules',
      'Repository Maintenance Rule',
      '## Project Structure',
      'User name: laurent',
    ]) {
      expect(spineEntry.content).toContain(marker);
    }
  });
});

describe('hand-authored project instructions are injected into every file', () => {
  test('every adapter AND the spine inline the config sections', () => {
    for (const { content } of adapters.generateAllFiles(registry)) {
      expect(content).toContain('tools/build/adapters.config.js');
      expect(content).toContain('## Agents');
      expect(content).toContain('Memory Protocol (Karpathy Guardrails)');
      expect(content).toContain('NEVER add "Co-Authored-By: Claude"');
      expect(content).toContain('readme-international/');
    }
  });

  test('project context sentence is derived from registry.product, not hand-typed', () => {
    const mutated = clone();
    mutated.product.display_name = 'RENAMED+';
    const [{ content }] = adapters.generateAllFiles(mutated);
    expect(content).toContain('This project uses RENAMED+,');
  });
});

describe('root adoption (--adopt) — adapters are load-bearing', () => {
  test('ADOPTED repo-root adapters + spine are drift-free against the registry', () => {
    // This is the real gate: the live CLAUDE.md / GEMINI.md / AGENTS.md /
    // .cursor / .codex / .opencode / CONVENTIONS.md at the repo root are
    // generated files. Any hand edit to them fails this test (and
    // `node tools/build/generate-adapters.js --check --adopt` in CI).
    const result = adapters.check({ outDir: adapters.REPO_ROOT });
    expect(result.mismatches).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('--adopt and --out-dir are mutually exclusive', () => {
    const silenceErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(adapters.main(['node', 'x', '--adopt', '--out-dir', 'somewhere'])).toBe(1);
    } finally {
      silenceErr.mockRestore();
    }
  });

  test('adoption guard flags hand-authored files lacking the marker', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-adopt-'));
    try {
      const files = adapters.generateAllFiles(registry);
      fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Hand-written, precious\n', 'utf8');
      expect(adapters.listAdoptionBlockers(tmpDir, files)).toEqual(['CLAUDE.md']);
      adapters.writeAdapters({ outDir: tmpDir });
      expect(adapters.listAdoptionBlockers(tmpDir, files)).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('framework version awareness instructions', () => {
  test('source and installed tools share the once-per-session policy-aware entry point', () => {
    const { DERIVED } = require('../../tools/cli/lib/packs');
    const files = [
      ...adapters.generateAllFiles(registry),
      ...adapters.generateUserFiles(DERIVED, { packs: ['core'] }),
    ];
    for (const { content } of files) {
      expect(content).toContain('update-check --json');
      expect(content).toContain('update --latest --auto');
      expect(content).toContain('canAutoApply');
      expect(content).toContain('Check only once');
      expect(content).toContain('reread the project spine');
    }
  });
});
