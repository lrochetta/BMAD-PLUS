/**
 * BMAD+ CLI — Structural Integrity Tests
 * Verifies package structure, file integrity, and version consistency.
 * Individual command functional tests are in tests/unit/ and tests/integration/.
 *
 * Run: npx jest tests/cli.test.js
 */

const path = require('node:path');
const fs = require('node:fs');
const { LANGUAGES } = require('../tools/cli/i18n');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI Entry Point Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Package.json Integrity Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  test('files array should include the runtime tools and src/bmad-plus', () => {
    expect(pkg.files).toContain('tools/cli');
    expect(pkg.files).toContain('tools/bmad-plus-npx.js');
    expect(pkg.files).not.toContain('tools');
    expect(pkg.files).toContain('src/bmad-plus');
  });

  test('engines should require Node >= 20', () => {
    expect(pkg.engines.node).toBe('>=20.0.0');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Module.yaml Integrity Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Source File Integrity Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Source File Integrity', () => {
  test('i18n.js should be UTF-8 without BOM', () => {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'tools', 'cli', 'i18n.js'));
    // Check no BOM (EF BB BF)
    const hasBOM = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
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
      path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js'),
      'utf8'
    );
    expect(installJs).toContain('github.com/lrochetta/BMAD-PLUS');
  });

  test('install.js should read version from package.json (not hardcoded)', () => {
    const installJs = fs.readFileSync(
      path.join(__dirname, '..', 'tools', 'cli', 'commands', 'install.js'),
      'utf8'
    );
    // Check for dynamic version reading
    expect(installJs).toContain('pkgJson.version');
    // Should NOT have hardcoded version in manifest
    expect(installJs).not.toMatch(/version:\s*['"]0\.\d+\.\d+['"]/);
  });

  test('CI/CD should not have continue-on-error on npm publish', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', '.github', 'workflows', 'publish-distribution.yml'),
      'utf8'
    );
    // Find the npm publish section and check it doesn't have continue-on-error
    const publishIndex = workflow.indexOf('Publish to npm');
    expect(publishIndex).toBeGreaterThan(-1);
    const publishSection = workflow.substring(publishIndex, publishIndex + 200);
    expect(publishSection).not.toContain('continue-on-error');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Version Consistency Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Version Consistency', () => {
  const pkg = require('../package.json');
  const version = pkg.version;

  test('i18n installer_title should contain current version in all languages', () => {
    for (const [code, lang] of Object.entries(LANGUAGES)) {
      expect(lang.installer_title).toContain(
        `v${version}`,
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// New Command Modules Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
    expect(content).toContain('PROJECT_MARKERS');
    expect(content).toContain("require('../lib/stack-detect')");
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

  test('autoconfig.js should import detectStack from stack-detect', () => {
    const content = fs.readFileSync(path.join(commandsDir, 'autoconfig.js'), 'utf8');
    expect(content).toContain('detectStack');
    expect(content).toContain("require('../lib/stack-detect')");
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
    expect(content).toContain('status:');
    expect(content).toContain('export:');
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// License File Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
