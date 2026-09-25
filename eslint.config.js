/**
 * BMAD+ ESLint flat config (ESLint v9+).
 * Replaces the legacy .eslintrc.json, which ESLint v9 no longer reads —
 * `npm run lint` was silently broken (audit finding TEST-08).
 *
 * Author: Laurent Rochetta
 */
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    // .cjs is linted too: test fixtures and generated verifiers use it, and a config
    // that does not match them reports Node globals as undefined.
    files: ['tools/**/*.js', 'tests/**/*.js', 'tools/**/*.cjs', 'tests/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Jest
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-prototype-builtins': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'upstream/**', '.venv/**', 'audit/**'],
  },
];
