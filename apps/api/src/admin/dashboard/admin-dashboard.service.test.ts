import { describe, it, expect, vi } from 'vitest';
import { FindOperator, type Repository } from 'typeorm';
import { Role } from '@tsyvinda/shared-types';
import { AdminDashboardService } from './admin-dashboard.service';
import type { User } from '../../modules/users/entities/user.entity';
import type { Post } from '../../modules/posts/entities/post.entity';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

type Where = Record<string, unknown> | undefined;
const sinceOf = (where: Where): number | undefined => {
  const op = where?.createdAt;
  return op instanceof FindOperator ? (op.value as Date).getTime() : undefined;
};

describe('AdminDashboardService.getStats', () => {
  it('aggregates user and post counts and maps the latest signups', async () => {
    const userCount = vi.fn(async (opts?: { where?: Where }) => {
      const where = opts?.where;
      if (!where) return 42;
      if (where.role === Role.ADMIN) return 2;
      if (where.emailVerified === true && where.approvedByAdmin === false) return 5;
      if (where.emailVerified === false) return 7;
      if (sinceOf(where) === NOW.getTime() - 7 * DAY_MS) return 3;
      if (sinceOf(where) === NOW.getTime() - 30 * DAY_MS) return 11;
      throw new Error(`unexpected where ${JSON.stringify(where)}`);
    });
    const recent = [
      {
        id: 'u9',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        emailVerified: true,
        approvedByAdmin: false,
        createdAt: new Date('2026-10-23T08:00:00.000Z'),
      },
    ];
    const userFind = vi.fn().mockResolvedValue(recent);
    const postCount = vi.fn(async (opts?: { where?: Where }) => {
      if (!opts?.where) return 20;
      return sinceOf(opts.where) === NOW.getTime() - 7 * DAY_MS ? 1 : 4;
    });

    const service = new AdminDashboardService(
      { count: userCount, find: userFind } as unknown as Repository<User>,
      { count: postCount } as unknown as Repository<Post>,
    );

    const stats = await service.getStats(NOW);

    expect(stats).toEqual({
      users: {
        total: 42,
        admins: 2,
        pendingApproval: 5,
        unverified: 7,
        newLast7Days: 3,
        newLast30Days: 11,
      },
      posts: { total: 20, newLast7Days: 1, newLast30Days: 4 },
      recentUsers: [{ ...recent[0], createdAt: '2026-10-23T08:00:00.000Z' }],
    });
    expect(userFind).toHaveBeenCalledWith(
      expect.objectContaining({ order: { createdAt: 'DESC' }, take: 5 }),
    );
    // Never select password hashes into the dashboard.
    expect(userFind.mock.calls[0]?.[0].select).not.toHaveProperty('passwordHash');
  });
});
