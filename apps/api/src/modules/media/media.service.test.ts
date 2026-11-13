import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityTarget } from 'typeorm';
import type { S3Service } from '../../shared/s3/s3.service';
import { Page } from '../cms/entities/page.entity';
import { PostTranslation } from '../posts/entities/post-translation.entity';
import { User } from '../users/entities/user.entity';
import { Media } from './entities/media.entity';
import { MediaService, urlsIn } from './media.service';

const BASE = 'https://cdn.example';
const OURS = `${BASE}/posts/a.png`;

let translationsUsing: string[];
let usersUsing: string[];
let pagesUsing: string[];
const mediaRepo = {
  exists: vi.fn(),
  delete: vi.fn(async () => undefined),
  save: vi.fn(async (row: object) => ({ id: 'm1', ...row })),
  create: vi.fn((row: object) => row),
  find: vi.fn(async () => [] as { url: string }[]),
  findOne: vi.fn(),
};
const translationRepo = {
  exists: vi.fn(async () => translationsUsing.length > 0),
  find: vi.fn(async () =>
    translationsUsing.map((title) => ({ postId: `p-${title}`, title, locale: 'en' })),
  ),
};
const userRepo = {
  exists: vi.fn(async () => usersUsing.length > 0),
  find: vi.fn(async () => usersUsing.map((id) => ({ id, firstName: 'Ada', lastName: id }))),
};
const pageQb = {
  select: () => pageQb,
  where: () => pageQb,
  getRawMany: async () => pagesUsing.map((key) => ({ key })),
};
const pageRepo = { createQueryBuilder: () => pageQb, find: vi.fn(async () => []) };
const insertQb = {
  insert: () => insertQb,
  into: () => insertQb,
  values: vi.fn(() => insertQb),
  orIgnore: () => insertQb,
  execute: vi.fn(async () => undefined),
};
const s3 = {
  put: vi.fn(async (key: string) => `${BASE}/${key}`),
  deleteByUrl: vi.fn(async () => undefined),
  keyFromUrl: (url: string) => (url.startsWith(`${BASE}/`) ? url.slice(BASE.length + 1) : null),
  headByUrl: vi.fn(async () => ({ size: 10, contentType: 'image/png' })),
};
const ds = {
  getRepository: (entity: EntityTarget<unknown>) => {
    if (entity === Media) return mediaRepo;
    if (entity === PostTranslation) return translationRepo;
    if (entity === User) return userRepo;
    if (entity === Page) return pageRepo;
    throw new Error('unexpected repository');
  },
  createQueryBuilder: () => insertQb,
} as unknown as DataSource;
const service = new MediaService(ds, s3 as unknown as S3Service);

beforeEach(() => {
  vi.clearAllMocks();
  translationsUsing = [];
  usersUsing = [];
  pagesUsing = [];
});

describe('MediaService.store', () => {
  it('uploads under the folder and registers the file in the library', async () => {
    const media = await service.store(
      { buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'me.png', size: 1 },
      'profile',
      'u1',
    );
    expect(s3.put).toHaveBeenCalledWith(
      expect.stringMatching(/^profile\/.+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(media).toMatchObject({ fileName: 'me.png', mimeType: 'image/png', uploadedById: 'u1' });
  });
});

describe('MediaService.deleteIfUnused', () => {
  it('deletes file and row when nothing uses the image', async () => {
    await service.deleteIfUnused([OURS, OURS, null]);
    expect(s3.deleteByUrl).toHaveBeenCalledTimes(1);
    expect(mediaRepo.delete).toHaveBeenCalledWith({ url: OURS });
  });

  it.each([
    ['a post version', () => (translationsUsing = ['Post'])],
    ['an avatar', () => (usersUsing = ['u1'])],
    ['a page', () => (pagesUsing = ['about'])],
  ])('keeps an image still used by %s', async (_name, use) => {
    use();
    await service.deleteIfUnused([OURS]);
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
    expect(mediaRepo.delete).not.toHaveBeenCalled();
  });

  it('never touches files outside our storage', async () => {
    await service.deleteIfUnused(['https://elsewhere.example/a.png']);
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });
});

describe('MediaService.remove', () => {
  it('refuses an image in use with where it is used', async () => {
    mediaRepo.findOne.mockResolvedValue({ id: 'm1', url: OURS, uploadedBy: null });
    pagesUsing = ['about'];
    await expect(service.remove('m1')).rejects.toMatchObject({
      status: 409,
      code: 'MEDIA_IN_USE',
      details: { usages: [{ kind: 'page', id: 'about', label: 'About' }] },
    });
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });

  it('deletes an unused image', async () => {
    mediaRepo.findOne.mockResolvedValue({ id: 'm1', url: OURS, uploadedBy: null });
    await service.remove('m1');
    expect(mediaRepo.delete).toHaveBeenCalledWith({ id: 'm1' });
    expect(s3.deleteByUrl).toHaveBeenCalledWith(OURS);
  });
});

describe('MediaService.assertInLibrary', () => {
  it('accepts library URLs only', async () => {
    mediaRepo.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.assertInLibrary(OURS, 'imageUrl')).resolves.toBeUndefined();
    await expect(service.assertInLibrary(OURS, 'imageUrl')).rejects.toMatchObject({
      status: 400,
      details: { fieldErrors: { imageUrl: 'Not in the media library' } },
    });
  });
});

describe('MediaService.importExisting', () => {
  it('registers our referenced images that the library does not know yet', async () => {
    translationRepo.find.mockResolvedValueOnce([
      { postId: 'p1', locale: 'en', imageUrl: OURS, ogImageUrl: 'https://elsewhere.example/x.png' },
    ] as never);
    userRepo.find.mockResolvedValueOnce([
      { id: 'u1', profileImageUrl: `${BASE}/profile/u.png` },
    ] as never);
    pageRepo.find.mockResolvedValueOnce([
      { id: 'pg', draft: { blocks: [{ data: { avatar: `${BASE}/pages/p.webp` } }] } },
    ] as never);
    mediaRepo.find.mockResolvedValueOnce([{ url: `${BASE}/profile/u.png` }]);

    await expect(service.importExisting()).resolves.toBe(2);
    expect(insertQb.values).toHaveBeenCalledWith(expect.objectContaining({ url: OURS }));
    expect(insertQb.values).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${BASE}/pages/p.webp` }),
    );
  });
});

describe('urlsIn', () => {
  it('finds URL strings anywhere in page content', () => {
    expect(urlsIn({ a: 'x', b: ['https://a.example/1.png', { c: 'http://b.example/2' }] })).toEqual(
      ['https://a.example/1.png', 'http://b.example/2'],
    );
  });
});
