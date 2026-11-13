import { DEFAULT_LOCALE, type Locale } from '../locales';
import type { BlockType, DraftBlock, WebsiteBlock } from './blocks';
import type { LocalizedText } from './fields';

/** One fixed section of a page: its type and, optionally, the in-page anchor it renders with. */
export interface PageSectionDefinition {
  type: BlockType;
  /** `id` of the rendered section (`/about#stack`) */
  anchor?: string;
}

/**
 * A page definition: a fixed design the website has a view for. Pages are not created in the
 * admin panel; each key here is seeded once and then edited (content, SEO, URL). Its sections are
 * hardcoded too: editors fill them in but can't add, remove or reorder them.
 */
export interface PageDefinition {
  label: string;
  /** Has an editable URL per language. Home is always `/` and has none */
  routed: boolean;
  /** Parent page: this page's URL is nested under the parent's ("/about/team") */
  parent?: PageKey;
  /** Slug per language for the seed */
  defaultSlugs?: Record<Locale, string>;
  /** The page's sections, in display order */
  sections: readonly PageSectionDefinition[];
  /** schema.org type of the page (JSON-LD on the website) */
  schemaType: 'WebPage' | 'ProfilePage' | 'ContactPage' | 'CollectionPage';
}

export const PAGE_DEFINITIONS = {
  home: {
    label: 'Home',
    routed: false,
    sections: [
      { type: 'homeHero' },
      { type: 'homeAbout' },
      { type: 'homeExperience' },
      { type: 'homeRecommendation' },
      { type: 'homeContact' },
    ],
    schemaType: 'WebPage',
  },
  about: {
    label: 'About',
    routed: true,
    defaultSlugs: { en: 'about', uk: 'about' },
    sections: [
      { type: 'aboutHero' },
      { type: 'aboutStack', anchor: 'stack' },
      { type: 'aboutExperience', anchor: 'experience' },
      { type: 'aboutRecommendations', anchor: 'recommendations' },
      { type: 'aboutEducation', anchor: 'education' },
      { type: 'ctaBanner' },
    ],
    schemaType: 'ProfilePage',
  },
  contacts: {
    label: 'Contacts',
    routed: true,
    defaultSlugs: { en: 'contacts', uk: 'contacts' },
    sections: [{ type: 'contactsHero' }, { type: 'contactChannels' }],
    schemaType: 'ContactPage',
  },
  blog: {
    label: 'Blog',
    routed: true,
    defaultSlugs: { en: 'blog', uk: 'blog' },
    sections: [{ type: 'blogHero' }, { type: 'blogFeed' }, { type: 'blogTopics' }],
    schemaType: 'CollectionPage',
  },
  'privacy-policy': {
    label: 'Privacy Policy',
    routed: true,
    defaultSlugs: { en: 'privacy-policy', uk: 'privacy-policy' },
    sections: [{ type: 'legalHeader' }, { type: 'richText' }],
    schemaType: 'WebPage',
  },
  'cookie-policy': {
    label: 'Cookie Policy',
    routed: true,
    defaultSlugs: { en: 'cookie-policy', uk: 'cookie-policy' },
    sections: [
      { type: 'legalHeader' },
      { type: 'richText' },
      { type: 'richText' },
      { type: 'richText' },
      { type: 'cookieTable' },
      { type: 'richText' },
      { type: 'cookieSettings' },
      { type: 'richText' },
      { type: 'richText' },
    ],
    schemaType: 'WebPage',
  },
} as const satisfies Record<string, PageDefinition>;

export type PageKey = keyof typeof PAGE_DEFINITIONS;
export const PAGE_KEYS = Object.keys(PAGE_DEFINITIONS) as PageKey[];

export type RoutedPageKey = {
  [K in PageKey]: (typeof PAGE_DEFINITIONS)[K]['routed'] extends true ? K : never;
}[PageKey];
export const ROUTED_PAGE_KEYS = PAGE_KEYS.filter(
  (key) => PAGE_DEFINITIONS[key].routed,
) as RoutedPageKey[];

/** Page whose path prefixes blog post URLs: `<blog path>/<post slug>`. */
export const BLOG_PAGE_KEY = 'blog' satisfies RoutedPageKey;
export const HOME_PAGE_KEY = 'home' satisfies PageKey;

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === 'string' && Object.hasOwn(PAGE_DEFINITIONS, value);
}

export function isRoutedPageKey(value: unknown): value is RoutedPageKey {
  return isPageKey(value) && PAGE_DEFINITIONS[value].routed;
}

export function pageDefinition(key: PageKey): PageDefinition {
  return PAGE_DEFINITIONS[key];
}

/**
 * First path segments the website serves itself (fixed routes, files, the API proxy). A page
 * slug may not take them, at any level that could shadow them.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'api',
  'en',
  'uk',
  'login',
  'registration',
  'reset-password',
  'profile',
  'opengraph-image',
  'sitemap.xml',
  'robots.txt',
  'manifest.webmanifest',
  'llms.txt',
  'favicon',
  'images',
  '_next',
];

/** URL segment: lowercase letters (Latin or Cyrillic), digits and inner hyphens. */
export const PAGE_SLUG_REGEX = /^[a-z0-9а-яіїєґ](?:[a-z0-9а-яіїєґ-]*[a-z0-9а-яіїєґ])?$/;
export const PAGE_SLUG_MAX = 100;

/** Unprefixed path per language ("/about"); a language is missing when the page has no version in it. */
export type LocalizedPaths = Partial<Record<Locale, string>>;

/**
 * Public path of an unprefixed `path` in `locale`: English has no prefix, other languages get
 * "/<locale>" ("/" → "/uk"). Same rule as the website's routing.
 */
export function localizePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

// ── Content ─────────────────────────────────────────────────────────────────

/**
 * One set of texts for search engines and share cards (OpenGraph): the OG title is also the
 * `<title>`, the OG description also the meta description.
 */
export interface PageSeoDraft {
  /** OG title: `og:title` and `<title>`; the website adds " — <site name>" (not on Home) */
  title: LocalizedText;
  /** OG description: `og:description` and the meta description */
  description: LocalizedText;
  /** Comma-separated */
  keywords: LocalizedText;
  /** OG image (`og:image`); the site's generated card when empty */
  ogImageUrl: string | null;
  /** Keep this page out of search engines even while indexing is on */
  noindex: boolean;
}

/** What an editor changes: saved as the page's content and copied into a revision (live at once). */
export interface PageContent {
  /** Page name in breadcrumbs and admin lists */
  title: LocalizedText;
  seo: PageSeoDraft;
  blocks: DraftBlock[];
}

export interface WebsiteSeo {
  title: string;
  /**
   * @deprecated Same as `title` (separate social titles were merged into the OG title). Kept so
   * websites deployed before the merge keep working; remove once they are updated.
   */
  socialTitle: string;
  description: string;
  keywords: string[];
  ogImageUrl: string | null;
  noindex: boolean;
}

/** A published page in one language: `GET /pages/:key?locale=`. */
export interface WebsitePage {
  key: PageKey;
  locale: Locale;
  /** Languages the page is published in (hreflang) */
  locales: Locale[];
  title: string;
  seo: WebsiteSeo;
  blocks: WebsiteBlock[];
  /** This page's unprefixed path per published language */
  paths: LocalizedPaths;
  publishedAt: string;
}

export const PAGE_STATUSES = ['draft', 'published'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];
