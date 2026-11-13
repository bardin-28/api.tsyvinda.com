import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { AdminCategoriesService } from './admin-categories.service';
import { PostCategory } from '../../modules/posts/entities/post-category.entity';
import { PostCategoryTranslation } from '../../modules/posts/entities/post-category-translation.entity';
import { HttpError } from '../../shared/http-error';

type CategoryRow = PostCategory & {
  translation?: Partial<PostCategoryTranslation> | null;
  fallback?: Partial<PostCategoryTranslation> | null;
};

const makeCategory = (over: Partial<CategoryRow> = {}): CategoryRow =>
  ({
    id: 'c1',
    slug: 'frontend',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    translation: { locale: 'en', name: 'Frontend' },
    fallback: { locale: 'en', name: 'Frontend' },
    ...over,
  }) as CategoryRow;

function makeQb(result: { many?: CategoryRow[]; total?: number; one?: CategoryRow | null }) {
  return {
    leftJoinAndMapOne: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([result.many ?? [], result.total ?? 0]),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
  };
}

let categories: {
  createQueryBuilder: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
let names: {
  find: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};
let countRows: { categoryId: string; count: string }[];
let service: AdminCategoriesService;

beforeEach(() => {
  countRows = [];
  categories = {
    createQueryBuilder: vi.fn(() => makeQb({ one: makeCategory() })),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (category: PostCategory) => ({ ...makeCategory(), ...category })),
    create: vi.fn((category: Partial<PostCategory>) => category),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  names = {
    find: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const linkQb = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(async () => countRows),
  };
  const repoFor = (entity: EntityTarget<unknown>) => {
    if (entity === PostCategory) return categories;
    if (entity === PostCategoryTranslation) return names;
    return { createQueryBuilder: () => linkQb };
  };
  const manager = { getRepository: repoFor } as unknown as EntityManager;
  const ds = {
    getRepository: repoFor,
    transaction: (work: (m: EntityManager) => Promise<unknown>) => work(manager),
  } as unknown as DataSource;
  service = new AdminCategoriesService(ds);
});

const expectHttpError = async (promise: Promise<unknown>, status: number, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ status, code });
};

describe('AdminCategoriesService', () => {
  it('lists names in the content language with post counts and languages', async () => {
    const qb = makeQb({
      many: [
        makeCategory({ translation: { locale: 'uk', name: 'Фронтенд' } }),
        makeCategory({
          id: 'c2',
          slug: 'security',
          translation: null,
          fallback: { name: 'Security' },
        }),
      ],
      total: 2,
    });
    categories.createQueryBuilder.mockReturnValue(qb);
    countRows = [{ categoryId: 'c1', count: '7' }];
    names.find.mockResolvedValue([
      { categoryId: 'c1', locale: 'en' },
      { categoryId: 'c1', locale: 'uk' },
      { categoryId: 'c2', locale: 'en' },
    ]);

    const result = await service.list({
      page: 1,
      perPage: 50,
      sort: 'name',
      order: 'ASC',
      q: 'front',
      locale: 'uk',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('sort_name', 'ASC');
    expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), { term: '%front%' });
    expect(result.total).toBe(2);
    expect(result.items).toMatchObject([
      { id: 'c1', name: 'Фронтенд', postCount: 7, locales: ['en', 'uk'] },
      { id: 'c2', name: 'Security', postCount: 0, locales: ['en'] },
    ]);
  });

  it('returns an empty name for a language the category has no name in', async () => {
    categories.createQueryBuilder.mockReturnValue(
      makeQb({ one: makeCategory({ translation: null }) }),
    );
    expect(await service.getById('c1', 'uk')).toMatchObject({ id: 'c1', name: '' });
  });

  it('404s for an unknown category', async () => {
    categories.createQueryBuilder.mockReturnValue(makeQb({ one: null }));
    await expectHttpError(service.getById('nope', 'en'), 404, 'CATEGORY_NOT_FOUND');
  });

  it('creates a category with its name in the content language', async () => {
    await service.create('uk', { name: 'Фронтенд', slug: 'frontend' });
    expect(names.insert).toHaveBeenCalledWith({ categoryId: 'c1', locale: 'uk', name: 'Фронтенд' });
  });

  it('409s on a taken slug', async () => {
    categories.findOne.mockResolvedValue(makeCategory({ id: 'other' }));
    await expectHttpError(service.create('en', { name: 'X', slug: 'frontend' }), 409, 'SLUG_TAKEN');
  });

  it('updates the name of one language and the shared slug', async () => {
    categories.findOne.mockResolvedValueOnce(makeCategory()).mockResolvedValueOnce(null);
    await service.update('c1', 'uk', { name: 'Фронтенд', slug: 'front' });
    expect(categories.save).toHaveBeenCalledWith(expect.objectContaining({ slug: 'front' }));
    expect(names.upsert).toHaveBeenCalledWith(
      { categoryId: 'c1', locale: 'uk', name: 'Фронтенд' },
      ['categoryId', 'locale'],
    );
  });

  it('deletes a category', async () => {
    categories.findOne.mockResolvedValue(makeCategory());
    await service.remove('c1');
    expect(categories.remove).toHaveBeenCalled();
  });
});
