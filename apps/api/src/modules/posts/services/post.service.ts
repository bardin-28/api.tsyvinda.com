import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';
import { HttpError } from '../../../shared/http-error';
import { S3Service } from '../../../shared/s3/s3.service';
import { User } from '../../users/entities/user.entity';
import { Post } from '../entities/post.entity';

export interface PublicAuthor {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export interface PublicPost {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  htmlContent: string;
  imageUrl: string | null;
  author: PublicAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  title: string;
  slug: string;
  description?: string;
  htmlContent: string;
  imageUrl?: string | null;
}

export interface UpdatePostInput {
  title?: string;
  slug?: string;
  description?: string;
  htmlContent?: string;
  imageUrl?: string | null;
}

export interface ListPostsInput {
  limit: number;
  cursor?: string;
}

export interface ListPostsResult {
  items: PublicPost[];
  nextCursor: string | null;
}

interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(post: Pick<Post, 'createdAt' | 'id'>): string {
  const payload: Cursor = { createdAt: post.createdAt.toISOString(), id: post.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  let parsed: unknown;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    throw new HttpError(400, 'INVALID_CURSOR', 'Cursor is not decodable');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Cursor).createdAt !== 'string' ||
    typeof (parsed as Cursor).id !== 'string'
  ) {
    throw new HttpError(400, 'INVALID_CURSOR', 'Cursor payload is malformed');
  }

  const c = parsed as Cursor;

  if (Number.isNaN(Date.parse(c.createdAt))) {
    throw new HttpError(400, 'INVALID_CURSOR', 'Cursor createdAt is not a valid date');
  }
  return c;
}

export function toPublicAuthor(user: User): PublicAuthor {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
  };
}

export function toPublicPost(post: Post, author: User): PublicPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    description: post.description,
    htmlContent: post.htmlContent,
    imageUrl: post.imageUrl,
    author: toPublicAuthor(author),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

@Injectable()
export class PostService {
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

  async create(authorId: string, input: CreatePostInput): Promise<PublicPost> {
    const author = await this.users.findOne({ where: { id: authorId } });

    if (!author) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'Author not found');
    }

    const slugTaken = await this.posts.findOne({ where: { slug: input.slug } });

    if (slugTaken) {
      throw new HttpError(409, 'SLUG_TAKEN', 'Slug already in use');
    }

    const post = this.posts.create({
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      htmlContent: input.htmlContent,
      imageUrl: input.imageUrl ?? null,
      authorId,
    });

    const saved = await this.posts.save(post);
    return toPublicPost(saved, author);
  }

  async list(input: ListPostsInput): Promise<ListPostsResult> {
    const qb = this.posts
      .createQueryBuilder('post')
      .innerJoinAndMapOne('post.author', User, 'author', 'author.id = post.authorId')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .limit(input.limit + 1);

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);

      qb.where('(post.createdAt < :cAt OR (post.createdAt = :cAt AND post.id < :cId))', {
        cAt: cursor.createdAt,
        cId: cursor.id,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > input.limit;
    const slice = hasMore ? rows.slice(0, input.limit) : rows;
    const last = slice[slice.length - 1];

    return {
      items: slice.map((p) => toPublicPost(p, (p as Post & { author: User }).author)),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  async getBySlug(slug: string): Promise<PublicPost> {
    const post = await this.posts
      .createQueryBuilder('post')
      .innerJoinAndMapOne('post.author', User, 'author', 'author.id = post.authorId')
      .where('post.slug = :slug', { slug })
      .getOne();
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    return toPublicPost(post, (post as Post & { author: User }).author);
  }

  async update(id: string, authorId: string, patch: UpdatePostInput): Promise<PublicPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    if (post.authorId !== authorId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the author can edit this post');
    }

    const prevImage = post.imageUrl;

    if (patch.slug !== undefined && patch.slug !== post.slug) {
      const slugTaken = await this.posts.findOne({ where: { slug: patch.slug } });
      if (slugTaken && slugTaken.id !== post.id) {
        throw new HttpError(409, 'SLUG_TAKEN', 'Slug already in use');
      }
      post.slug = patch.slug;
    }
    if (patch.title !== undefined) post.title = patch.title;
    if (patch.description !== undefined) post.description = patch.description;
    if (patch.htmlContent !== undefined) post.htmlContent = patch.htmlContent;
    if (patch.imageUrl !== undefined) post.imageUrl = patch.imageUrl;

    const saved = await this.posts.save(post);

    if (patch.imageUrl !== undefined && prevImage && prevImage !== patch.imageUrl) {
      void this.s3.deleteByUrl(prevImage);
    }

    const author = await this.users.findOne({ where: { id: saved.authorId } });
    if (!author) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'Author not found');
    }
    return toPublicPost(saved, author);
  }

  async remove(id: string, authorId: string): Promise<void> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    if (post.authorId !== authorId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the author can delete this post');
    }
    const prevImage = post.imageUrl;
    await this.posts.remove(post);
    if (prevImage) {
      void this.s3.deleteByUrl(prevImage);
    }
  }
}
