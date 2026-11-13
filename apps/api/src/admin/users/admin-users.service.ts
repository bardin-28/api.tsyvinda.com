import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';
import {
  Role,
  type AdminUserSortField,
  type ListResponse,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../shared/http-error';
import { MediaService } from '../../modules/media/media.service';
import { User } from '../../modules/users/entities/user.entity';
import { Post } from '../../modules/posts/entities/post.entity';
import { toPublicUser, type PublicUser } from '../../modules/auth/services/auth.service';

export interface AdminListUsersInput {
  page: number;
  perPage: number;
  sort: AdminUserSortField;
  order: SortOrder;
  q?: string;
  role?: Role;
}

export type AdminUserView = PublicUser & { postCount: number };

export interface AdminUpdateUserInput {
  role?: Role;
  /** New image URL, or null to clear it */
  profileImageUrl?: string | null;
}

// User management for the admin panel: list/search, change role and avatar, delete.
// Role and delete guard the panel itself: nobody demotes or deletes themselves, the last admin
// cannot be demoted, and users who authored posts cannot be deleted (posts_author_fk cascades,
// so deleting them would silently delete their posts too).
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly media: MediaService,
  ) {}

  private get users(): Repository<User> {
    return this.ds.getRepository(User);
  }

  private get posts(): Repository<Post> {
    return this.ds.getRepository(Post);
  }

  async list(input: AdminListUsersInput): Promise<ListResponse<AdminUserView>> {
    const qb = this.users
      .createQueryBuilder('user')
      .orderBy(`user.${input.sort}`, input.order)
      .addOrderBy('user.id', input.order)
      .skip((input.page - 1) * input.perPage)
      .take(input.perPage);

    if (input.q) {
      // Escape LIKE wildcards so a search for "100%" matches literally.
      const term = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.where(
        "(user.email ILIKE :term OR user.firstName ILIKE :term OR user.lastName ILIKE :term OR (user.firstName || ' ' || user.lastName) ILIKE :term)",
        { term },
      );
    }
    if (input.role) {
      qb.andWhere('user.role = :role', { role: input.role });
    }

    const [rows, total] = await qb.getManyAndCount();
    const postCounts = await this.postCountsByAuthor(rows.map((user) => user.id));
    return {
      items: rows.map((user) => toAdminUser(user, postCounts.get(user.id) ?? 0)),
      total,
    };
  }

  async getById(id: string): Promise<AdminUserView> {
    const user = await this.findOrFail(id);
    const postCounts = await this.postCountsByAuthor([id]);
    return toAdminUser(user, postCounts.get(id) ?? 0);
  }

  /**
   * Applies a role change and/or a new profile image (`null` clears it). The previous image
   * object is deleted once the new value is saved.
   */
  async update(actorId: string, id: string, patch: AdminUpdateUserInput): Promise<AdminUserView> {
    const user = await this.findOrFail(id);

    if (patch.role !== undefined && patch.role !== user.role) {
      const isDemotion = user.role === Role.ADMIN;
      if (isDemotion && id === actorId) {
        throw new HttpError(409, 'CANNOT_DEMOTE_SELF', 'You cannot remove your own admin role');
      }
      if (isDemotion && (await this.users.count({ where: { role: Role.ADMIN } })) <= 1) {
        throw new HttpError(409, 'LAST_ADMIN', 'The last admin cannot be demoted');
      }
      user.role = patch.role;
    }

    const prevImage = user.profileImageUrl;
    if (patch.profileImageUrl !== undefined) user.profileImageUrl = patch.profileImageUrl;

    await this.users.save(user);
    if (patch.profileImageUrl !== undefined && prevImage && prevImage !== patch.profileImageUrl) {
      await this.media.deleteIfUnused([prevImage]);
    }
    return this.getById(id);
  }

  async remove(actorId: string, id: string): Promise<void> {
    if (id === actorId) {
      throw new HttpError(409, 'CANNOT_DELETE_SELF', 'You cannot delete your own account here');
    }
    const user = await this.findOrFail(id);
    const postCount = (await this.postCountsByAuthor([id])).get(id) ?? 0;
    if (postCount > 0) {
      throw new HttpError(
        409,
        'USER_HAS_POSTS',
        `User has ${postCount} post(s); delete or reassign them first`,
        { postCount },
      );
    }
    const profileImageUrl = user.profileImageUrl;
    await this.users.remove(user);
    if (profileImageUrl) await this.media.deleteIfUnused([profileImageUrl]);
  }

  private async findOrFail(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return user;
  }

  private async postCountsByAuthor(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.posts
      .createQueryBuilder('post')
      .select('post.authorId', 'authorId')
      .addSelect('COUNT(*)', 'count')
      .where('post.authorId IN (:...userIds)', { userIds })
      .groupBy('post.authorId')
      .getRawMany<{ authorId: string; count: string }>();
    return new Map(rows.map((row) => [row.authorId, Number(row.count)]));
  }
}

function toAdminUser(user: User, postCount: number): AdminUserView {
  return { ...toPublicUser(user), postCount };
}
