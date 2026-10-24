import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityTarget } from 'typeorm';
import { AdminPostsService } from './admin-posts.service';
import { Post } from '../../modules/posts/entities/post.entity';
import { User } from '../../modules/users/entities/user.entity';
import type { S3Service } from '../../shared/s3/s3.service';

const author = {
  id: 'u1',
  firstName: 'Ada',
  lastName: 'Admin',
  profileImageUrl: null,
} as User;

const makePost = (over: Partial<Post> = {}): Post =>
  ({
    id: 'p1',
    title: 'Hello',
    slug: 'hello',
    description: null,
    htmlContent: '<p>Hi</p>',
    imageUrl: 'https://cdn.example/posts/old.png',
    authorId: 'someone-else',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...over,
  }) as Post;

function makeQb(result: { many?: Post[]; count?: number; one?: Post | null }) {
  const qb = {
    innerJoinAndMapOne: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([result.many ?? [], result.count ?? 0]),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
  };
  return qb;
}

let posts: {
  createQueryBuilder: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
let users: { findOne: ReturnType<typeof vi.fn> };
let s3: { deleteByUrl: ReturnType<typeof vi.fn> };
let service: AdminPostsService;

beforeEach(() => {
  posts = {
    createQueryBuilder: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (p: Post) => ({ ...makePost(), ...p })),
    create: vi.fn((p: Partial<Post>) => p),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  users = { findOne: vi.fn().mockResolvedValue(author) };
  s3 = { deleteByUrl: vi.fn().mockResolvedValue(undefined) };
  const ds = {
    getRepository: (entity: EntityTarget<unknown>) => (entity === Post ? posts : users),
  } as unknown as DataSource;
  service = new AdminPostsService(ds, s3 as unknown as S3Service);
});

describe('AdminPostsService.list', () => {
  it('pages, sorts and returns items with the total', async () => {
    const qb = makeQb({ many: [Object.assign(makePost(), { author })], count: 31 });
    posts.createQueryBuilder.mockReturnValue(qb);

    const result = await service.list({ page: 2, perPage: 10, sort: 'title', order: 'ASC' });

    expect(qb.orderBy).toHaveBeenCalledWith('post.title', 'ASC');
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.where).not.toHaveBeenCalled();
    expect(result.total).toBe(31);
    expect(result.items[0]).toMatchObject({ id: 'p1', author: { id: 'u1' } });
  });

  it('searches title/slug with LIKE wildcards escaped', async () => {
    const qb = makeQb({});
    posts.createQueryBuilder.mockReturnValue(qb);

    await service.list({ page: 1, perPage: 25, sort: 'createdAt', order: 'DESC', q: '100%_x' });

    expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
      term: '%100\\%\\_x%',
    });
  });
});

describe('AdminPostsService.update', () => {
  it("edits someone else's post and deletes the replaced image", async () => {
    posts.findOne.mockImplementation(async ({ where }: { where: Partial<Post> }) =>
      where.id ? makePost() : null,
    );
    posts.createQueryBuilder.mockReturnValue(
      makeQb({ one: Object.assign(makePost({ title: 'New' }), { author }) }),
    );

    const result = await service.update('p1', {
      title: 'New',
      imageUrl: 'https://cdn.example/posts/new.png',
    });

    expect(posts.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New', imageUrl: 'https://cdn.example/posts/new.png' }),
    );
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/old.png');
    expect(result.title).toBe('New');
  });

  it('clears the description with null', async () => {
    posts.findOne.mockResolvedValueOnce(makePost({ description: 'old' }));
    posts.createQueryBuilder.mockReturnValue(
      makeQb({ one: Object.assign(makePost(), { author }) }),
    );

    await service.update('p1', { description: null });

    expect(posts.save).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });

  it('rejects a slug another post uses with 409', async () => {
    posts.findOne
      .mockResolvedValueOnce(makePost())
      .mockResolvedValueOnce(makePost({ id: 'p2', slug: 'taken' }));

    await expect(service.update('p1', { slug: 'taken' })).rejects.toMatchObject({
      status: 409,
      code: 'SLUG_TAKEN',
    });
    expect(posts.save).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown post', async () => {
    await expect(service.update('nope', { title: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('AdminPostsService.create', () => {
  it('creates the post authored by the admin', async () => {
    const result = await service.create('u1', {
      title: 'Hello',
      slug: 'hello',
      htmlContent: '<p>Hi</p>',
      imageUrl: null,
    });
    expect(posts.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'u1', description: null, imageUrl: null }),
    );
    expect(result.author.id).toBe('u1');
  });

  it('rejects a taken slug with 409', async () => {
    posts.findOne.mockResolvedValueOnce(makePost());
    await expect(
      service.create('u1', { title: 'x', slug: 'hello', htmlContent: '<p>x</p>' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('AdminPostsService.remove', () => {
  it('deletes any post and its image', async () => {
    posts.findOne.mockResolvedValueOnce(makePost());
    await service.remove('p1');
    expect(posts.remove).toHaveBeenCalled();
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.example/posts/old.png');
  });

  it('returns 404 for an unknown post', async () => {
    await expect(service.remove('nope')).rejects.toMatchObject({ status: 404 });
  });
});
