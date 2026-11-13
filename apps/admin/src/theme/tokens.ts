/**
 * Design primitives for the admin panel.
 * Framework-agnostic on purpose — no MUI imports — so the same values can back
 * a theme, a test assertion, or a future non-MUI surface.
 *
 * Palette: the website's orange brand (shared with fe), blue-tinted navy neutrals.
 */

/**
 * Blue-tinted neutral ramp, anchored on Stripe's navy (#0A2540) and light
 * surface (#F6F9FC). The blue tint is what keeps it from reading as flat grey.
 */
export const neutral = {
  50: '#F6F9FC',
  100: '#EFF3F8',
  200: '#E3E8EE',
  300: '#C1C9D2',
  400: '#8792A2',
  500: '#697386',
  600: '#425466',
  700: '#3C4257',
  800: '#1A2E45',
  900: '#0A2540',
  950: '#061C2E',
} as const;

/**
 * Website brand orange (fe `#fd7e14`), Open Color orange steps. The admin uses one orange: 500
 * for everything (text, fills, borders, focus), 400 for hover, 50/100 for light washes. The
 * darker 600–900 steps are kept for reference only — don't use them in the UI.
 */
export const brand = {
  50: '#FFF4E6',
  100: '#FFE8CC',
  200: '#FFD8A8',
  300: '#FFC078',
  400: '#FFA94D',
  500: '#FD7E14',
  600: '#E8590C',
  700: '#C2410C',
  800: '#9A3412',
  900: '#7C2D12',
} as const;

/** Translucent brand wash for dark-mode hover/active/selected backgrounds. */
export const brandTint = (alpha: number): string => `rgba(253, 126, 20, ${alpha})`;

/**
 * `light` is the dark-mode-facing tint and `main` the light-mode one — dark
 * grounds need the brighter step to stay legible.
 */
export const semantic = {
  success: { light: '#5FD08A', main: '#0E7C3A', dark: '#0A5C2B' },
  warning: { light: '#F5A623', main: '#B54708', dark: '#8A3603' },
  error: { light: '#F2557A', main: '#DF1B41', dark: '#B01230' },
  info: { light: '#5AA9F5', main: '#0570DE', dark: '#0455A8' },
} as const;

export const fontFamily = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(', ');

export const monoFontFamily = [
  '"SF Mono"',
  'SFMono-Regular',
  'Menlo',
  'Consolas',
  '"Liberation Mono"',
  'monospace',
].join(', ');

export const radius = { sm: 6, md: 8, lg: 12 } as const;

export const spacingUnit = 8;

export const duration = { fast: 120, base: 180 } as const;

export const sidebarWidth = { open: 256, closed: 56 } as const;

/** Datagrid rows: RA's default height wastes vertical space on dense lists. */
export const rowHeight = 44;

/** Standalone tables (e.g. dashboard) scroll inside themselves past this height. */
export const tableMaxHeight = 'calc(100dvh - 240px)';

/** Text cells wider than this end in an ellipsis; the full text shows in a tooltip. */
export const cellMaxWidth = 320;

/** Rows per page every list starts with. */
export const listRowsPerPage = 50;

/** Long option lists scroll instead of covering the page: about seven options. */
export const dropdownMaxHeight = 320;

/** Filters whose values are long, e.g. email addresses. */
export const filterInputWidth = { wide: 320 } as const;

/**
 * Figures must align vertically across rows to be scannable — proportional
 * digits break column alignment in every numeric and date field.
 */
export const tabularNums = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
} as const;

/** Shown in place of a blank table cell or show-view value. */
export const EMPTY_CELL = '-';
