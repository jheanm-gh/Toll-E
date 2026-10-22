// Root ESLint config (flat). Expo's config covers TypeScript, React and React Native.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'apps/mobile/src/data/generated/**',
      'apps/mobile/public/**',
      'apps/mobile/.expo/**',
      'coverage/**',
    ],
  },
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/mobile/tsconfig.json', 'packages/core/tsconfig.test.json', 'scripts/tsconfig.json'],
        },
      },
    },
  },
  {
    files: ['scripts/**/*.{ts,mjs}', '**/*.config.{js,ts,mts}', 'packages/core/test/**'],
    rules: { 'import/no-unresolved': 'off' },
  },
]);
