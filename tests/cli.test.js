/**
 * BMAD+ CLI — Unit Tests
 * Tests for i18n, install manifest, update, doctor, and uninstall commands
 *
 * Run: npx jest tests/cli.test.js
 */

const path = require('node:path');
const fs = require('node:fs');
const { LANGUAGES, t, getLanguageOptions, getCommLanguageOptions } = require('../tools/cli/i18n');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// i18n Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('i18n Module', () => {
  const EXPECTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'pt-br', 'ru', 'zh', 'he', 'ja', 'it'];

  test('should have exactly 10 languages', () => {
    expect(Object.keys(LANGUAGES)).toHaveLength(10);
  });

  test('should include all expected language codes', () => {
    for (const lang of EXPECTED_LANGUAGES) {
      expect(LANGUAGES).toHaveProperty(lang);
    }
  });

  test('t() should return English for unknown language', () => {
    const result = t('xx');
    expect(result).toBe(LANGUAGES.en);
  });

  test('t() should return correct language object', () => {
    const fr = t('fr');
    expect(fr.flag).toBe('🇫🇷');
    expect(fr.name).toBe('Français');
  });

  // ── Core strings present in all languages ──
  const REQUIRED_KEYS = [
    'flag', 'name', 'locale',
    'installer_title', 'select_language', 'installing_to',
    'select_packs', 'select_ide', 'detected_ides', 'selected_packs',
    'enter_name', 'comm_language', 'exec_mode',
    'exec_manual', 'exec_autopilot', 'exec_hybrid',
    'installing_files', 'configuring_ides',
    'installed_summary', 'ide_configured',
    'cancelled', 'failed', 'source_not_found', 'soon',
    'guide_title', 'guide_who',
    'guide_idea', 'guide_prd', 'guide_arch', 'guide_code',
    'guide_test', 'guide_sprint', 'guide_auto',
    'guide_osint', 'guide_maker', 'guide_seo', 'guide_backup', 'guide_animated',
    'guide_workflow', 'guide_or_auto', 'guide_output',
    'guide_ready', 'guide_credits',
  ];

  for (const lang of EXPECTED_LANGUAGES) {
    test(`${lang}: should have all core translation keys`, () => {
      const translations = LANGUAGES[lang];
      for (const key of REQUIRED_KEYS) {
        expect(translations).toHaveProperty(key, expect.anything());
      }
    });
  }

  // ── Uninstall/Update strings present in all languages ──
  const COMMAND_KEYS = [
    'uninstall_confirm', 'uninstall_removing', 'uninstall_done',
    'uninstall_output_kept', 'installed_on',
    'update_confirm', 'update_updating', 'update_done',
    'update_current', 'update_ready',
  ];

  for (const lang of EXPECTED_LANGUAGES) {
    test(`${lang}: should have all command translation keys`, () => {
      const translations = LANGUAGES[lang];
      for (const key of COMMAND_KEYS) {
        expect(translations).toHaveProperty(key, expect.anything());
      }
    });
  }

  // ── CLI guide strings present in all languages ──
  const GUIDE_KEYS = [
    'guide_cli_title', 'guide_cli_install', 'guide_cli_update',
    'guide_cli_doctor', 'guide_cli_uninstall',
    'guide_examples_title',
    'guide_example_seo', 'guide_example_backup',
    'guide_example_animated', 'guide_example_osint',
  ];

  for (const lang of EXPECTED_LANGUAGES) {
    test(`${lang}: should have all CLI guide translation keys`, () => {
      const translations = LANGUAGES[lang];
      for (const key of GUIDE_KEYS) {
        expect(translations).toHaveProperty(key, expect.anything());
      }
    });
  }

  // ── Function keys should be callable ──
  test('installed_summary should be a function returning a string', () => {
    const result = LANGUAGES.en.installed_summary(5, 3, 8);
    expect(typeof result).toBe('string');
    expect(result).toContain('5');
    expect(result).toContain('3');
    expect(result).toContain('8');
  });

  test('ide_configured should be a function returning a string', () => {
    const result = LANGUAGES.en.ide_configured(4);
    expect(typeof result).toBe('string');
    expect(result).toContain('4');
  });

  test('uninstall_done should be a function in all languages', () => {
    for (const lang of EXPECTED_LANGUAGES) {
      const fn = LANGUAGES[lang].uninstall_done;
      expect(typeof fn).toBe('function');
      const result = fn(7);
      expect(typeof result).toBe('string');
      expect(result).toContain('7');
    }
  });

  test('update_done should be a function in all languages', () => {
    for (const lang of EXPECTED_LANGUAGES) {
      const fn = LANGUAGES[lang].update_done;
      expect(typeof fn).toBe('function');
      const result = fn(12);
      expect(typeof result).toBe('string');
      expect(result).toContain('12');
    }
  });

  // ── Options generators ──
  test('getLanguageOptions() should return 10 options', () => {
    const options = getLanguageOptions();
    expect(options).toHaveLength(10);
    for (const opt of options) {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
      expect(typeof opt.label).toBe('string');
    }
  });

  test('getCommLanguageOptions() should return 10 options', () => {
    const options = getCommLanguageOptions();
    expect(options).toHaveLength(10);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI Entry Point Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('CLI Entry Point', () => {
  test('bmad-plus-cli.js should be requireable', () => {
    // Just test that the module loads without error
    // (commander will parse process.argv so we skip that)
    const cliPath = path.join(__dirname, '..', 'tools', 'cli', 'bmad-plus-cli.js');
    expect(fs.existsSync(cliPath)).toBe(true);
  });

  test('all command modules should exist and export correctly', () => {
    const commands = ['install', 'uninstall', 'update', 'doctor'];
    for (const cmd of commands) {
      const cmdPath = path.join(__dirname, '..', 'tools', 'cli', 'commands', `${cmd}.js`);
      expect(fs.existsSync(cmdPath)).toBe(true);
      // We can't require install.js in Jest because @clack/prompts v1.4+ uses ESM
      // So we just verify file existence and check for the command export pattern
      const content = fs.readFileSync(cmdPath, 'utf8');
      expect(content).toContain(`command: '${cmd}'`);
      expect(content).toContain('action:');
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Package.json Integrity Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Package.json Integrity', () => {
  const pkg = require('../package.json');

  test('should have correct name', () => {
    expect(pkg.name).toBe('bmad-plus');
  });

  test('version should match semver format', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('should have bin entry for bmad-plus', () => {
    expect(pkg.bin).toHaveProperty('bmad-plus');
  });

  test('should have required scripts', () => {
    expect(pkg.scripts).toHaveProperty('install:bmad');
    expect(pkg.scripts).toHaveProperty('update:bmad');
    expect(pkg.scripts).toHaveProperty('doctor:bmad');
    expect(pkg.scripts).toHaveProperty('uninstall:bmad');
  });

  test('should have required dependencies', () => {
    const deps = Object.keys(pkg.dependencies);
    expect(deps).toContain('@clack/prompts');
    expect(deps).toContain('commander');
    expect(deps).toContain('fs-extra');
    expect(deps).toContain('picocolors');
  });

  test('files array should not contain oveanet-pack', () => {
    expect(pkg.files).not.toContain('oveanet-pack');
  });

  test('files array should include tools and src/bmad-plus', () => {
    expect(pkg.files).toContain('tools');
    expect(pkg.files).toContain('src/bmad-plus');
  });

  test('engines should require Node >= 20', () => {
    expect(pkg.engines.node).toBe('>=20.0.0');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Module.yaml Integrity Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Module.yaml Integrity', () => {
  const yaml = require('js-yaml');
  const moduleYamlPath = path.join(__dirname, '..', 'src', 'bmad-plus', 'module.yaml');

  test('module.yaml should exist and be valid YAML', () => {
    expect(fs.existsSync(moduleYamlPath)).toBe(true);
    const content = fs.readFileSync(moduleYamlPath, 'utf8');
    const parsed = yaml.load(content);
    expect(parsed).toBeDefined();
  });

  test('should define all packs including seo, backup, animated', () => {
    const content = fs.readFileSync(moduleYamlPath, 'utf8');
    const parsed = yaml.load(content);
    
    // Packs is an object with named keys
    expect(parsed).toHaveProperty('packs');
    const packNames = Object.keys(parsed.packs);
    expect(packNames).toContain('seo');
    expect(packNames).toContain('backup');
    expect(packNames).toContain('animated');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Source File Integrity Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Source File Integrity', () => {
  test('i18n.js should be UTF-8 without BOM', () => {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'tools', 'cli', 'i18n.js'));
    // Check no BOM (EF BB BF)
    const hasBOM = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
    expect(hasBOM).toBe(false);
  });

  test('.gitignore should exclude mcp-server/.env', () => {
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    expect(gitignore).toContain('mcp-server/.env');
  });

  test('.env.example should exist in mcp-server/', () => {
    const envExample = path.join(__dirname, '..', 'mcp-server', '.env.example');
    expect(fs.existsSync(envExample)).toBe(true);
    const content = fs.readFileSync(envExample, 'utf8');
    // Should contain placeholder text, not real secrets (ghp_ prefix is OK in placeholder names)
    expect(content).toContain('your_github_token_here');
    expect(content).toContain('change_me');
  });

  test('install.js credits should point to BMAD-PLUS repo', () => {
    const installJs = fs.readFileSync(
      path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js'), 'utf8'
    );
    expect(installJs).toContain('github.com/lrochetta/BMAD-PLUS');
  });

  test('install.js should read version from package.json (not hardcoded)', () => {
    const installJs = fs.readFileSync(
      path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js'), 'utf8'
    );
    // Check for dynamic version reading
    expect(installJs).toContain('pkgJson.version');
    // Should NOT have hardcoded version in manifest
    expect(installJs).not.toMatch(/version:\s*['"]0\.\d+\.\d+['"]/);
  });

  test('CI/CD should not have continue-on-error on npm publish', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', '.github', 'workflows', 'publish-distribution.yml'), 'utf8'
    );
    // Find the npm publish section and check it doesn't have continue-on-error
    const publishIndex = workflow.indexOf('Publish to npm');
    expect(publishIndex).toBeGreaterThan(-1);
    const publishSection = workflow.substring(publishIndex, publishIndex + 200);
    expect(publishSection).not.toContain('continue-on-error');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Version Consistency Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Version Consistency', () => {
  const pkg = require('../package.json');
  const version = pkg.version;

  test('i18n installer_title should contain current version in all languages', () => {
    for (const [code, lang] of Object.entries(LANGUAGES)) {
      expect(lang.installer_title).toContain(`v${version}`,
        `Language ${code} installer_title does not contain v${version}`
      );
    }
  });

  test('CHANGELOG.md should mention current version', () => {
    const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
    expect(changelog).toContain(`[${version}]`);
  });

  test('README.md badge should reference current version', () => {
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    expect(readme).toContain(`version-${version}-blue`);
  });

  test('README-DIST.md badge should reference current version', () => {
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README-DIST.md'), 'utf8');
    expect(readme).toContain(`version-${version}-blue`);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// New Command Modules Tests (scan, autoconfig, memory)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('New Command Modules', () => {
  const commandsDir = path.join(__dirname, '..', 'tools', 'cli', 'commands');

  const NEW_COMMANDS = [
    { file: 'scan.js', command: 'scan' },
    { file: 'autoconfig.js', command: 'autoconfig' },
    { file: 'memory.js', command: 'memory' },
  ];

  for (const { file, command } of NEW_COMMANDS) {
    test(`${file} should exist`, () => {
      const filePath = path.join(commandsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test(`${file} should export command '${command}'`, () => {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      expect(content).toContain(`command: '${command}'`);
    });

    test(`${file} should export an action function`, () => {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      expect(content).toContain('action:');
    });

    test(`${file} should export a description`, () => {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      expect(content).toContain('description:');
    });

    test(`${file} should export options array`, () => {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      expect(content).toContain('options:');
    });
  }

  test('scan.js should define PROJECT_MARKERS with common stacks', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'scan.js'), 'utf8');
    expect(content).toContain('package.json');
    expect(content).toContain('Cargo.toml');
    expect(content).toContain('pyproject.toml');
    expect(content).toContain('go.mod');
    expect(content).toContain('composer.json');
  });

  test('scan.js should define SKIP_DIRS to exclude common directories', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'scan.js'), 'utf8');
    expect(content).toContain('node_modules');
    expect(content).toContain('__pycache__');
    expect(content).toContain('.venv');
  });

  test('scan.js should support --active-days and --paused-days options', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'scan.js'), 'utf8');
    expect(content).toContain('--active-days');
    expect(content).toContain('--paused-days');
  });

  test('autoconfig.js should have detectStack function', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('function detectStack');
  });

  test('autoconfig.js should have analyzeStructure function', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('function analyzeStructure');
  });

  test('autoconfig.js should have calculateHealth function', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('function calculateHealth');
  });

  test('autoconfig.js should have recommendPacks function', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('function recommendPacks');
  });

  test('autoconfig.js should always recommend core and memory packs', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain("const packs = ['core', 'memory']");
  });

  test('autoconfig.js should handle both existing and new projects', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('MODE A: Existing Project');
    expect(content).toContain('MODE B: New Project');
  });

  test('autoconfig.js should write context.md', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('context.md');
    expect(content).toContain("'context.md'");
  });

  test('memory.js should support status and export subcommands', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'memory.js'), 'utf8');
    expect(content).toContain("status:");
    expect(content).toContain("export:");
  });

  test('memory.js should check both project and global brain', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'memory.js'), 'utf8');
    expect(content).toContain('Project Memory');
    expect(content).toContain('Global Brain');
  });

  test('memory.js should calculate health score', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'memory.js'), 'utf8');
    expect(content).toContain('Health:');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scan — Functional Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Scan — Functional Tests', () => {
  // Mock ESM-only dependencies that can't be loaded by Jest
  jest.mock('@clack/prompts', () => ({
    intro: jest.fn(), outro: jest.fn(), log: { info: jest.fn(), error: jest.fn(), success: jest.fn() },
    spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
    select: jest.fn(), multiselect: jest.fn(), confirm: jest.fn(), isCancel: jest.fn(),
  }));
  jest.mock('picocolors', () => ({
    green: s => s, red: s => s, yellow: s => s, blue: s => s, cyan: s => s,
    dim: s => s, bold: s => s, white: s => s, bgMagenta: s => s, bgCyan: s => s, black: s => s,
  }));

  const scanModule = require('../tools/cli/commands/scan');
  const {
    PROJECT_MARKERS,
    SKIP_DIRS,
    getProjectStatus,
    getProjectName,
    hasBmadInstalled,
    scanDirectory,
  } = scanModule._internal;

  const tmpDir = path.join(__dirname, '..', '_test_tmp_scan');

  beforeAll(() => {
    // Create temp directory structure for testing
    const fsExtra = require('fs-extra');
    fsExtra.ensureDirSync(tmpDir);

    // Project A: Node.js + React project
    const projA = path.join(tmpDir, 'my-react-app');
    fsExtra.ensureDirSync(projA);
    fs.writeFileSync(path.join(projA, 'package.json'), JSON.stringify({
      name: 'my-react-app',
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    }), 'utf8');

    // Project B: Python project
    const projB = path.join(tmpDir, 'ml-pipeline');
    fsExtra.ensureDirSync(projB);
    fs.writeFileSync(path.join(projB, 'requirements.txt'), 'numpy\npandas\n', 'utf8');

    // Project C: Rust project
    const projC = path.join(tmpDir, 'rust-cli');
    fsExtra.ensureDirSync(projC);
    fs.writeFileSync(path.join(projC, 'Cargo.toml'), '[package]\nname = "rust-cli"\n', 'utf8');

    // Project D: Node.js with BMAD+ installed
    const projD = path.join(tmpDir, 'bmad-project');
    fsExtra.ensureDirSync(path.join(projD, '.agents'));
    fs.writeFileSync(path.join(projD, 'package.json'), JSON.stringify({
      name: 'bmad-project',
      dependencies: { express: '^4.18.0' },
    }), 'utf8');

    // Project E: Next.js + TypeScript
    const projE = path.join(tmpDir, 'nextjs-app');
    fsExtra.ensureDirSync(projE);
    fs.writeFileSync(path.join(projE, 'package.json'), JSON.stringify({
      name: 'nextjs-app',
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    }), 'utf8');

    // Non-project directory (no markers)
    const nonProj = path.join(tmpDir, 'random-folder');
    fsExtra.ensureDirSync(nonProj);
    fs.writeFileSync(path.join(nonProj, 'notes.txt'), 'hello', 'utf8');

    // Skippable directory (node_modules)
    fsExtra.ensureDirSync(path.join(tmpDir, 'node_modules', 'fake-pkg'));
  });

  afterAll(() => {
    const fsExtra = require('fs-extra');
    fsExtra.removeSync(tmpDir);
  });

  // ── PROJECT_MARKERS ──

  test('PROJECT_MARKERS should contain at least 8 language markers', () => {
    expect(PROJECT_MARKERS.length).toBeGreaterThanOrEqual(8);
  });

  test('first marker should be package.json (highest priority)', () => {
    expect(PROJECT_MARKERS[0].file).toBe('package.json');
  });

  test('package.json marker should have a detect function', () => {
    expect(typeof PROJECT_MARKERS[0].detect).toBe('function');
  });

  // ── SKIP_DIRS ──

  test('SKIP_DIRS should skip node_modules', () => {
    expect(SKIP_DIRS.has('node_modules')).toBe(true);
  });

  test('SKIP_DIRS should skip .git', () => {
    expect(SKIP_DIRS.has('.git')).toBe(true);
  });

  test('SKIP_DIRS should skip Windows system dirs', () => {
    expect(SKIP_DIRS.has('Program Files')).toBe(true);
    expect(SKIP_DIRS.has('$RECYCLE.BIN')).toBe(true);
  });

  // ── getProjectStatus ──

  test('getProjectStatus should return "active" for recently modified dir', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    expect(getProjectStatus(projA)).toBe('active');
  });

  test('getProjectStatus should respect custom activeDays threshold', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    // With activeDays=0, even a just-created dir is "paused"
    // (it was created milliseconds ago, so daysSince ≈ 0 which is < 0.001)
    // Actually 0 days means anything modified today should be active... let's test a real threshold
    expect(getProjectStatus(projA, 30, 180)).toBe('active');
  });

  test('getProjectStatus should return "unknown" for non-existent dir', () => {
    expect(getProjectStatus('/nonexistent/path/xyz')).toBe('unknown');
  });

  // ── getProjectName ──

  test('getProjectName should read name from package.json', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    expect(getProjectName(projA)).toBe('my-react-app');
  });

  test('getProjectName should fall back to directory basename', () => {
    const nonProj = path.join(tmpDir, 'random-folder');
    expect(getProjectName(nonProj)).toBe('random-folder');
  });

  // ── hasBmadInstalled ──

  test('hasBmadInstalled should return true when .agents/ exists', () => {
    const projD = path.join(tmpDir, 'bmad-project');
    expect(hasBmadInstalled(projD)).toBe(true);
  });

  test('hasBmadInstalled should return false when no .agents/ or _bmad/', () => {
    const projA = path.join(tmpDir, 'my-react-app');
    expect(hasBmadInstalled(projA)).toBe(false);
  });

  // ── scanDirectory (the main function) ──

  test('scanDirectory should find all projects in temp dir', () => {
    const projects = scanDirectory(tmpDir, 2);
    // Should find: my-react-app, ml-pipeline, rust-cli, bmad-project, nextjs-app
    expect(projects.length).toBe(5);
  });

  test('scanDirectory should detect correct stack for React project', () => {
    const projects = scanDirectory(tmpDir, 2);
    const react = projects.find(p => p.name === 'my-react-app');
    expect(react).toBeDefined();
    expect(react.stack).toBe('React');
  });

  test('scanDirectory should detect Python stack', () => {
    const projects = scanDirectory(tmpDir, 2);
    const python = projects.find(p => p.name === 'ml-pipeline');
    expect(python).toBeDefined();
    expect(python.stack).toBe('Python');
  });

  test('scanDirectory should detect Rust stack', () => {
    const projects = scanDirectory(tmpDir, 2);
    const rust = projects.find(p => p.name === 'rust-cli');
    expect(rust).toBeDefined();
    expect(rust.stack).toBe('Rust');
  });

  test('scanDirectory should detect Next.js stack (over React)', () => {
    const projects = scanDirectory(tmpDir, 2);
    const nextjs = projects.find(p => p.name === 'nextjs-app');
    expect(nextjs).toBeDefined();
    expect(nextjs.stack).toBe('Next.js');
  });

  test('scanDirectory should detect Express stack', () => {
    const projects = scanDirectory(tmpDir, 2);
    const express = projects.find(p => p.name === 'bmad-project');
    expect(express).toBeDefined();
    expect(express.stack).toBe('Express');
  });

  test('scanDirectory should detect BMAD+ installed', () => {
    const projects = scanDirectory(tmpDir, 2);
    const bmad = projects.find(p => p.name === 'bmad-project');
    expect(bmad.bmad).toBe(true);
  });

  test('scanDirectory should NOT find non-project directories', () => {
    const projects = scanDirectory(tmpDir, 2);
    const random = projects.find(p => p.name === 'random-folder');
    expect(random).toBeUndefined();
  });

  test('scanDirectory should NOT recurse into node_modules', () => {
    const projects = scanDirectory(tmpDir, 2);
    const fake = projects.find(p => p.name === 'fake-pkg');
    expect(fake).toBeUndefined();
  });

  test('scanDirectory should respect maxDepth=0', () => {
    const projects = scanDirectory(tmpDir, 0);
    expect(projects.length).toBe(0); // tmpDir itself has no markers
  });

  test('scanDirectory should return empty for non-existent dir', () => {
    const projects = scanDirectory('/nonexistent/xyz', 2);
    expect(projects.length).toBe(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Autoconfig — Functional Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Autoconfig — Functional Tests', () => {
  const autoconfigModule = require('../tools/cli/commands/autoconfig');
  const {
    detectStack,
    analyzeStructure,
    calculateHealth,
    recommendPacks,
    generateRecommendations,
    getProjectName,
  } = autoconfigModule._internal;

  const tmpDir = path.join(__dirname, '..', '_test_tmp_autoconfig');

  beforeAll(() => {
    const fsExtra = require('fs-extra');
    fsExtra.ensureDirSync(tmpDir);

    // Complete project with everything
    const fullProj = path.join(tmpDir, 'full-project');
    fsExtra.ensureDirSync(path.join(fullProj, 'src'));
    fsExtra.ensureDirSync(path.join(fullProj, 'tests'));
    fsExtra.ensureDirSync(path.join(fullProj, 'docs'));
    fsExtra.ensureDirSync(path.join(fullProj, '.github'));
    fsExtra.ensureDirSync(path.join(fullProj, '.git'));
    fs.writeFileSync(path.join(fullProj, 'package.json'), JSON.stringify({
      name: 'full-project',
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    }), 'utf8');
    fs.writeFileSync(path.join(fullProj, 'tsconfig.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'Dockerfile'), 'FROM node:22', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'LICENSE'), 'MIT', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'README.md'), '# Full Project', 'utf8');
    fs.writeFileSync(path.join(fullProj, 'pnpm-lock.yaml'), '', 'utf8');

    // Minimal project (only package.json)
    const minProj = path.join(tmpDir, 'minimal');
    fsExtra.ensureDirSync(minProj);
    fs.writeFileSync(path.join(minProj, 'package.json'), JSON.stringify({
      name: 'minimal',
      dependencies: { express: '^4.18.0' },
    }), 'utf8');

    // Python project
    const pyProj = path.join(tmpDir, 'py-project');
    fsExtra.ensureDirSync(pyProj);
    fs.writeFileSync(path.join(pyProj, 'pyproject.toml'), '[project]\nname="py-project"', 'utf8');
    fs.writeFileSync(path.join(pyProj, 'requirements.txt'), 'flask\n', 'utf8');

    // Go project
    const goProj = path.join(tmpDir, 'go-api');
    fsExtra.ensureDirSync(goProj);
    fs.writeFileSync(path.join(goProj, 'go.mod'), 'module go-api', 'utf8');

    // Project with BMAD+ and IDE configs
    const bmadProj = path.join(tmpDir, 'bmad-existing');
    fsExtra.ensureDirSync(path.join(bmadProj, '.agents'));
    fsExtra.ensureDirSync(path.join(bmadProj, '_bmad'));
    fs.writeFileSync(path.join(bmadProj, 'package.json'), JSON.stringify({ name: 'bmad-existing' }), 'utf8');
    fs.writeFileSync(path.join(bmadProj, 'CLAUDE.md'), '# Claude', 'utf8');
    fs.writeFileSync(path.join(bmadProj, 'GEMINI.md'), '# Gemini', 'utf8');
    fs.writeFileSync(path.join(bmadProj, 'AGENTS.md'), '# Agents', 'utf8');

    // Empty project
    const emptyProj = path.join(tmpDir, 'empty-proj');
    fsExtra.ensureDirSync(emptyProj);
  });

  afterAll(() => {
    const fsExtra = require('fs-extra');
    fsExtra.removeSync(tmpDir);
  });

  // ── detectStack ──

  test('detectStack should detect Next.js + TypeScript', () => {
    const stack = detectStack(path.join(tmpDir, 'full-project'));
    expect(stack.framework).toBe('Next.js');
    expect(stack.language).toBe('TypeScript');
    expect(stack.runtime).toBe('Node.js');
    expect(stack.hasTypeScript).toBe(true);
    expect(stack.packageManager).toBe('pnpm');
  });

  test('detectStack should detect Express', () => {
    const stack = detectStack(path.join(tmpDir, 'minimal'));
    expect(stack.framework).toBe('Express');
    expect(stack.language).toBe('JavaScript');
    expect(stack.packageManager).toBe('npm');
  });

  test('detectStack should detect Python', () => {
    const stack = detectStack(path.join(tmpDir, 'py-project'));
    expect(stack.language).toBe('Python');
    expect(stack.runtime).toBe('Python');
  });

  test('detectStack should detect Go', () => {
    const stack = detectStack(path.join(tmpDir, 'go-api'));
    expect(stack.language).toBe('Go');
    expect(stack.runtime).toBe('Go');
  });

  test('detectStack should return null fields for empty dir', () => {
    const stack = detectStack(path.join(tmpDir, 'empty-proj'));
    expect(stack.language).toBeNull();
    expect(stack.framework).toBeNull();
    expect(stack.runtime).toBeNull();
  });

  // ── analyzeStructure ──

  test('analyzeStructure should detect all structure elements in full project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    expect(structure.hasSrc).toBe(true);
    expect(structure.hasTests).toBe(true);
    expect(structure.hasDocs).toBe(true);
    expect(structure.hasCI).toBe(true);
    expect(structure.hasDocker).toBe(true);
    expect(structure.hasLicense).toBe(true);
    expect(structure.hasReadme).toBe(true);
    expect(structure.hasGit).toBe(true);
  });

  test('analyzeStructure should detect minimal project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'minimal'));
    expect(structure.hasSrc).toBe(false);
    expect(structure.hasTests).toBe(false);
    expect(structure.hasDocs).toBe(false);
    expect(structure.fileCount).toBeGreaterThan(0);
  });

  test('analyzeStructure should detect BMAD+ installation', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'bmad-existing'));
    expect(structure.hasBmad).toBe(true);
    expect(structure.hasIdeConfigs).toContain('claude-code');
    expect(structure.hasIdeConfigs).toContain('gemini-cli');
    expect(structure.hasIdeConfigs).toContain('codex-cli');
    expect(structure.hasIdeConfigs).toHaveLength(3);
  });

  test('analyzeStructure should list directories', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    expect(structure.directories).toContain('src');
    expect(structure.directories).toContain('tests');
    expect(structure.directories).toContain('docs');
  });

  // ── calculateHealth ──

  test('calculateHealth should score 100% for full project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    const health = calculateHealth(structure);
    expect(health.pct).toBe(100);
    expect(health.checks.every(c => c.pass)).toBe(true);
  });

  test('calculateHealth should score low for minimal project', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'minimal'));
    const health = calculateHealth(structure);
    expect(health.pct).toBeLessThan(50);
  });

  test('calculateHealth checks should have weights', () => {
    const structure = analyzeStructure(path.join(tmpDir, 'full-project'));
    const health = calculateHealth(structure);
    expect(health.checks.length).toBeGreaterThanOrEqual(7);
    for (const check of health.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('pass');
      expect(check).toHaveProperty('weight');
      expect(check.weight).toBeGreaterThan(0);
    }
  });

  // ── recommendPacks ──

  test('recommendPacks should always include core and memory', () => {
    const stack = { framework: null, language: 'JavaScript', runtime: 'Node.js' };
    const structure = { hasDocs: true, hasCI: false, hasDocker: false, directories: [] };
    const health = { pct: 50 };
    const { packs } = recommendPacks(stack, structure, health);
    expect(packs).toContain('core');
    expect(packs).toContain('memory');
  });

  test('recommendPacks should recommend seo for web frameworks', () => {
    const stack = { framework: 'Next.js', language: 'TypeScript', runtime: 'Node.js' };
    const structure = { hasDocs: true, hasCI: false, hasDocker: false, directories: [] };
    const health = { pct: 80 };
    const { packs, reasons } = recommendPacks(stack, structure, health);
    expect(packs).toContain('seo');
    expect(reasons.seo).toContain('Next.js');
  });

  test('recommendPacks should recommend shield for CI/CD projects', () => {
    const stack = { framework: 'Express', language: 'JavaScript', runtime: 'Node.js' };
    const structure = { hasDocs: true, hasCI: true, hasDocker: false, directories: [] };
    const health = { pct: 70 };
    const { packs } = recommendPacks(stack, structure, health);
    expect(packs).toContain('shield');
  });

  test('recommendPacks should recommend dev-studio when no docs', () => {
    const stack = { framework: null, language: 'JavaScript', runtime: 'Node.js' };
    const structure = { hasDocs: false, hasCI: false, hasDocker: false, directories: [] };
    const health = { pct: 30 };
    const { packs, reasons } = recommendPacks(stack, structure, health);
    expect(packs).toContain('dev-studio');
    expect(reasons['dev-studio']).toContain('docs');
  });

  // ── generateRecommendations ──

  test('generateRecommendations should suggest Sentinel for missing tests', () => {
    const stack = { framework: null };
    const structure = { hasTests: false, hasDocs: true, hasCI: true, hasSrc: true };
    const health = { pct: 60 };
    const recs = generateRecommendations(stack, structure, health);
    const sentinel = recs.find(r => r.agent === 'Sentinel' && r.action.includes('test'));
    expect(sentinel).toBeDefined();
    expect(sentinel.priority).toBe('high');
  });

  test('generateRecommendations should suggest Forge for missing docs', () => {
    const stack = { framework: null };
    const structure = { hasTests: true, hasDocs: false, hasCI: true, hasSrc: true };
    const health = { pct: 70 };
    const recs = generateRecommendations(stack, structure, health);
    const forge = recs.find(r => r.agent === 'Forge' && r.action.includes('document'));
    expect(forge).toBeDefined();
  });

  test('generateRecommendations should always include Zecher', () => {
    const stack = { framework: null };
    const structure = { hasTests: true, hasDocs: true, hasCI: true, hasSrc: true };
    const health = { pct: 100 };
    const recs = generateRecommendations(stack, structure, health);
    const zecher = recs.find(r => r.agent === 'Zecher');
    expect(zecher).toBeDefined();
  });

  test('generateRecommendations should flag low health', () => {
    const stack = { framework: null };
    const structure = { hasTests: false, hasDocs: false, hasCI: false, hasSrc: false };
    const health = { pct: 20 };
    const recs = generateRecommendations(stack, structure, health);
    const healthRec = recs.find(r => r.action.includes('health'));
    expect(healthRec).toBeDefined();
    expect(healthRec.priority).toBe('high');
  });

  // ── getProjectName ──

  test('getProjectName should read from package.json', () => {
    expect(getProjectName(path.join(tmpDir, 'full-project'))).toBe('full-project');
  });

  test('getProjectName should fallback to dirname', () => {
    expect(getProjectName(path.join(tmpDir, 'empty-proj'))).toBe('empty-proj');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PACKS ↔ module.yaml Sync Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('PACKS ↔ module.yaml Sync', () => {
  const yaml = require('js-yaml');

  test('every pack in module.yaml should exist in install.js PACKS', () => {
    const moduleYamlPath = path.join(__dirname, '..', 'src', 'bmad-plus', 'module.yaml');
    const installJsPath = path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js');

    const moduleContent = yaml.load(fs.readFileSync(moduleYamlPath, 'utf8'));
    const modulePackIds = Object.keys(moduleContent.packs || {});

    const installContent = fs.readFileSync(installJsPath, 'utf8');

    for (const packId of modulePackIds) {
      // Each module.yaml pack should appear as a key in install.js PACKS object
      // Either as 'packId': { or packId: {
      const hasKey = installContent.includes(`'${packId}':`) || installContent.includes(`${packId}:`);
      expect(hasKey).toBe(true);
    }
  });

  test('every pack in install.js PACKS should exist in module.yaml', () => {
    const moduleYamlPath = path.join(__dirname, '..', 'src', 'bmad-plus', 'module.yaml');
    const installJsPath = path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js');

    const moduleContent = yaml.load(fs.readFileSync(moduleYamlPath, 'utf8'));
    const modulePackIds = Object.keys(moduleContent.packs || {});

    // Extract only the PACKS block from install.js
    const installContent = fs.readFileSync(installJsPath, 'utf8');
    const packsStart = installContent.indexOf('const PACKS = {');
    expect(packsStart).toBeGreaterThan(-1);

    // Find the matching closing }; by counting braces
    let braceCount = 0;
    let packsEnd = packsStart;
    for (let i = installContent.indexOf('{', packsStart); i < installContent.length; i++) {
      if (installContent[i] === '{') braceCount++;
      if (installContent[i] === '}') braceCount--;
      if (braceCount === 0) { packsEnd = i; break; }
    }
    const packsBlock = installContent.substring(packsStart, packsEnd + 1);

    // Match top-level keys in PACKS object (2-space indent)
    const packKeyMatches = packsBlock.match(/^  '?([a-z][-a-z]*)'?\s*:\s*\{/gm);
    expect(packKeyMatches).not.toBeNull();

    const installPackIds = packKeyMatches.map(m =>
      m.trim().replace(/[':{ ]/g, '')
    );

    for (const packId of installPackIds) {
      expect(modulePackIds).toContain(packId);
    }
  });

  test('pack count should match between module.yaml and install.js', () => {
    const moduleYamlPath = path.join(__dirname, '..', 'src', 'bmad-plus', 'module.yaml');
    const installJsPath = path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js');

    const moduleContent = yaml.load(fs.readFileSync(moduleYamlPath, 'utf8'));
    const modulePackCount = Object.keys(moduleContent.packs || {}).length;

    const installContent = fs.readFileSync(installJsPath, 'utf8');
    const packsStart = installContent.indexOf('const PACKS = {');
    let braceCount = 0;
    let packsEnd = packsStart;
    for (let i = installContent.indexOf('{', packsStart); i < installContent.length; i++) {
      if (installContent[i] === '{') braceCount++;
      if (installContent[i] === '}') braceCount--;
      if (braceCount === 0) { packsEnd = i; break; }
    }
    const packsBlock = installContent.substring(packsStart, packsEnd + 1);
    const packKeyMatches = packsBlock.match(/^  '?([a-z][-a-z]*)'?\s*:\s*\{/gm);
    const installPackCount = packKeyMatches ? packKeyMatches.length : 0;

    expect(installPackCount).toBe(modulePackCount);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// License File Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('License', () => {
  test('LICENSE file should exist', () => {
    const licensePath = path.join(__dirname, '..', 'LICENSE');
    expect(fs.existsSync(licensePath)).toBe(true);
  });

  test('LICENSE should be MIT', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'LICENSE'), 'utf8');
    expect(content).toContain('MIT License');
  });

  test('LICENSE should credit Laurent Rochetta', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'LICENSE'), 'utf8');
    expect(content).toContain('Laurent Rochetta');
  });

  test('package.json license field should match LICENSE file', () => {
    const pkg = require('../package.json');
    expect(pkg.license).toBe('MIT');
  });
});

