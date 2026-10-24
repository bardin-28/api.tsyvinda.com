import globals from 'globals';
import sharedConfig from '@tsyvinda/eslint-config';

export default [
  { ignores: ['docs/**', '.claude/**'] },
  ...sharedConfig,
  {
    files: ['apps/api/**/*.{ts,tsx}', 'packages/**/*.{js,ts}', '*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
