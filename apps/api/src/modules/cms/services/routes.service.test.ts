import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { HttpError } from '../../../shared/http-error';
import { Page } from '../entities/page.entity';
import { PageSlug } from '../entities/page-slug.entity';
import { Redirect } from '../entities/redirect.entity';
import { RoutesService } from './routes.service';

const published = (locales: string[]) => ({ status: 'published', publishedRevision: { locales } });
const pages = [
  { id: 'p-home', key: 'home', ...published(['en', 'uk']) },
  { id: 'p-about', key: 'about', ...published(['en', 'uk']) },
  { id: 'p-blog', key: 'blog', ...published(['en', 'uk']) },
];
const currentSlugs = [
  { pageId: 'p-about', locale: 'en', slug: 'about' },
  { pageId: 'p-about', locale: 'uk', slug: 'pro-mene' },
  { pageId: 'p-blog', locale: 'en', slug: 'blog' },
  { pageId: 'p-blog', locale: 'uk', slug: 'blog' },
];
/** page_slugs rows by "scope|slug" for the slug-history walk */
const history: Record<string, { key: string; locale: string; current: boolean }[]> = {
  '|about': [{ key: 'about', locale: 'en', current: true }],
  '|pro-mene': [{ key: 'about', locale: 'uk', current: true }],
  '|old-about': [{ key: 'about', locale: 'en', current: false }],
  '|blog': [
    { key: 'blog', locale: 'en', current: true },
    { key: 'blog', locale: 'uk', current: true },
  ],
  '|notes': [{ key: 'blog', locale: 'en', current: false }],
};

let redirectRow: unknown;
/** Language versions of the published post "hello" (own slug null = the shared one) */
let postVersions: { key: string; locale: string; slug: string | null }[];
let service: RoutesService;

/** Rows of the post lookup: the post owning the segment (shared or own slug), or none. */
function postRows(segment: string) {
  const owns = postVersions.some((version) => version.key === segment || version.slug === segment);
  return owns ? postVersions : [];
}

beforeEach(() => {
  redirectRow = null;
  postVersions = [{ key: 'hello', locale: 'en', slug: null }];
  const repos = new Map<unknown, object>([
    [Page, { find: vi.fn(async () => pages) }],
    [PageSlug, { find: vi.fn(async () => currentSlugs) }],
    [Redirect, { findOne: vi.fn(async () => redirectRow) }],
  ]);
  const ds = {
    getRepository: (entity: unknown) => repos.get(entity),
    query: vi.fn(async (sql: string, params: string[]) =>
      sql.includes('FROM posts')
        ? postRows(params[0]!)
        : (history[`${params[0]}|${params[1]}`] ?? []),
    ),
  };
  service = new RoutesService(ds as unknown as DataSource);
});

async function status(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    return (error as HttpError).status;
  }
}

describe('RoutesService.resolve', () => {
  it('finds a page at its current path in the language', async () => {
    expect(await service.resolve('/pro-mene', 'uk')).toEqual({
      kind: 'page',
      key: 'about',
      paths: { en: '/about', uk: '/pro-mene' },
    });
  });

  it('redirects the other language’s slug and old slugs to the current address', async () => {
    expect(await service.resolve('/about', 'uk')).toEqual({
      kind: 'redirect',
      location: '/uk/pro-mene',
      permanent: true,
    });
    expect(await service.resolve('/old-about', 'en')).toEqual({
      kind: 'redirect',
      location: '/about',
      permanent: true,
    });
  });

  it('applies admin redirects first', async () => {
    redirectRow = { target: 'https://example.com', type: 'temporary' };
    expect(await service.resolve('/anything', 'en')).toEqual({
      kind: 'redirect',
      location: 'https://example.com',
      permanent: false,
    });
  });

  it('resolves blog posts under the blog path and moves them with it', async () => {
    expect(await service.resolve('/blog/hello', 'en')).toEqual({
      kind: 'post',
      slug: 'hello',
      paths: { en: '/blog/hello' },
    });
    expect(await service.resolve('/notes/hello', 'en')).toEqual({
      kind: 'redirect',
      location: '/blog/hello',
      permanent: true,
    });
  });

  it("serves a language's own post slug and redirects the shared one there", async () => {
    postVersions = [
      { key: 'hello', locale: 'en', slug: null },
      { key: 'hello', locale: 'uk', slug: 'pryvit' },
    ];
    const paths = { en: '/blog/hello', uk: '/blog/pryvit' };
    expect(await service.resolve('/blog/pryvit', 'uk')).toEqual({
      kind: 'post',
      slug: 'hello',
      paths,
    });
    expect(await service.resolve('/blog/hello', 'en')).toEqual({
      kind: 'post',
      slug: 'hello',
      paths,
    });
    expect(await service.resolve('/blog/hello', 'uk')).toEqual({
      kind: 'redirect',
      location: '/uk/blog/pryvit',
      permanent: true,
    });
    expect(await service.resolve('/blog/pryvit', 'en')).toEqual({
      kind: 'redirect',
      location: '/blog/hello',
      permanent: true,
    });
  });

  it('404s unknown paths, posts missing in the language and the home path', async () => {
    expect(await status(service.resolve('/nope', 'en'))).toBe(404);
    expect(await status(service.resolve('/blog/hello', 'uk'))).toBe(404);
    expect(await status(service.resolve('/about/extra/deep', 'en'))).toBe(404);
    expect(await status(service.resolve('/%E0%A4%A', 'en'))).toBe(404);
  });

  it('lists every published page in the route map', async () => {
    expect(await service.routeMap()).toEqual({
      pages: {
        home: { en: '/', uk: '/' },
        about: { en: '/about', uk: '/pro-mene' },
        blog: { en: '/blog', uk: '/blog' },
      },
    });
  });
});
