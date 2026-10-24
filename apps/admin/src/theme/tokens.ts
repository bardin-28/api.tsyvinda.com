/**
 * Design primitives for the admin panel.
 * Framework-agnostic on purpose — no MUI imports — so the same values can back
 * a theme, a test assertion, or a future non-MUI surface.
 *
 * Palette references Stripe's: blurple brand, blue-tinted navy neutrals.
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

/** Stripe blurple. 500 is the signature value and clears AA on white. */
export const brand = {
  50: '#F5F4FF',
  100: '#EBE9FE',
  200: '#D7D4FF',
  300: '#A9A4FF',
  400: '#8B85FF',
  500: '#635BFF',
  600: '#5548C8',
  700: '#4A3FB0',
  800: '#3A3191',
  900: '#2D2675',
} as const;

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

/** Tables scroll inside themselves; the offset leaves room for app bar, list toolbar and pagination. */
export const tableMaxHeight = 'calc(100dvh - 240px)';

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
