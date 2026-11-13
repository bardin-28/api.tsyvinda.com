import { useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@tsyvinda/shared-types';

/** localStorage key of the language the panel edits content in. */
export const CONTENT_LOCALE_STORAGE_KEY = 'admin.contentLocale';

/** Names shown in the language switcher and on translation hints. */
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  uk: { short: 'UK', name: 'Українська' },
};

function readStored(): Locale {
  try {
    const stored = window.localStorage.getItem(CONTENT_LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Storage blocked (private mode, policies): edit in the default language
    return DEFAULT_LOCALE;
  }
}

let current: Locale = readStored();
const listeners = new Set<() => void>();

/** Language the panel reads and writes translated content in (sent as X-Content-Locale). */
export function getContentLocale(): Locale {
  return current;
}

export function setContentLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    window.localStorage.setItem(CONTENT_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Not remembered across reloads; the switch still applies to this tab
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useContentLocale(): Locale {
  return useSyncExternalStore(subscribe, getContentLocale, getContentLocale);
}

// Unsaved form edits are lost when the language switches (the page reloads its data), so forms
// report their dirty state here and the switcher asks before switching.
let hasUnsavedChanges = false;

export function setUnsavedChanges(dirty: boolean): void {
  hasUnsavedChanges = dirty;
}

export function getUnsavedChanges(): boolean {
  return hasUnsavedChanges;
}

/** Test helper: back to the stored (or default) language. */
export function resetContentLocaleForTests(): void {
  current = readStored();
  hasUnsavedChanges = false;
}
