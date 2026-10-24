import type { RaThemeOptions } from 'react-admin';
import { fontFamily, radius, sidebarWidth, spacingUnit, tabularNums } from './tokens';

/** Mode-independent theme structure: type scale, shape, spacing, sidebar. */
export const baseTheme: RaThemeOptions = {
  spacing: spacingUnit,
  shape: { borderRadius: radius.md },
  sidebar: { width: sidebarWidth.open, closedWidth: sidebarWidth.closed },
  typography: {
    fontFamily,
    // Tightened from MUI defaults: headings in a data tool label regions
    // rather than open articles, so they sit closer to the content.
    h1: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontSize: '1.125rem', fontWeight: 600 },
    h5: { fontSize: '1rem', fontWeight: 600 },
    h6: { fontSize: '0.9375rem', fontWeight: 600 },
    subtitle1: { fontSize: '0.875rem', fontWeight: 600 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    button: { textTransform: 'none', fontWeight: 600 },
    // Plain small text — the existing code uses `caption` for sentence-case
    // labels and values, so it must not force case or tracking.
    caption: { fontSize: '0.75rem', fontWeight: 400, letterSpacing: 0 },
    // The uppercase section-label treatment lives here instead
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      lineHeight: 1.6,
    },
  },
};

/** Applied to numeric, currency, and date fields so columns stay aligned. */
export const tabularNumsStyle = tabularNums;
