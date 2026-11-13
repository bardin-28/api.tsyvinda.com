import {
  BLOCK_DEFINITIONS,
  DEFAULT_LOCALE,
  LOCALES,
  PAGE_DEFINITIONS,
  type DraftBlock,
  type FieldDefinitions,
  type Locale,
  type LocalizedImageUrl,
  type PageContent,
  type PageKey,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { uuidv7 } from '../../../shared/uuid-v7';
import {
  countTranslations,
  imageUrls,
  missingRequiredFields,
  normalizeFieldValues,
  type FieldErrors,
  type TranslationCounts,
} from './field-values';

/** Error paths match the request body: `{ draft: { title, seo, blocks } }`. */
const DRAFT = 'draft';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Page title and SEO texts, described like block fields so they share validation. */
export const PAGE_META_FIELDS = {
  title: { kind: 'text', localized: true, label: 'Page name', required: true, max: 120 },
} as const satisfies FieldDefinitions;

export const PAGE_SEO_FIELDS = {
  title: { kind: 'text', localized: true, label: 'OG title', required: true, max: 120 },
  description: {
    kind: 'text',
    localized: true,
    multiline: true,
    label: 'OG description',
    required: true,
    max: 400,
  },
  keywords: { kind: 'text', localized: true, multiline: true, label: 'Keywords', max: 1000 },
} as const satisfies FieldDefinitions;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MAX_IMAGE_URL_LENGTH = 1024;

/** Stored OG image(s) → one URL (or null) per language; a legacy single URL serves every language. */
export function readOgImageUrls(raw: unknown): LocalizedImageUrl {
  const pick = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  const shared = typeof raw === 'string' ? pick(raw) : null;
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, isRecord(raw) ? pick(raw[locale]) : shared]),
  ) as LocalizedImageUrl;
}

/** Sent OG images, each checked to be an https URL (`draft.seo.ogImageUrl.<locale>` errors). */
function normalizeOgImageUrls(raw: unknown, errors: FieldErrors): LocalizedImageUrl {
  const urls = readOgImageUrls(raw);
  for (const locale of LOCALES) {
    const url = urls[locale];
    if (url && (!/^https:\/\/\S+$/.test(url) || url.length > MAX_IMAGE_URL_LENGTH)) {
      errors[`${DRAFT}.seo.ogImageUrl.${locale}`] = 'Must be an https URL';
    }
  }
  return urls;
}

/** OG image the website shows in `locale`: its own, else the English one, else none (the card). */
export function ogImageFor(raw: unknown, locale: Locale): string | null {
  const urls = readOgImageUrls(raw);
  return urls[locale] ?? urls[DEFAULT_LOCALE] ?? null;
}

function validationError(errors: FieldErrors): HttpError {
  return new HttpError(400, 'VALIDATION_FAILED', 'Page content is invalid', {
    fieldErrors: errors,
  });
}

/**
 * Content as sent by the admin panel → canonical PageContent, or 400 with field errors.
 *
 * Sections are fixed per page (PAGE_DEFINITIONS[key].sections): the result always has exactly
 * those, in that order, with their hardcoded anchors. A sent section is matched by position and
 * type; a missing or mismatched one starts empty. Extra sections are ignored.
 */
export function normalizePageContent(key: PageKey, raw: unknown): PageContent {
  const errors: FieldErrors = {};
  const source = isRecord(raw) ? raw : {};
  const seoSource = isRecord(source.seo) ? source.seo : {};

  const meta = normalizeFieldValues(PAGE_META_FIELDS, { title: source.title }, DRAFT, errors);
  const seoTexts = normalizeFieldValues(PAGE_SEO_FIELDS, seoSource, `${DRAFT}.seo`, errors);

  const ogImageUrl = normalizeOgImageUrls(seoSource.ogImageUrl, errors);

  if (source.blocks !== undefined && !Array.isArray(source.blocks))
    errors[`${DRAFT}.blocks`] = 'Must be a list';
  const rawBlocks: unknown[] = Array.isArray(source.blocks) ? source.blocks : [];

  const ids = new Set<string>();
  const blocks: DraftBlock[] = PAGE_DEFINITIONS[key].sections.map((section, index) => {
    const candidate = rawBlocks[index];
    const rawBlock: Record<string, unknown> =
      isRecord(candidate) && candidate.type === section.type ? candidate : {};
    const id =
      typeof rawBlock.id === 'string' && UUID_REGEX.test(rawBlock.id) && !ids.has(rawBlock.id)
        ? rawBlock.id
        : uuidv7();
    ids.add(id);
    return {
      id,
      type: section.type,
      anchor: ('anchor' in section ? section.anchor : undefined) ?? null,
      data: normalizeFieldValues(
        BLOCK_DEFINITIONS[section.type].fields,
        rawBlock.data,
        `${DRAFT}.blocks.${index}.data`,
        errors,
      ),
    };
  });

  if (Object.keys(errors).length > 0) throw validationError(errors);

  return {
    title: meta.title as PageContent['title'],
    seo: {
      title: seoTexts.title as PageContent['seo']['title'],
      description: seoTexts.description as PageContent['seo']['description'],
      keywords: seoTexts.keywords as PageContent['seo']['keywords'],
      ogImageUrl,
      noindex: seoSource.noindex === true,
    },
    blocks,
  };
}

/** Every required field still empty in `locales`, as field paths (saving is refused while any is). */
export function missingRequired(content: PageContent, locales: readonly Locale[]): string[] {
  const missing = [
    ...missingRequiredFields(PAGE_META_FIELDS, { title: content.title }, locales, DRAFT),
    ...missingRequiredFields(PAGE_SEO_FIELDS, { ...content.seo }, locales, `${DRAFT}.seo`),
  ];
  content.blocks.forEach((block, index) => {
    missing.push(
      ...missingRequiredFields(
        BLOCK_DEFINITIONS[block.type].fields,
        block.data,
        locales,
        `${DRAFT}.blocks.${index}.data`,
      ),
    );
  });
  return missing;
}

/** Normalised, de-duplicated list of enabled languages (at least one). */
export function normalizeEnabledLocales(raw: unknown): Locale[] {
  const list = Array.isArray(raw) ? raw : [];
  const locales = LOCALES.filter((locale) => list.includes(locale));
  if (locales.length === 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Enable at least one language', {
      fieldErrors: { enabledLocales: `Choose from: ${LOCALES.join(', ')}` },
    });
  }
  return locales;
}

/** URLs of every image the content shows (SEO share image included). */
export function pageImageUrls(content: PageContent): string[] {
  const urls = content.blocks.flatMap((block) => {
    const def = BLOCK_DEFINITIONS[block.type];
    return def ? imageUrls(def.fields, block.data) : [];
  });
  for (const url of Object.values(readOgImageUrls(content.seo.ogImageUrl))) {
    if (url) urls.push(url);
  }
  return urls;
}

/** Share of translatable texts filled in per language (0–100; 100 when the page has none). */
export function translationProgress(content: PageContent): Record<Locale, number> {
  const counts: TranslationCounts = {
    total: 0,
    filled: Object.fromEntries(LOCALES.map((locale) => [locale, 0])) as Record<Locale, number>,
  };
  countTranslations(PAGE_META_FIELDS, { title: content.title }, counts);
  countTranslations(PAGE_SEO_FIELDS, { ...content.seo }, counts);
  for (const block of content.blocks) {
    const def = BLOCK_DEFINITIONS[block.type];
    if (def) countTranslations(def.fields, block.data, counts);
  }
  return Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      counts.total === 0 ? 100 : Math.floor((counts.filled[locale] / counts.total) * 100),
    ]),
  ) as Record<Locale, number>;
}

/** Empty content of a page (used when a key has no row yet). */
export function emptyPageContent(): PageContent {
  const empty = Object.fromEntries(LOCALES.map((locale) => [locale, ''])) as Record<Locale, string>;
  return {
    title: { ...empty },
    seo: {
      title: { ...empty },
      description: { ...empty },
      keywords: { ...empty },
      ogImageUrl: readOgImageUrls(null),
      noindex: false,
    },
    blocks: [],
  };
}
