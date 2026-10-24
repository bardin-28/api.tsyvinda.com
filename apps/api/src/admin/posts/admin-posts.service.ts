import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';
import type { AdminPostSortField, ListResponse, SortOrder } from '@tsyvinda/shared-types';
import { HttpError } from '../../shared/http-error';
import { S3Service } from '../../shared/s3/s3.service';
import { User } from '../../modules/users/entities/user.entity';
import { Post } from '../../modules/posts/entities/post.entity';
import {
  toPublicPost,
  type CreatePostInput,
  type PublicPost,
  type UpdatePostInput,
} from '../../modules/posts/services/post.service';

export type AdminUpdatePostInput = Omit<UpdatePostInput, 'description'> & {
  description?: string | null;
};

export interface AdminListPostsInput {
  page: number;
  perPage: number;
  sort: AdminPostSortField;
  order: SortOrder;
  q?: string;
}

type PostWithAuthor = Post & { author: User };

// Admin counterpart of PostService: offset paging for the panel's table, and edits/deletes
// any post (no author check). New posts are authored by the signed-in admin.
@Injectable()
export class AdminPostsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly s3: S3Service,
  ) {}

  private get posts(): Repository<Post> {
    return this.ds.getRepository(Post);
  }

  private get users(): Repository<User> {
    return this.ds.getRepository(User);
  }

  private withAuthor() {
    return this.posts
      .createQueryBuilder('post')
      .innerJoinAndMapOne('post.author', User, 'author', 'author.id = post.authorId');
  }

  async list(input: AdminListPostsInput): Promise<ListResponse<PublicPost>> {
    const qb = this.withAuthor()
      .orderBy(`post.${input.sort}`, input.order)
      .addOrderBy('post.id', input.order)
      .skip((input.page - 1) * input.perPage)
      .take(input.perPage);

    if (input.q) {
      // Escape LIKE wildcards so a search for "100%" matches literally.
      const term = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.where('(post.title ILIKE :term OR post.slug ILIKE :term)', { term });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((post) => toPublicPost(post, (post as PostWithAuthor).author)),
      total,
    };
  }

  async getById(id: string): Promise<PublicPost> {
    const post = await this.withAuthor().where('post.id = :id', { id }).getOne();
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    return toPublicPost(post, (post as PostWithAuthor).author);
  }

  async create(authorId: string, input: CreatePostInput): Promise<PublicPost> {
    const author = await this.users.findOne({ where: { id: authorId } });
    if (!author) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'Author not found');
    }
    await this.assertSlugFree(input.slug);

    const saved = await this.posts.save(
      this.posts.create({
        title: input.title,
        slug: input.slug,
        description: input.description ?? null,
        htmlContent: input.htmlContent,
        imageUrl: input.imageUrl ?? null,
        authorId,
      }),
    );
    return toPublicPost(saved, author);
  }

  async update(id: string, patch: AdminUpdatePostInput): Promise<PublicPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }

    const prevImage = post.imageUrl;
    if (patch.slug !== undefined && patch.slug !== post.slug) {
      await this.assertSlugFree(patch.slug, post.id);
      post.slug = patch.slug;
    }
    if (patch.title !== undefined) post.title = patch.title;
    if (patch.description !== undefined) post.description = patch.description;
    if (patch.htmlContent !== undefined) post.htmlContent = patch.htmlContent;
    if (patch.imageUrl !== undefined) post.imageUrl = patch.imageUrl;

    await this.posts.save(post);
    if (patch.imageUrl !== undefined && prevImage && prevImage !== patch.imageUrl) {
      void this.s3.deleteByUrl(prevImage);
    }
    return this.getById(post.id);
  }

  async remove(id: string): Promise<void> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    const prevImage = post.imageUrl;
    await this.posts.remove(post);
    if (prevImage) {
      void this.s3.deleteByUrl(prevImage);
    }
  }

  private async assertSlugFree(slug: string, ownId?: string): Promise<void> {
    const taken = await this.posts.findOne({ where: { slug } });
    if (taken && taken.id !== ownId) {
      throw new HttpError(409, 'SLUG_TAKEN', 'Slug already in use');
    }
  }
}
