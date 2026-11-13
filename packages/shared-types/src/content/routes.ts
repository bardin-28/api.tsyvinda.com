import type { LocalizedPaths, PageKey } from './pages';

/** `GET /routes`: every published page's path per language (header, footer, sitemap). */
export interface WebsiteRouteMap {
  pages: Partial<Record<PageKey, LocalizedPaths>>;
}

/** A published page lives at the path. */
export interface PageRouteResolution {
  kind: 'page';
  key: PageKey;
  paths: LocalizedPaths;
}

/** A blog post lives at the path (`<blog path>/<slug>`). */
export interface PostRouteResolution {
  kind: 'post';
  slug: string;
  paths: LocalizedPaths;
}

/**
 * The path moved: an old slug, the other language's slug, or an admin redirect. `location` is a
 * public path with its language prefix ("/uk/pro-mene") or an absolute URL.
 */
export interface RedirectRouteResolution {
  kind: 'redirect';
  location: string;
  permanent: boolean;
}

/** `GET /routes/resolve?path=&locale=` — what the website renders at a path. */
export type WebsiteRouteResolution =
  PageRouteResolution | PostRouteResolution | RedirectRouteResolution;

/** Cache tags the website's data fetches carry; the API asks the website to drop them on change. */
export const CACHE_TAGS = {
  routes: 'routes',
  posts: 'posts',
  page: (key: string) => `page:${key}`,
  post: (slug: string) => `post:${slug}`,
} as const;
