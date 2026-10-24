import { deepMerge } from './deepMerge';
import { defaultDarkTheme, type RaThemeOptions } from 'react-admin';
import { baseTheme } from './base';
import { buildComponents } from './components';
import { brand, neutral, semantic } from './tokens';

export const darkTheme: RaThemeOptions = deepMerge(deepMerge(defaultDarkTheme, baseTheme), {
  palette: {
    mode: 'dark',
    // Brand steps up to 400 on dark ground: 700 fails contrast there.
    primary: {
      light: brand[300],
      main: brand[400],
      dark: brand[600],
      contrastText: neutral[950],
    },
    secondary: {
      light: neutral[300],
      main: neutral[400],
      dark: neutral[600],
      contrastText: neutral[950],
    },
    success: {
      light: semantic.success.light,
      main: semantic.success.light,
      dark: semantic.success.main,
      contrastText: neutral[950],
    },
    warning: {
      light: semantic.warning.light,
      main: semantic.warning.light,
      dark: semantic.warning.main,
      contrastText: neutral[950],
    },
    error: {
      light: semantic.error.light,
      main: semantic.error.light,
      dark: semantic.error.main,
      contrastText: neutral[950],
    },
    info: {
      light: semantic.info.light,
      main: semantic.info.light,
      dark: semantic.info.main,
      contrastText: neutral[950],
    },
    background: { default: neutral[950], paper: neutral[900] },
    text: {
      primary: neutral[100],
      secondary: neutral[400],
      disabled: neutral[600],
    },
    divider: neutral[800],
    bulkActionsToolbarBackgroundColor: 'rgba(139, 133, 255, 0.12)',
  },
  components: buildComponents('dark'),
} satisfies RaThemeOptions);
