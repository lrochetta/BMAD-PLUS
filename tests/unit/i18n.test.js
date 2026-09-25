/**
 * BMAD+ CLI — i18n Unit Tests
 * Tests for internationalization module
 *
 * Run: npx jest tests/unit/i18n.test.js
 */

const {
  LANGUAGES,
  t,
  getLanguageOptions,
  getCommLanguageOptions,
} = require('../../tools/cli/i18n');

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
    'flag',
    'name',
    'locale',
    'installer_title',
    'select_language',
    'installing_to',
    'select_packs',
    'select_ide',
    'detected_ides',
    'selected_packs',
    'enter_name',
    'comm_language',
    'uat_environment',
    'exec_mode',
    'exec_manual',
    'exec_autopilot',
    'exec_hybrid',
    'installing_files',
    'configuring_ides',
    'installed_summary',
    'ide_configured',
    'cancelled',
    'failed',
    'source_not_found',
    'soon',
    'guide_title',
    'guide_who',
    'guide_idea',
    'guide_prd',
    'guide_arch',
    'guide_code',
    'guide_test',
    'guide_sprint',
    'guide_auto',
    'guide_osint',
    'guide_maker',
    'guide_seo',
    'guide_backup',
    'guide_animated',
    'guide_workflow',
    'guide_or_auto',
    'guide_output',
    'guide_ready',
    'guide_credits',
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
    'uninstall_confirm',
    'uninstall_removing',
    'uninstall_done',
    'uninstall_output_kept',
    'installed_on',
    'update_confirm',
    'update_updating',
    'update_done',
    'update_current',
    'update_ready',
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
    'guide_cli_title',
    'guide_cli_install',
    'guide_cli_update',
    'guide_cli_doctor',
    'guide_cli_uninstall',
    'guide_examples_title',
    'guide_example_seo',
    'guide_example_backup',
    'guide_example_animated',
    'guide_example_osint',
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
