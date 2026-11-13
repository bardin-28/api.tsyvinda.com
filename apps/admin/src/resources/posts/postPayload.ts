import type { AdminPost, PostStatus } from '@tsyvinda/shared-types';

/** Form-only flag: true = the cover is the OG image (any own OG image is dropped). */
export const USE_COVER_AS_OG_FIELD = 'useCoverAsOgImage';

/** An image as the form holds it: kept URL, newly picked file, or removed. */
type ImageValue = string | { rawFile: File; src?: string } | null | undefined;

export interface PostFormValues {
  title: string;
  slug: string;
  description?: string | null;
  htmlContent: string;
  imageUrl?: ImageValue;
  coverAlt?: string | null;
  /** Empty on create = the signed-in admin */
  authorId?: string | null;
  categoryIds?: string[];
  status?: PostStatus;
  publishedAt?: string | Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** List as stored, or the comma-separated line being edited */
  keywords?: string[] | string | null;
  /** This language's own URL segment; empty = the shared slug */
  localizedSlug?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: ImageValue;
  /** Undefined = untouched: keep whatever OG image is stored */
  useCoverAsOgImage?: boolean;
}

const isPicked = (value: ImageValue): value is { rawFile: File } =>
  typeof value === 'object' && value !== null && value.rawFile instanceof File;

/** A media-library image (its URL) other than the one already stored. */
const isLibraryPick = (value: ImageValue, stored?: string | null): value is string =>
  typeof value === 'string' && value !== '' && value !== stored;

/** Keywords as a trimmed list without blanks (the API also drops repeats). */
export function toKeywordList(value: PostFormValues['keywords']): string[] {
  const items = Array.isArray(value) ? value : (value ?? '').split(',');
  return items.map((item) => item.trim()).filter(Boolean);
}

const toIsoOrEmpty = (value: PostFormValues['publishedAt']): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

/**
 * Form values → API body. Picked images go out as `image` / `ogImage` (multipart via the
 * dataProvider), removed ones as `removeImage` / `removeOgImage`. Optional text fields are sent
 * as '' when empty, which the API stores as null; read-only fields never leave the form.
 */
export function toPostPayload(
  values: PostFormValues,
  previous?: Pick<AdminPost, 'imageUrl' | 'ogImageUrl'>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: values.title,
    slug: values.slug,
    description: values.description ?? '',
    htmlContent: values.htmlContent,
    coverAlt: values.coverAlt ?? '',
    categoryIds: values.categoryIds ?? [],
    status: values.status ?? 'draft',
    publishedAt: toIsoOrEmpty(values.publishedAt),
    seoTitle: values.seoTitle ?? '',
    seoDescription: values.seoDescription ?? '',
    keywords: toKeywordList(values.keywords),
    localizedSlug: values.localizedSlug ?? '',
    canonicalUrl: values.canonicalUrl ?? '',
  };
  if (values.authorId) payload.authorId = values.authorId;

  if (isPicked(values.imageUrl)) payload.image = values.imageUrl;
  else if (isLibraryPick(values.imageUrl, previous?.imageUrl)) payload.imageUrl = values.imageUrl;
  else if (!values.imageUrl && previous?.imageUrl) payload.removeImage = true;

  if (values.useCoverAsOgImage === true) {
    // The cover doubles as the OG image: drop a stored dedicated one
    if (previous?.ogImageUrl) payload.removeOgImage = true;
  } else if (isPicked(values.ogImageUrl)) {
    payload.ogImage = values.ogImageUrl;
  } else if (isLibraryPick(values.ogImageUrl, previous?.ogImageUrl)) {
    payload.ogImageUrl = values.ogImageUrl;
  } else if (!values.ogImageUrl && previous?.ogImageUrl) {
    payload.removeOgImage = true;
  }

  return payload;
}
