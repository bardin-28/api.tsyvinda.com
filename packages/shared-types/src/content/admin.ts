import type { Locale } from '../locales';
import type { LocalizedPaths, PageContent, PageKey } from './pages';

export interface AdminEditor {
  id: string;
  name: string;
}

/** Row of `GET /admin/pages`. `id` is the page key (react-admin needs `id`). */
export interface AdminPageListItem {
  id: PageKey;
  key: PageKey;
  label: string;
  routed: boolean;
  enabledLocales: Locale[];
  /**
   * Share of the page's translatable texts filled in, per language (0–100). A text counts once
   * it is filled in any language.
   */
  translated: Record<Locale, number>;
  paths: LocalizedPaths;
  updatedAt: string;
  updatedBy: AdminEditor | null;
}

/** An old URL segment of the page; visiting it redirects to the current one. */
export interface AdminPageOldSlug {
  locale: Locale;
  slug: string;
  path: string;
}

/** `GET /admin/pages/:key`: the content and everything the editor shows around it. */
export interface AdminPage extends AdminPageListItem {
  /** Optimistic lock: send it back with every write */
  version: number;
  /** The page's content (the name `draft` is kept from the API's storage: it is what is live) */
  draft: PageContent;
  /** Current URL segment per language (null for Home or an unset language) */
  slugs: Partial<Record<Locale, string>>;
  oldSlugs: AdminPageOldSlug[];
  parent: PageKey | null;
}

/** `PATCH /admin/pages/:key`: saves and publishes at once (the website shows it right away) */
export interface AdminPageDraftUpdate {
  version: number;
  draft: PageContent;
  enabledLocales: Locale[];
}

/** `PUT /admin/pages/:key/slugs` — live at once, independent of the draft (no version) */
export interface AdminPageSlugsUpdate {
  slugs: Partial<Record<Locale, string>>;
}

export const REDIRECT_TYPES = ['permanent', 'temporary'] as const;
export type RedirectType = (typeof REDIRECT_TYPES)[number];

/** Admin-made redirect: `source` is a public path, `target` a public path or absolute URL. */
export interface AdminRedirect {
  id: string;
  source: string;
  target: string;
  type: RedirectType;
  enabled: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRedirectInput {
  source: string;
  target: string;
  type: RedirectType;
  enabled: boolean;
  note: string | null;
}

/** 409 body details when someone else saved the page first. */
export interface VersionConflictDetails {
  currentVersion: number;
}
