import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';
import { config as baseConfig } from './base.js';

export const config = [
  ...baseConfig,

  // TypeScript rules apply only to TS source files
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ['**/*.ts'],
  })),

  // Angular TS-specific recommendations (also TS only)
  ...angular.configs.tsRecommended.map((c) => ({
    ...c,
    files: ['**/*.ts'],
  })),

  // Custom Angular TS overrides
  {
    files: ['**/*.ts'],
    rules: {
      // '@typescript-eslint/no-explicit-any': 'off', // allow 'any' in Angular code
      '@angular-eslint/component-class-suffix': 'off', // allow non-standard component class suffixes
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },

  // Template (HTML) rules apply only to HTML; avoid TS rules here
  ...angular.configs.templateRecommended.map((c) => ({
    ...c,
    files: ['**/*.html'],
  })),

  // Custom HTML template overrides
  {
    files: ['**/*.html'],
    rules: {
      // If still failing, explicitly disable problematic TS rule in HTML:
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];
