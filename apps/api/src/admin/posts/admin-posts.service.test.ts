import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityManager, EntityTarget } from 'typeorm';
import type { RevalidationService } from '../../modules/cms/services/revalidation.service';
import { AdminPostsService } from './admin-posts.service';
import { Post } from '../../modules/posts/entities/post.entity';
import { PostCategory } from '../../modules/posts/entities/post-category.entity';
import { PostCategoryLink } from '../../modules/posts/entities/post-category-link.entity';
import { PostTranslation } from '../../modules/posts/entities/post-translation.entity';
import { User } from '../../modules/users/entities/user.entity';
import type { S3Service } from '../../shared/s3/s3.service';
import { HttpError } from '../../shared/http-error';

const author = { id: 'u1', firstName: 'Ada', lastName: 'Admin', profileImageUrl: null } as User;

const makePost = (over: Partial<Post> = {}): Post =>
  ({
    id: 'p1',
    slug: 'hello',
    authorId: 'someone-else',
    status: 'draft',
    publishedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...over,
  }) as Post;

const makeTranslation = (over: Partial<PostTranslation> = {}): PostTranslation =>
  ({
    postId: 'p1',
    locale: 'en',
    title: 'Hello',
    description: null,
    htmlContent: '<p>Hi</p>',
    imageUrl: 'https://cdn.example/posts/old.png',
    coverAlt: null,
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    canonicalUrl: null,
    ...over,
  }) as PostTranslation;

function makePostQb(result: { many?: unknown[]; count?: number; one?: unknown }) {
  return {
    innerJoinAndMapOne: vi.fn().mockReturnThis(),
    leftJoinAndMapOne: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([result.many ?? [], result.count ?? 0]),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
  };
}

function makeLocalesQb(rows: { postId: string; locale: string }[]) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(rows),
  };
}

let posts: {
  createQueryBuilder: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
let translations: {
  createQueryBuilder: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
};
let users: { exists: ReturnType<typeof vi.fn> };
let categories: { count: ReturnType<typeof vi.fn> };
let links: { delete: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
let categoryRows: { postId: string; id: string; slug: string; name: string }[];
let s3: { deleteByUrl: ReturnType<typeof vi.fn> };
let service: AdminPostsService;
let savedPost: Post | undefined;

const repoFor = (entity: EntityTarget<unknown>) => {
  if (entity === Post) return posts;
  if (entity === PostTranslation) return translations;
  if (entity === User) return users;
  if (entity === PostCategory) return categories;
  if (entity === PostCategoryLink) return links;
  throw new Error('unexpected repository');
};

beforeEach(() => {
  savedPost = undefined;
  categoryRows = [];
  posts = {
    createQueryBuilder: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (post: Post) => {
      savedPost = { ...makePost(), ...post, id: post.id ?? 'p-new' };
      return savedPost;
    }),
    create: vi.fn((post: Partial<Post>) => post),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  translations = {
    createQueryBuilder: vi.fn().mockReturnValue(makeLocalesQb([])),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((row: Partial<PostTranslation>) => ({ ...row })),
    insert: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
  };
  users = { exists: vi.fn().mockResolvedValue(true) };
  categories = { count: vi.fn() };
  links = {
    delete: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  s3 = { deleteByUrl: vi.fn().mockResolvedValue(undefined) };
  const manager = {
    getRepository: repoFor,
    query: vi.fn(async () => categoryRows),
  } as unknown as EntityManager;
  const ds = {
    getRepository: repoFor,
    manager,
    transaction: (work: (m: EntityManager) => Promise<unknown>) => work(manager),
  } as unknown as DataSource;
  service = new AdminPostsService(
    ds,
    s3 as unknown as S3Service,
    {
      revalidate: vi.fn(),
    } as unknown as RevalidationService,
  );
  // getById after writes reads the saved post back
  posts.createQueryBuilder.mockImplementation(() =>
    makePostQb({ one: savedPost ? { ...savedPost, author, translation: null } : null }),
  );
});

const expectHttpError = async (promise: Promise<unknown>, status: number, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ status, code });
};

describe('AdminPostsService.list', () => {
  it('pages, sorts, filters and attaches ordered categories and languages', async () => {
    const qb = makePostQb({
      many: [
        { ...makePost(), author, translation: makeTranslation({ locale: 'uk', title: 'Привіт' }) },
      ],
      count: 1,
    });
    posts.createQueryBuilder.mockReturnValue(qb);
    categoryRows = [{ postId: 'p1', id: 'c1', slug: 'frontend', name: 'Фронтенд' }];
    translations.createQueryBuilder.mockReturnValue(
      makeLocalesQb([
        { postId: 'p1', locale: 'en' },
        { postId: 'p1', locale: 'uk' },
      ]),
    );

    const result = await service.list({
      page: 2,
      perPage: 50,
      sort: 'publishedAt',
      order: 'DESC',
      q: '100%',
      status: 'published',
      categoryId: 'c1',
      locale: 'uk',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('post.publishedAt', 'DESC', 'NULLS LAST');
    expect(qb.offset).toHaveBeenCalledWith(50);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
      term: '%100\\%%',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('post.status = :status', { status: 'published' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('"categoryId"'), {
      categoryId: 'c1',
    });
    expect(result.items[0]).toMatchObject({
      title: 'Привіт',
      locale: 'uk',
      locales: ['en', 'uk'],
      categories: [{ id: 'c1', name: 'Фронтенд', slug: 'frontend' }],
      categoryIds: ['c1'],
    });
  });

  it('shows an untranslated post with its English title', async () => {
    posts.createQueryBuilder.mockReturnValue(
      makePostQb({
        many: [{ ...makePost(), author, translation: null, fallback: makeTranslation() }],
        count: 1,
      }),
    );
    const result = await service.list({
      page: 1,
      perPage: 25,
      sort: 'title',
      order: 'ASC',
      locale: 'uk',
    });
    expect(result.items[0]).toMatchObject({ title: 'Hello', locale: 'uk' });
  });
});

describe('AdminPostsService.getById', () => {
  it('returns empty translated fields for a missing language', async () => {
    posts.createQueryBuilder.mockReturnValue(
      makePostQb({ one: { ...makePost(), author, translation: null } }),
    );
    const view = await service.getById('p1', 'uk');
    expect(view).toMatchObject({ title: '', htmlContent: '', imageUrl: null, locale: 'uk' });
  });
});

describe('AdminPostsService.create', () => {
  const base = { title: 'Hi', slug: 'hi', htmlContent: '<p>x</p>' };

  it('defaults to a draft by the signed-in admin with one language version', async () => {
    await service.create('admin-1', 'uk', base);
    expect(posts.save).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'admin-1', status: 'draft', publishedAt: null }),
    );
    expect(translations.insert).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'p-new', locale: 'uk', title: 'Hi' }),
    );
    expect(links.insert).not.toHaveBeenCalled();
  });

  it('stamps publishedAt when created as published without a date', async () => {
    await service.create('admin-1', 'en', { ...base, status: 'published' });
    expect(savedPost?.publishedAt).toBeInstanceOf(Date);
  });

  it('uses another user as author and saves categories in order', async () => {
    categories.count.mockResolvedValue(2);
    await service.create('admin-1', 'en', { ...base, authorId: 'u9', categoryIds: ['c2', 'c1'] });
    expect(users.exists).toHaveBeenCalledWith({ where: { id: 'u9' } });
    expect(links.insert).toHaveBeenCalledWith([
      { postId: 'p-new', categoryId: 'c2', position: 0 },
      { postId: 'p-new', categoryId: 'c1', position: 1 },
    ]);
  });

  it('rejects an unknown author or category', async () => {
    users.exists.mockResolvedValue(false);
    await expectHttpError(
      service.create('admin-1', 'en', { ...base, authorId: 'nope' }),
      400,
      'AUTHOR_NOT_FOUND',
    );
    users.exists.mockResolvedValue(true);
    categories.count.mockResolvedValue(1);
    await expectHttpError(
      service.create('admin-1', 'en', { ...base, categoryIds: ['c1', 'missing'] }),
      400,
      'CATEGORY_NOT_FOUND',
    );
  });

  it('409s on a taken slug', async () => {
    posts.findOne.mockResolvedValue(makePost({ slug: 'hi' }));
    await expectHttpError(service.create('admin-1', 'en', base), 409, 'SLUG_TAKEN');
  });
});

describe('AdminPostsService.update', () => {
  it('edits the language version and deletes replaced images nothing else uses', async () => {
    posts.findOne.mockResolvedValue(makePost());
    const existing = makeTranslation({ ogImageUrl: 'https://cdn.example/posts/og/old.png' });
    translations.findOne.mockResolvedValue(existing);
    await service.update('p1', 'en', {
      title: 'New',
      imageUrl: 'https://cdn.example/posts/new.png',
      ogImageUrl: 'https://cdn.example/posts/og/new.png',
    });
    expect(translations.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'New' }));
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/old.png');
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/og/old.png');
  });

  it('keeps a replaced image another language still uses', async () => {
    posts.findOne.mockResolvedValue(makePost());
    translations.findOne.mockResolvedValue(makeTranslation({ locale: 'uk' }));
    translations.exists.mockResolvedValue(true);
    await service.update('p1', 'uk', { imageUrl: 'https://cdn.example/posts/uk.png' });
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });

  it('creates a missing language version when it has a title and content', async () => {
    posts.findOne.mockResolvedValue(makePost());
    await service.update('p1', 'uk', { title: 'Привіт', htmlContent: '<p>Текст</p>' });
    expect(translations.insert).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'p1', locale: 'uk', title: 'Привіт' }),
    );
  });

  it('rejects a new language version without content', async () => {
    posts.findOne.mockResolvedValue(makePost());
    await expectHttpError(
      service.update('p1', 'uk', { title: 'Привіт' }),
      400,
      'TRANSLATION_INCOMPLETE',
    );
  });

  it('changes shared fields without touching a missing language version', async () => {
    posts.findOne.mockResolvedValue(makePost());
    await service.update('p1', 'uk', { slug: 'renamed' });
    expect(posts.save).toHaveBeenCalledWith(expect.objectContaining({ slug: 'renamed' }));
    expect(translations.insert).not.toHaveBeenCalled();
    expect(translations.save).not.toHaveBeenCalled();
  });

  it('clears overrides with null', async () => {
    posts.findOne.mockResolvedValue(makePost());
    translations.findOne.mockResolvedValue(
      makeTranslation({ seoTitle: 'Old', description: 'Old' }),
    );
    await service.update('p1', 'en', { seoTitle: null, description: null });
    expect(translations.save).toHaveBeenCalledWith(
      expect.objectContaining({ seoTitle: null, description: null }),
    );
  });

  it('publishing stamps the date; unpublishing keeps it', async () => {
    posts.findOne.mockResolvedValue(makePost());
    await service.update('p1', 'en', { status: 'published' });
    const stamped = savedPost?.publishedAt;
    expect(stamped).toBeInstanceOf(Date);

    posts.findOne.mockResolvedValue(makePost({ status: 'published', publishedAt: stamped! }));
    await service.update('p1', 'en', { status: 'draft' });
    expect(savedPost?.publishedAt).toBe(stamped);
  });

  it('keeps an explicit "date shown" when publishing', async () => {
    posts.findOne.mockResolvedValue(makePost());
    const shown = new Date('2026-05-01T09:00:00.000Z');
    await service.update('p1', 'en', { status: 'published', publishedAt: shown });
    expect(savedPost?.publishedAt).toBe(shown);
  });

  it('replaces categories; [] removes them all', async () => {
    posts.findOne.mockResolvedValue(makePost());
    await service.update('p1', 'en', { categoryIds: [] });
    expect(links.delete).toHaveBeenCalledWith({ postId: 'p1' });
    expect(links.insert).not.toHaveBeenCalled();
  });

  it('404s for an unknown post', async () => {
    await expectHttpError(service.update('nope', 'en', { title: 'x' }), 404, 'POST_NOT_FOUND');
  });
});

describe('AdminPostsService.removeTranslation', () => {
  it('deletes one language version and its images', async () => {
    translations.find.mockResolvedValue([
      makeTranslation(),
      makeTranslation({ locale: 'uk', imageUrl: 'https://cdn.example/posts/uk.png' }),
    ]);
    await service.removeTranslation('p1', 'uk');
    expect(translations.delete).toHaveBeenCalledWith({ postId: 'p1', locale: 'uk' });
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/uk.png');
  });

  it('refuses to delete the last language version', async () => {
    translations.find.mockResolvedValue([makeTranslation()]);
    await expectHttpError(service.removeTranslation('p1', 'en'), 409, 'LAST_TRANSLATION');
  });

  it('404s for a language the post does not have', async () => {
    translations.find.mockResolvedValue([makeTranslation()]);
    await expectHttpError(service.removeTranslation('p1', 'uk'), 404, 'TRANSLATION_NOT_FOUND');
  });
});

describe('AdminPostsService.remove', () => {
  it('deletes the post with the images of every language', async () => {
    posts.findOne.mockResolvedValue(makePost());
    translations.find.mockResolvedValue([
      makeTranslation({ ogImageUrl: 'https://cdn.example/posts/og/a.png' }),
      makeTranslation({ locale: 'uk', imageUrl: 'https://cdn.example/posts/uk.png' }),
    ]);
    await service.remove('p1');
    expect(posts.remove).toHaveBeenCalled();
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/old.png');
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/og/a.png');
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/uk.png');
  });
});
