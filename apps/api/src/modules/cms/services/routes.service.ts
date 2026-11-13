import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';
import {
  BLOG_PAGE_KEY,
  PAGE_DEFINITIONS,
  PAGE_KEYS,
  isPageKey,
  localizePath,
  type Locale,
  type LocalizedPaths,
  type PageKey,
  type WebsiteRouteMap,
  type WebsiteRouteResolution,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { Page } from '../entities/page.entity';
import { PageSlug } from '../entities/page-slug.entity';
import { Redirect } from '../entities/redirect.entity';
import {
  RouteIndex,
  normalizeRequestPath,
  pathSegments,
  type RoutePage,
} from '../content/route-index';

/** Page keys that have child pages (a slug scope other than ""). */
const PARENT_KEYS = new Set<PageKey>(
  PAGE_KEYS.flatMap((key) => {
    const parent = (PAGE_DEFINITIONS[key] as { parent?: PageKey }).parent;
    return parent ? [parent] : [];
  }),
);

const notFound = () => new HttpError(404, 'ROUTE_NOT_FOUND', 'Nothing at this path');

/**
 * Website URLs: which page (or blog post) lives at a path, where old and other-language
 * addresses moved to, and every published page's path per language.
 */
@Injectable()
export class RoutesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Current slugs and published languages of every page. */
  async loadIndex(): Promise<RouteIndex> {
    const [pages, slugs] = await Promise.all([
      this.ds.getRepository(Page).find({
        relations: { publishedRevision: true },
        select: {
          id: true,
          key: true,
          status: true,
          publishedRevision: { id: true, locales: true },
        },
      }),
      this.ds.getRepository(PageSlug).find({ where: { current: true } }),
    ]);
    const keyById = new Map(pages.map((page) => [page.id, page.key]));
    const routePages = new Map<PageKey, RoutePage>();
    for (const page of pages) {
      if (!isPageKey(page.key)) continue;
      routePages.set(page.key, {
        key: page.key,
        publishedLocales:
          page.status === 'published' && page.publishedRevision
            ? page.publishedRevision.locales
            : [],
        slugs: {},
      });
    }
    for (const slug of slugs) {
      const key = keyById.get(slug.pageId);
      const page = key ? routePages.get(key) : undefined;
      if (page) page.slugs[slug.locale] = slug.slug;
    }
    return new RouteIndex([...routePages.values()]);
  }

  async routeMap(): Promise<WebsiteRouteMap> {
    return { pages: (await this.loadIndex()).routeMap() };
  }

  async resolve(rawPath: string, locale: Locale): Promise<WebsiteRouteResolution> {
    const path = normalizeRequestPath(rawPath);
    if (path === null) throw notFound();

    const redirect = await this.ds
      .getRepository(Redirect)
      .findOne({ where: { source: localizePath(path, locale), enabled: true } });
    if (redirect) {
      return {
        kind: 'redirect',
        location: redirect.target,
        permanent: redirect.type === 'permanent',
      };
    }

    const index = await this.loadIndex();
    const exact = index.pageAt(path, locale);
    if (exact) return { kind: 'page', key: exact, paths: index.paths(exact) };

    const segments = pathSegments(path);
    if (segments.length === 0) throw notFound();
    const matched = await this.matchSlugHistory(segments, locale);
    if (!matched) throw notFound();

    // An old or other-language address of a page → its current one
    if (matched.consumed === segments.length) {
      const current = index.path(matched.key, locale);
      if (current === null || current === path) throw notFound();
      return { kind: 'redirect', location: localizePath(current, locale), permanent: true };
    }

    // "<blog path>/<post slug>"
    if (matched.key === BLOG_PAGE_KEY && matched.consumed === segments.length - 1) {
      const slug = segments[segments.length - 1]!;
      const postLocales = await this.publishedPostLocales(slug);
      const blogPath = index.path(BLOG_PAGE_KEY, locale);
      if (!postLocales.includes(locale) || blogPath === null) throw notFound();
      const postPath = `${blogPath}/${slug}`;
      if (postPath !== path) {
        return { kind: 'redirect', location: localizePath(postPath, locale), permanent: true };
      }
      return { kind: 'post', slug, paths: this.postPaths(index, slug, postLocales) };
    }

    throw notFound();
  }

  /** Paths of a blog post in the languages it is published in. */
  postPaths(index: RouteIndex, slug: string, locales: Locale[]): LocalizedPaths {
    const paths: LocalizedPaths = {};
    for (const locale of locales) {
      const blogPath = index.path(BLOG_PAGE_KEY, locale);
      if (blogPath !== null) paths[locale] = `${blogPath}/${slug}`;
    }
    return paths;
  }

  private async publishedPostLocales(slug: string): Promise<Locale[]> {
    const rows: { locale: Locale }[] = await this.ds.query(
      `SELECT translation.locale
       FROM posts post
       JOIN post_translations translation ON translation."postId" = post.id
       WHERE post.slug = $1 AND post.status = 'published'`,
      [slug],
    );
    return rows.map((row) => row.locale);
  }

  /**
   * Follows the path through slug history (old slugs and other languages too), level by level.
   * Returns the deepest page reached and how many segments it took.
   */
  private async matchSlugHistory(
    segments: string[],
    locale: Locale,
  ): Promise<{ key: PageKey; consumed: number } | null> {
    let scope = '';
    let found: { key: PageKey; consumed: number } | null = null;
    for (let level = 0; level < segments.length; level++) {
      const rows: { key: string; locale: Locale; current: boolean }[] = await this.ds.query(
        `SELECT page.key, slug.locale, slug.current
         FROM page_slugs slug JOIN pages page ON page.id = slug."pageId"
         WHERE slug.scope = $1 AND slug.slug = $2`,
        [scope, segments[level]],
      );
      // Prefer the requested language, then current slugs
      rows.sort(
        (a, b) =>
          Number(b.locale === locale) - Number(a.locale === locale) ||
          Number(b.current) - Number(a.current),
      );
      const key = rows[0]?.key;
      if (!isPageKey(key)) break;
      found = { key, consumed: level + 1 };
      if (!PARENT_KEYS.has(key)) break;
      scope = key;
    }
    return found;
  }
}
