const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const { fixupPluginRules } = require('@eslint/compat');
const securityPlugin = require('eslint-plugin-security');
const noSecretsPlugin = require('eslint-plugin-no-secrets');

module.exports = defineConfig([
  ...expoConfig,
  prettierConfig,
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
      security: fixupPluginRules(securityPlugin),
      'no-secrets': fixupPluginRules(noSecretsPlugin),
    },
    rules: {
      'no-console': ['error', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // eslint-plugin-security recommended set, promoted from warn -> error.
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-object-injection': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-bidi-characters': 'error',

      // High-entropy string detection. ignoreContent grows as legitimate fixtures appear.
      'no-secrets/no-secrets': [
        'error',
        {
          tolerance: 4.5,
          ignoreContent: [],
        },
      ],
    },
  },
  {
    // Typed-aware linting: every async result must be awaited, returned, or explicitly voided.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'test/**/*.ts',
      'test/**/*.tsx',
      'jest.setup.*',
    ],
    rules: {
      'no-console': 'off',
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'android/', 'ios/', '.expo/', 'dist/', '.wdk/', '.wdk-bundle/', 'e2e/'],
  },
]);
