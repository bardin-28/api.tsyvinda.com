import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Role, type DashboardStats } from '@tsyvinda/shared-types';
import { User } from '../../modules/users/entities/user.entity';
import { Post } from '../../modules/posts/entities/post.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_USERS_LIMIT = 5;

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
  ) {}

  async getStats(now: Date = new Date()): Promise<DashboardStats> {
    const since7 = MoreThanOrEqual(new Date(now.getTime() - 7 * DAY_MS));
    const since30 = MoreThanOrEqual(new Date(now.getTime() - 30 * DAY_MS));

    const [
      usersTotal,
      admins,
      pendingApproval,
      unverified,
      usersLast7,
      usersLast30,
      postsTotal,
      postsLast7,
      postsLast30,
      recent,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { role: Role.ADMIN } }),
      this.users.count({ where: { emailVerified: true, approvedByAdmin: false } }),
      this.users.count({ where: { emailVerified: false } }),
      this.users.count({ where: { createdAt: since7 } }),
      this.users.count({ where: { createdAt: since30 } }),
      this.posts.count(),
      this.posts.count({ where: { createdAt: since7 } }),
      this.posts.count({ where: { createdAt: since30 } }),
      this.users.find({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          emailVerified: true,
          approvedByAdmin: true,
          createdAt: true,
        },
        order: { createdAt: 'DESC' },
        take: RECENT_USERS_LIMIT,
      }),
    ]);

    return {
      users: {
        total: usersTotal,
        admins,
        pendingApproval,
        unverified,
        newLast7Days: usersLast7,
        newLast30Days: usersLast30,
      },
      posts: { total: postsTotal, newLast7Days: postsLast7, newLast30Days: postsLast30 },
      recentUsers: recent.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        emailVerified: user.emailVerified,
        approvedByAdmin: user.approvedByAdmin,
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }
}
