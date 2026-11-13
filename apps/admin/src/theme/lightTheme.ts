import { deepMerge } from './deepMerge';
import { defaultLightTheme, type RaThemeOptions } from 'react-admin';
import { baseTheme } from './base';
import { buildComponents } from './components';
import { brand, neutral, semantic } from './tokens';

export const lightTheme: RaThemeOptions = deepMerge(deepMerge(defaultLightTheme, baseTheme), {
  palette: {
    mode: 'light',
    // One orange (the website's) for fills, text and borders; text on orange fills is white.
    primary: {
      light: brand[400],
      main: brand[500],
      // Hover lightens instead of darkening: one orange, no dark shades
      dark: brand[400],
      contrastText: '#FFFFFF',
    },
    secondary: {
      light: neutral[500],
      main: neutral[700],
      dark: neutral[800],
      contrastText: '#FFFFFF',
    },
    success: { ...semantic.success, contrastText: '#FFFFFF' },
    warning: { ...semantic.warning, contrastText: '#FFFFFF' },
    error: { ...semantic.error, contrastText: '#FFFFFF' },
    info: { ...semantic.info, contrastText: '#FFFFFF' },
    background: { default: neutral[50], paper: '#FFFFFF' },
    text: {
      primary: neutral[900],
      secondary: neutral[600],
      disabled: neutral[400],
    },
    divider: neutral[200],
    bulkActionsToolbarBackgroundColor: brand[50],
  },
  components: buildComponents('light'),
} satisfies RaThemeOptions);
