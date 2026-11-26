import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  HTMLCanvasElement: 'readonly',
  HTMLDialogElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLElement: 'readonly',
  HTMLDivElement: 'readonly',
  PointerEvent: 'readonly',
  KeyboardEvent: 'readonly',
  Event: 'readonly',
  MediaQueryList: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AudioContext: 'readonly',
  fetch: 'readonly',
  HTMLAudioElement: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'graphify-out/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
  },
  {
    files: ['tests/**/*.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
