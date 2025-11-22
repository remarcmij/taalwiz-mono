import { config as baseConfig } from './base.js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export const config = tseslint.config(...baseConfig, {
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.jest,
    },
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
});
