import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript support
  {
    files: ['**/*.ts', '**/*.tsx'], // Target TypeScript files
    languageOptions: {
      parser: tsparser,
      globals: {
        ...globals.node, // Node.js globals (includes console, process, etc.)
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Enable TypeScript-specific rules
      ...tseslint.configs.recommended.rules,
      // Suppress warnings about using 'any'
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Node.js environment for non-TypeScript files (e.g., .js, .mjs)
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node, // Node.js globals
      },
    },
    rules: {
      // Add any custom Node rules here if needed
    },
  },

  // Prettier integration: Disable conflicting ESLint rules
  prettierConfig,

  // Ignore patterns (adjust as needed)
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
  },
];
