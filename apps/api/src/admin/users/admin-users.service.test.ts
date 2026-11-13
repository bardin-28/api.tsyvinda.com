import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityTarget } from 'typeorm';
import { Role } from '@tsyvinda/shared-types';
import { AdminUsersService } from './admin-users.service';
import { User } from '../../modules/users/entities/user.entity';
import { Post } from '../../modules/posts/entities/post.entity';
import type { MediaService } from '../../modules/media/media.service';
import { HttpError } from '../../shared/http-error';

const makeUser = (over: Partial<User> = {}): User =>
  ({
    id: 'u2',
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    passwordHash: 'hash',
    profileImageUrl: null,
    emailVerified: true,
    role: Role.USER,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...over,
  }) as User;

function makeUserQb(result: { many: User[]; count: number }) {
  return {
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([result.many, result.count]),
  };
}

function makeCountQb(rows: { authorId: string; count: string }[]) {
  return {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
}

let users: {
  createQueryBuilder: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
let posts: { createQueryBuilder: ReturnType<typeof vi.fn> };
let s3: { deleteByUrl: ReturnType<typeof vi.fn> };
let service: AdminUsersService;

const withPostCounts = (rows: { authorId: string; count: string }[]) =>
  posts.createQueryBuilder.mockReturnValue(makeCountQb(rows));

beforeEach(() => {
  users = {
    createQueryBuilder: vi.fn(),
    findOne: vi.fn().mockResolvedValue(makeUser()),
    count: vi.fn().mockResolvedValue(2),
    save: vi.fn(async (user: User) => user),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  posts = { createQueryBuilder: vi.fn() };
  withPostCounts([]);
  s3 = { deleteByUrl: vi.fn().mockResolvedValue(undefined) };
  const ds = {
    getRepository: (entity: EntityTarget<unknown>) => (entity === User ? users : posts),
  } as unknown as DataSource;
  service = new AdminUsersService(ds, {
    deleteIfUnused: async (urls: (string | null | undefined)[]) => {
      for (const url of urls)
        if (url) await (s3.deleteByUrl as unknown as (u: string) => Promise<void>)(url);
    },
  } as unknown as MediaService);
});

const expectHttpError = async (promise: Promise<unknown>, status: number, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ status, code });
};

describe('list', () => {
  it('pages, searches name/email with escaped wildcards, filters role, adds post counts', async () => {
    const qb = makeUserQb({ many: [makeUser(), makeUser({ id: 'u3' })], count: 2 });
    users.createQueryBuilder.mockReturnValue(qb);
    withPostCounts([{ authorId: 'u2', count: '3' }]);

    const result = await service.list({
      page: 2,
      perPage: 50,
      sort: 'email',
      order: 'ASC',
      q: '100%_x',
      role: Role.ADMIN,
    });

    expect(qb.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    expect(qb.skip).toHaveBeenCalledWith(50);
    expect(qb.take).toHaveBeenCalledWith(50);
    expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('ILIKE :term'), {
      term: '%100\\%\\_x%',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('user.role = :role', { role: Role.ADMIN });
    expect(result.total).toBe(2);
    expect(result.items.map((user) => [user.id, user.postCount])).toEqual([
      ['u2', 3],
      ['u3', 0],
    ]);
    // Never leak credentials to the panel
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('skips the post-count query for an empty page', async () => {
    users.createQueryBuilder.mockReturnValue(makeUserQb({ many: [], count: 0 }));
    await service.list({ page: 1, perPage: 50, sort: 'createdAt', order: 'DESC' });
    expect(posts.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('promotes a user to admin', async () => {
    const result = await service.update('admin-1', 'u2', { role: Role.ADMIN });
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ role: Role.ADMIN }));
    expect(result.role).toBe(Role.ADMIN);
  });

  it('demotes another admin while more than one admin exists', async () => {
    users.findOne.mockResolvedValue(makeUser({ role: Role.ADMIN }));
    users.count.mockResolvedValue(2);
    await service.update('admin-1', 'u2', { role: Role.USER });
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ role: Role.USER }));
  });

  it('refuses to demote yourself', async () => {
    users.findOne.mockResolvedValue(makeUser({ id: 'admin-1', role: Role.ADMIN }));
    await expectHttpError(
      service.update('admin-1', 'admin-1', { role: Role.USER }),
      409,
      'CANNOT_DEMOTE_SELF',
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('refuses to demote the last admin', async () => {
    users.findOne.mockResolvedValue(makeUser({ role: Role.ADMIN }));
    users.count.mockResolvedValue(1);
    await expectHttpError(service.update('admin-1', 'u2', { role: Role.USER }), 409, 'LAST_ADMIN');
    expect(users.save).not.toHaveBeenCalled();
  });

  it('keeps the role and image when the role is unchanged', async () => {
    await service.update('admin-1', 'u2', { role: Role.USER });
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ role: Role.USER }));
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });

  it('replaces the profile image and deletes the old object', async () => {
    users.findOne.mockResolvedValue(
      makeUser({ profileImageUrl: 'https://cdn.test/profile/old.jpg' }),
    );
    const result = await service.update('admin-1', 'u2', {
      profileImageUrl: 'https://cdn.test/profile/new.jpg',
    });
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ profileImageUrl: 'https://cdn.test/profile/new.jpg' }),
    );
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.test/profile/old.jpg');
    expect(result.profileImageUrl).toBe('https://cdn.test/profile/new.jpg');
  });

  it('clears the profile image with null', async () => {
    users.findOne.mockResolvedValue(
      makeUser({ profileImageUrl: 'https://cdn.test/profile/old.jpg' }),
    );
    await service.update('admin-1', 'u2', { profileImageUrl: null });
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ profileImageUrl: null }));
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.test/profile/old.jpg');
  });

  it('lets an admin change their own avatar', async () => {
    users.findOne.mockResolvedValue(makeUser({ id: 'admin-1', role: Role.ADMIN }));
    await service.update('admin-1', 'admin-1', {
      profileImageUrl: 'https://cdn.test/profile/me.jpg',
    });
    expect(users.save).toHaveBeenCalled();
  });

  it('404s for an unknown user', async () => {
    users.findOne.mockResolvedValue(null);
    await expectHttpError(
      service.update('admin-1', 'nope', { role: Role.ADMIN }),
      404,
      'USER_NOT_FOUND',
    );
  });
});

describe('remove', () => {
  it('deletes the user and their profile image', async () => {
    users.findOne.mockResolvedValue(
      makeUser({ profileImageUrl: 'https://cdn.test/profile/a.jpg' }),
    );
    await service.remove('admin-1', 'u2');
    expect(users.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'u2' }));
    expect(s3.deleteByUrl).toHaveBeenCalledWith('https://cdn.test/profile/a.jpg');
  });

  it('refuses to delete yourself', async () => {
    await expectHttpError(service.remove('admin-1', 'admin-1'), 409, 'CANNOT_DELETE_SELF');
    expect(users.remove).not.toHaveBeenCalled();
  });

  it('refuses to delete a user who has posts (they would cascade away)', async () => {
    withPostCounts([{ authorId: 'u2', count: '4' }]);
    await expectHttpError(service.remove('admin-1', 'u2'), 409, 'USER_HAS_POSTS');
    expect(users.remove).not.toHaveBeenCalled();
    expect(s3.deleteByUrl).not.toHaveBeenCalled();
  });

  it('404s for an unknown user', async () => {
    users.findOne.mockResolvedValue(null);
    await expectHttpError(service.remove('admin-1', 'nope'), 404, 'USER_NOT_FOUND');
  });
});

// Post is imported for the repository switch above; keep the reference explicit.
void Post;
