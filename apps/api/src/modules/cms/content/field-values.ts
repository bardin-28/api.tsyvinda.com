import {
  DEFAULT_LIST_MAX,
  DEFAULT_MULTILINE_MAX,
  DEFAULT_TEXT_MAX,
  IMAGE_URL_MAX,
  LOCALES,
  RICH_TEXT_MAX,
  isPageKey,
  type FieldDefinition,
  type FieldDefinitions,
  type FieldValues,
  type Locale,
  type PageKey,
  type WebsitePageLink,
} from '@tsyvinda/shared-types';
import { isRichTextEmpty, linkedPageKeys, resolvePageLinks, sanitizeRichText } from './rich-text';

/** Field errors keyed by path ("blocks.2.data.roles.0.title.uk"). */
export type FieldErrors = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function textMax(def: FieldDefinition): number {
  if (def.kind === 'text')
    return def.max ?? (def.multiline ? DEFAULT_MULTILINE_MAX : DEFAULT_TEXT_MAX);
  if (def.kind === 'strings') return def.max ?? DEFAULT_MULTILINE_MAX;
  return RICH_TEXT_MAX;
}

function normalizeString(value: unknown, max: number, path: string, errors: FieldErrors): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    errors[path] = 'Must be text';
    return '';
  }
  // Single-line values lose stray line breaks; multiline keep them
  const trimmed = value.trim();
  if (trimmed.length > max) errors[path] = `At most ${max} characters`;
  return trimmed;
}

function normalizeStringList(
  value: unknown,
  max: number,
  path: string,
  errors: FieldErrors,
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors[path] = 'Must be a list';
    return [];
  }
  if (value.length > DEFAULT_LIST_MAX) errors[path] = `At most ${DEFAULT_LIST_MAX} entries`;
  return value
    .map((entry, index) => normalizeString(entry, max, `${path}.${index}`, errors))
    .filter((entry) => entry !== '');
}

/** Per-language object; languages that are missing become empty. */
function perLocale<T>(
  value: unknown,
  path: string,
  errors: FieldErrors,
  normalize: (entry: unknown, path: string) => T,
): Record<Locale, T> {
  if (value !== undefined && value !== null && !isRecord(value)) {
    errors[path] = `Must have one value per language (${LOCALES.join(', ')})`;
  }
  const source = isRecord(value) ? value : {};
  const result = {} as Record<Locale, T>;
  for (const locale of LOCALES) result[locale] = normalize(source[locale], `${path}.${locale}`);
  return result;
}

function normalizeField(
  def: FieldDefinition,
  value: unknown,
  path: string,
  errors: FieldErrors,
): unknown {
  switch (def.kind) {
    case 'text': {
      const max = textMax(def);
      return def.localized
        ? perLocale(value, path, errors, (entry, p) => normalizeString(entry, max, p, errors))
        : normalizeString(value, max, path, errors);
    }
    case 'strings': {
      const max = textMax(def);
      return def.localized
        ? perLocale(value, path, errors, (entry, p) => normalizeStringList(entry, max, p, errors))
        : normalizeStringList(value, max, path, errors);
    }
    case 'richText':
      return perLocale(value, path, errors, (entry, p) => {
        const html = normalizeString(entry, RICH_TEXT_MAX, p, errors);
        return html === '' ? '' : sanitizeRichText(html);
      });
    case 'number': {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors[path] = 'Must be a whole number';
        return null;
      }
      if (def.min !== undefined && value < def.min) errors[path] = `At least ${def.min}`;
      if (def.max !== undefined && value > def.max) errors[path] = `At most ${def.max}`;
      return value;
    }
    case 'date': {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string' || !DATE_REGEX.test(value) || Number.isNaN(Date.parse(value))) {
        errors[path] = 'Must be a date (YYYY-MM-DD)';
        return null;
      }
      return value;
    }
    case 'boolean':
      if (value === undefined || value === null) return false;
      if (typeof value !== 'boolean') errors[path] = 'Must be true or false';
      return value === true;
    case 'pageLink':
      if (value === undefined || value === null || value === '') return null;
      if (!isPageKey(value)) {
        errors[path] = 'Unknown page';
        return null;
      }
      return value;
    case 'image': {
      if (value === undefined || value === null || value === '') return null;
      if (
        typeof value !== 'string' ||
        !/^https?:\/\/\S+$/.test(value) ||
        value.length > IMAGE_URL_MAX
      ) {
        errors[path] = 'Must be an uploaded image URL';
        return null;
      }
      return value;
    }
    case 'list': {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) {
        errors[path] = 'Must be a list';
        return [];
      }
      const max = def.max ?? DEFAULT_LIST_MAX;
      if (value.length > max) errors[path] = `At most ${max} entries`;
      return value.map((entry, index) => {
        if (!isRecord(entry)) {
          errors[`${path}.${index}`] = 'Must be an object';
          return {};
        }
        return normalizeFieldValues(def.item, entry, `${path}.${index}`, errors);
      });
    }
    case 'group':
      return normalizeFieldValues(def.fields, value ?? {}, path, errors);
  }
}

/**
 * Checks values against their definitions and returns them in canonical shape: unknown keys
 * dropped, every language present, text trimmed, rich text sanitized. Problems are collected in
 * `errors` (empty required fields are not problems here — drafts may be incomplete).
 */
export function normalizeFieldValues(
  defs: FieldDefinitions,
  values: unknown,
  path: string,
  errors: FieldErrors,
): FieldValues {
  const source = isRecord(values) ? values : {};
  if (values !== undefined && !isRecord(values)) errors[path] = 'Must be an object';
  const result: FieldValues = {};
  for (const [name, def] of Object.entries(defs)) {
    result[name] = normalizeField(def, source[name], join(path, name), errors);
  }
  return result;
}

const join = (path: string, name: string) => (path ? `${path}.${name}` : name);

function isEmpty(def: FieldDefinition, value: unknown, locale: Locale): boolean {
  switch (def.kind) {
    case 'text':
      return (def.localized ? (value as Record<Locale, string>)[locale] : (value as string)) === '';
    case 'strings':
      return (
        (def.localized ? (value as Record<Locale, string[]>)[locale] : (value as string[]))
          .length === 0
      );
    case 'richText':
      return isRichTextEmpty((value as Record<Locale, string>)[locale]);
    case 'list':
      return (value as unknown[]).length === 0;
    case 'boolean':
      return false;
    default:
      return value === null;
  }
}

/**
 * Required fields that are empty in any of `locales` (normalized values only). Required fields
 * inside list entries are checked per entry; an optional empty list is fine.
 */
export function missingRequiredFields(
  defs: FieldDefinitions,
  values: FieldValues,
  locales: readonly Locale[],
  path = '',
): string[] {
  const missing: string[] = [];
  for (const [name, def] of Object.entries(defs)) {
    const value = values[name];
    const fieldPath = join(path, name);
    const localized =
      def.kind === 'richText' || ((def.kind === 'text' || def.kind === 'strings') && def.localized);
    if (def.required) {
      for (const locale of localized ? locales : locales.slice(0, 1)) {
        if (isEmpty(def, value, locale))
          missing.push(localized ? `${fieldPath}.${locale}` : fieldPath);
      }
    }
    if (def.kind === 'list') {
      (value as FieldValues[]).forEach((entry, index) => {
        missing.push(...missingRequiredFields(def.item, entry, locales, `${fieldPath}.${index}`));
      });
    }
    if (def.kind === 'group') {
      missing.push(
        ...missingRequiredFields(def.fields, (value as FieldValues) ?? {}, locales, fieldPath),
      );
    }
  }
  return missing;
}

/** Filled / total translatable texts per language, counted into `counts`. */
export type TranslationCounts = { total: number; filled: Record<Locale, number> };

/**
 * Counts translatable texts (localized text, strings and rich text): each one filled in any
 * language is "total", and per language "filled" when it has a value there.
 */
export function countTranslations(
  defs: FieldDefinitions,
  values: FieldValues,
  counts: TranslationCounts,
): void {
  for (const [name, def] of Object.entries(defs)) {
    const value = values[name];
    const localized =
      def.kind === 'richText' || ((def.kind === 'text' || def.kind === 'strings') && def.localized);
    if (localized) {
      const filledIn = LOCALES.filter((locale) => !isEmpty(def, value, locale));
      if (filledIn.length === 0) continue;
      counts.total += 1;
      for (const locale of filledIn) counts.filled[locale] += 1;
    } else if (def.kind === 'list') {
      for (const entry of (value as FieldValues[] | undefined) ?? [])
        countTranslations(def.item, entry, counts);
    } else if (def.kind === 'group') {
      countTranslations(def.fields, (value as FieldValues | undefined) ?? {}, counts);
    }
  }
}

export interface FlattenContext {
  locale: Locale;
  /** Unprefixed path of a published page in `locale`, null when it is not published there */
  pagePath: (key: PageKey) => string | null;
  /** Public path (with language prefix) of a page in `locale` */
  publicPath: (key: PageKey) => string | null;
}

/** Field values in one language, as the website receives them. */
export function flattenFieldValues(
  defs: FieldDefinitions,
  values: FieldValues,
  ctx: FlattenContext,
): FieldValues {
  const result: FieldValues = {};
  for (const [name, def] of Object.entries(defs)) {
    result[name] = flattenField(def, values[name], ctx);
  }
  return result;
}

function flattenField(def: FieldDefinition, value: unknown, ctx: FlattenContext): unknown {
  switch (def.kind) {
    case 'text':
      return def.localized
        ? ((value as Record<Locale, string> | undefined)?.[ctx.locale] ?? '')
        : (value ?? '');
    case 'strings':
      return def.localized
        ? ((value as Record<Locale, string[]> | undefined)?.[ctx.locale] ?? [])
        : (value ?? []);
    case 'richText': {
      const html = (value as Record<Locale, string> | undefined)?.[ctx.locale] ?? '';
      return resolvePageLinks(html, ctx.publicPath);
    }
    case 'pageLink': {
      if (!isPageKey(value)) return null;
      const link: WebsitePageLink = { key: value, path: ctx.pagePath(value) };
      return link;
    }
    case 'list':
      return ((value as FieldValues[] | undefined) ?? []).map((entry) =>
        flattenFieldValues(def.item, entry, ctx),
      );
    case 'group':
      return flattenFieldValues(def.fields, (value as FieldValues | undefined) ?? {}, ctx);
    default:
      return value ?? null;
  }
}

/** URLs of every image field in a set of values (lists and groups included). */
export function imageUrls(defs: FieldDefinitions, values: FieldValues): string[] {
  const urls: string[] = [];
  for (const [name, def] of Object.entries(defs)) {
    const value = values[name];
    if (def.kind === 'image' && typeof value === 'string') urls.push(value);
    if (def.kind === 'list')
      for (const entry of (value as FieldValues[] | undefined) ?? [])
        urls.push(...imageUrls(def.item, entry));
    if (def.kind === 'group') urls.push(...imageUrls(def.fields, (value as FieldValues) ?? {}));
  }
  return urls;
}

/** Page keys a set of values links to (pageLink fields and `page:` hrefs). */
export function referencedPageKeys(defs: FieldDefinitions, values: FieldValues): PageKey[] {
  const keys = new Set<PageKey>();
  const visit = (d: FieldDefinitions, v: FieldValues) => {
    for (const [name, def] of Object.entries(d)) {
      const value = v[name];
      if (def.kind === 'pageLink' && isPageKey(value)) keys.add(value);
      if (def.kind === 'richText') {
        for (const html of Object.values((value as Record<string, string>) ?? {})) {
          for (const key of linkedPageKeys(html)) keys.add(key);
        }
      }
      if (def.kind === 'list')
        for (const entry of (value as FieldValues[]) ?? []) visit(def.item, entry);
      if (def.kind === 'group') visit(def.fields, (value as FieldValues) ?? {});
    }
  };
  visit(defs, values);
  return [...keys];
}
