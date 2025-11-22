import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';
import { config as baseConfig } from './base.js';

export const config = [
  ...baseConfig,

  // Spread the recommended configs directly into the array
  ...tseslint.configs.recommended,
  ...angular.configs.tsRecommended,
  ...angular.configs.templateProcessInlineTemplates,

  // Define your custom overrides in a new object
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },

  // Spread HTML template configs
  ...angular.configs.templateRecommended,

  // Custom HTML rules
  {
    files: ['**/*.html'],
    rules: {},
  },
];
