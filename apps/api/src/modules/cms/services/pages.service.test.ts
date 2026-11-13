import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { LOCALES } from '@tsyvinda/shared-types';
import { Page } from '../entities/page.entity';
import { PageSlug } from '../entities/page-slug.entity';
import { DEFAULT_PAGE_CONTENT } from '../seed/default-content';
import { emptyPageContent, normalizePageContent } from '../content/page-content';
import { PagesService, normalizeSlugs } from './pages.service';
import type { RevalidationService } from './revalidation.service';
import type { RoutesService } from './routes.service';
import type { S3Service } from '../../../shared/s3/s3.service';

let page: Record<string, unknown>;
let slugRows: Record<string, unknown>[];
const pageRepo = { findOne: vi.fn(), save: vi.fn(), update: vi.fn() };
const slugRepo = {
  findOne: vi.fn(
    async ({ where }: { where: Record<string, unknown> }) =>
      slugRows.find((row) => Object.entries(where).every(([k, v]) => row[k] === v)) ?? null,
  ),
  find: vi.fn(async () => slugRows.filter((row) => row.current)),
  update: vi.fn(async ({ id }: { id: string }, patch: object) => {
    Object.assign(
      slugRows.find((row) => row.id === id)!,
      patch,
    );
  }),
  insert: vi.fn(async (row: object) => slugRows.push({ id: `new-${slugRows.length}`, ...row })),
  delete: vi.fn(async ({ id }: { id: string }) => {
    slugRows = slugRows.filter((row) => row.id !== id);
  }),
};
const revisionRepo = {
  findOne: vi.fn(async () => null),
  create: vi.fn((row: object) => row),
  save: vi.fn(async (row: object) => ({ id: 'rev-1', ...row })),
};
const manager = {
  getRepository: (entity: unknown) =>
    entity === Page ? pageRepo : entity === PageSlug ? slugRepo : revisionRepo,
};
const revalidate = vi.fn();
const S3_BASE = 'https://cdn.example';
const s3 = {
  put: vi.fn(async (key: string) => `${S3_BASE}/${key}`),
  deleteByUrl: vi.fn(async () => undefined),
  keyFromUrl: (url: string) =>
    url.startsWith(`${S3_BASE}/`) ? url.slice(S3_BASE.length + 1) : null,
};
let service: PagesService;

beforeEach(() => {
  vi.clearAllMocks();
  page = {
    id: 'p-about',
    key: 'about',
    version: 3,
    draft: normalizePageContent('about', DEFAULT_PAGE_CONTENT.about),
    enabledLocales: [...LOCALES],
  };
  slugRows = [
    { id: 's1', pageId: 'p-about', locale: 'en', slug: 'about', scope: '', current: true },
    { id: 's2', pageId: 'p-about', locale: 'uk', slug: 'about', scope: '', current: true },
    { id: 's3', pageId: 'p-about', locale: 'uk', slug: 'pro-mene', scope: '', current: false },
    { id: 's4', pageId: 'p-blog', locale: 'en', slug: 'blog', scope: '', current: true },
    { id: 's5', pageId: 'p-blog', locale: 'en', slug: 'notes', scope: '', current: false },
  ];
  pageRepo.findOne.mockImplementation(async () => page);
  const ds = { transaction: (run: (m: typeof manager) => unknown) => run(manager) };
  service = new PagesService(
    ds as unknown as DataSource,
    {} as RoutesService,
    { revalidate } as unknown as RevalidationService,
    s3 as unknown as S3Service,
  );
  vi.spyOn(service, 'get').mockResolvedValue({} as never);
});

const fullDraft = () => normalizePageContent('about', DEFAULT_PAGE_CONTENT.about);

describe('PagesService.save', () => {
  it('saves the content, snapshots it as a new live revision and refreshes the website', async () => {
    await service.save('about', { version: 3, draft: fullDraft(), enabledLocales: ['uk'] }, 'u1');
    expect(revisionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: 'p-about', version: 4, locales: ['uk'] }),
    );
    expect(pageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 4,
        enabledLocales: ['uk'],
        status: 'published',
        publishedRevisionId: 'rev-1',
        publishedVersion: 4,
        updatedById: 'u1',
      }),
    );
    expect(revalidate).toHaveBeenCalled();
  });

  it('deletes uploaded images the page no longer shows, after saving', async () => {
    const withPhoto = fullDraft();
    withPhoto.blocks[0]!.data.avatar = `${S3_BASE}/pages/old.webp`;
    withPhoto.seo.ogImageUrl = 'https://elsewhere.example/share.png';
    page.draft = withPhoto;

    const next = fullDraft();
    next.blocks[0]!.data.avatar = `${S3_BASE}/pages/new.webp`;
    await service.save('about', { version: 3, draft: next, enabledLocales: ['en', 'uk'] }, 'u1');
    // Only the replaced upload: a URL outside `pages/` (here the share image) is never deleted
    expect(s3.deleteByUrl.mock.calls).toEqual([[`${S3_BASE}/pages/old.webp`]]);
  });

  it('keeps an image that is still shown', async () => {
    const withPhoto = fullDraft();
    withPhoto.blocks[0]!.data.avatar = `${S3_BASE}/pages/same.webp`;
    page.draft = withPhoto;
    await service.save(
      'about',
      { version: 3, draft: structuredClone(withPhoto), enabledLocales: ['en', 'uk'] },
      'u1',
    );
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });

  it('refuses a stale version with 409 and the current version', async () => {
    await expect(
      service.save('about', { version: 2, draft: fullDraft(), enabledLocales: ['en'] }, 'u1'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
      details: { currentVersion: 3 },
    });
  });

  it('refuses empty required fields and saves nothing', async () => {
    await expect(
      service.save(
        'about',
        { version: 3, draft: emptyPageContent(), enabledLocales: ['en'] },
        'u1',
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      details: { fieldErrors: expect.objectContaining({ 'draft.title.en': 'Required' }) },
    });
    expect(pageRepo.save).not.toHaveBeenCalled();
  });

  it('needs an address in every enabled language', async () => {
    slugRows = slugRows.filter((row) => row.id !== 's2');
    await expect(
      service.save('about', { version: 3, draft: fullDraft(), enabledLocales: ['en', 'uk'] }, 'u1'),
    ).rejects.toMatchObject({
      code: 'SLUG_MISSING',
      details: { fieldErrors: { 'slugs.uk': 'Required' } },
    });
  });
});

describe('PagesService.updateSlugs', () => {
  it('makes a new slug current and keeps the old one for redirects', async () => {
    await service.updateSlugs('about', { slugs: { en: 'Me' } }, 'u1');
    expect(slugRows.find((row) => row.id === 's1')!.current).toBe(false);
    expect(slugRows).toContainEqual(
      expect.objectContaining({ pageId: 'p-about', locale: 'en', slug: 'me', current: true }),
    );
    expect(revalidate).toHaveBeenCalledWith(expect.arrayContaining(['routes', 'page:about']));
  });

  it('switches back to an old slug of the same page', async () => {
    await service.updateSlugs('about', { slugs: { uk: 'pro-mene' } }, 'u1');
    expect(slugRows.find((row) => row.id === 's3')!.current).toBe(true);
    expect(slugRows.find((row) => row.id === 's2')!.current).toBe(false);
    expect(slugRepo.insert).not.toHaveBeenCalled();
  });

  it('refuses another page’s current slug and takes over its old one', async () => {
    await expect(
      service.updateSlugs('about', { slugs: { en: 'blog' } }, 'u1'),
    ).rejects.toMatchObject({ status: 409, code: 'SLUG_TAKEN' });
    await service.updateSlugs('about', { slugs: { en: 'notes' } }, 'u1');
    expect(slugRows.find((row) => row.id === 's5')).toBeUndefined();
    expect(slugRows).toContainEqual(expect.objectContaining({ pageId: 'p-about', slug: 'notes' }));
  });

  it('has no address for Home', async () => {
    await expect(
      service.updateSlugs('home', { slugs: { en: 'start' } }, 'u1'),
    ).rejects.toMatchObject({ status: 400, code: 'PAGE_NOT_ROUTED' });
  });
});

describe('PagesService.uploadImage', () => {
  it('stores the file under pages/ and returns its URL', async () => {
    const result = await service.uploadImage({ buffer: Buffer.from('x'), mimetype: 'image/webp' });
    expect(s3.put).toHaveBeenCalledWith(
      expect.stringMatching(/^pages\/.+\.webp$/),
      expect.any(Buffer),
      'image/webp',
    );
    expect(result.url).toMatch(/^https:\/\/cdn\.example\/pages\/.+\.webp$/);
  });
});

describe('normalizeSlugs', () => {
  it('lowercases, allows Cyrillic and skips empty languages', () => {
    expect(normalizeSlugs({ en: ' About-Me ', uk: 'Про-мене' }, true)).toEqual({
      en: 'about-me',
      uk: 'про-мене',
    });
    expect(normalizeSlugs({ en: '' }, true)).toEqual({});
  });

  it('rejects bad shapes, reserved segments and unknown languages', () => {
    for (const slugs of [{ en: '-x' }, { en: 'a b' }, { en: 'login' }, { de: 'x' }]) {
      expect(() => normalizeSlugs(slugs, true), JSON.stringify(slugs)).toThrow();
    }
    expect(normalizeSlugs({ en: 'login' }, false)).toEqual({ en: 'login' });
  });
});
