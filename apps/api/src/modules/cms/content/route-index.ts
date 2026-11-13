import {
  HOME_PAGE_KEY,
  LOCALES,
  PAGE_DEFINITIONS,
  localizePath,
  type Locale,
  type LocalizedPaths,
  type PageKey,
} from '@tsyvinda/shared-types';

/** What path computation needs to know about one page. */
export interface RoutePage {
  key: PageKey;
  /** Languages the page is published in (empty while unpublished) */
  publishedLocales: Locale[];
  /** Current slug per language */
  slugs: Partial<Record<Locale, string>>;
}

/**
 * Paths of every page, computed from current slugs and parents. `draft: true` includes
 * unpublished pages and languages (for the admin panel's URL preview).
 */
export class RouteIndex {
  private readonly pages = new Map<PageKey, RoutePage>();

  constructor(pages: RoutePage[]) {
    for (const page of pages) this.pages.set(page.key, page);
  }

  get(key: PageKey): RoutePage | undefined {
    return this.pages.get(key);
  }

  isPublished(key: PageKey, locale: Locale): boolean {
    return this.pages.get(key)?.publishedLocales.includes(locale) ?? false;
  }

  /** Unprefixed path of `key` in `locale` ("/about"); null when it has none. */
  path(key: PageKey, locale: Locale, { draft = false } = {}): string | null {
    if (!draft && !this.isPublished(key, locale)) return null;
    if (key === HOME_PAGE_KEY) return '/';
    const page = this.pages.get(key);
    const slug = page?.slugs[locale];
    if (!slug) return null;
    const parent: PageKey | undefined = (PAGE_DEFINITIONS[key] as { parent?: PageKey }).parent;
    if (!parent) return `/${slug}`;
    const parentPath = this.path(parent, locale, { draft });
    return parentPath && parentPath !== '/'
      ? `${parentPath}/${slug}`
      : parentPath
        ? `/${slug}`
        : null;
  }

  /** Public path with the language prefix ("/uk/about"). */
  publicPath(key: PageKey, locale: Locale): string | null {
    const path = this.path(key, locale);
    return path === null ? null : localizePath(path, locale);
  }

  paths(key: PageKey, options: { draft?: boolean } = {}): LocalizedPaths {
    const result: LocalizedPaths = {};
    for (const locale of LOCALES) {
      const path = this.path(key, locale, options);
      if (path !== null) result[locale] = path;
    }
    return result;
  }

  /** Every published page's paths. */
  routeMap(): Partial<Record<PageKey, LocalizedPaths>> {
    const map: Partial<Record<PageKey, LocalizedPaths>> = {};
    for (const key of this.pages.keys()) {
      const paths = this.paths(key);
      if (Object.keys(paths).length > 0) map[key] = paths;
    }
    return map;
  }

  /** The published page whose current path in `locale` is exactly `path`. */
  pageAt(path: string, locale: Locale): PageKey | null {
    for (const key of this.pages.keys()) {
      if (this.path(key, locale) === path) return key;
    }
    return null;
  }
}

/**
 * "/Uk/About/" style input → "/uk/about"-style unprefixed path with decoded segments, no empty
 * segments and no trailing slash. Returns null for paths that can't be a page (dots, too long).
 */
export function normalizeRequestPath(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const segments = decoded
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => segment.toLowerCase());
  if (segments.length > 10 || segments.some((s) => s === '.' || s === '..' || s.length > 200)) {
    return null;
  }
  return `/${segments.join('/')}`;
}

/** Segments of an unprefixed path ("/a/b" → ["a", "b"], "/" → []). */
export function pathSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}
