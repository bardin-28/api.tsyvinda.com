/** Languages the website and its content are published in. English is the default. */
export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Request header the admin panel sends with the language being edited. */
export const CONTENT_LOCALE_HEADER = 'x-content-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
