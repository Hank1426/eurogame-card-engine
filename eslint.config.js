import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'references/**', '.artifacts/**', 'playwright-report/**', 'test-results/**', 'content/private/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: Object.fromEntries(['console', 'process', 'URL', 'setTimeout', 'clearTimeout', 'structuredClone', 'document', 'window', 'Blob', 'File', 'FileReader', 'indexedDB', 'IDBDatabase', 'IDBRequest', 'IDBTransaction', 'fetch', 'crypto'].map(name => [name, 'readonly']))
    }
  },
  {
    files: ['packages/engine-core/src/**/*.ts', 'packages/mechanisms/src/**/*.ts', 'packages/game-*/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use explicit seeded RNG state.' }, { object: 'Date', property: 'now', message: 'Rules must not read the clock.' }],
      'no-restricted-globals': ['error', { name: 'Date', message: 'Rules must not depend on wall time.' }]
    }
  }
);
