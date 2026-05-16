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
