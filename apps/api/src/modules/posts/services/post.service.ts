import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, type Repository } from 'typeorm';
import { DEFAULT_LOCALE, type Locale, type PostStatus } from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { User } from '../../users/entities/user.entity';
import { Post } from '../entities/post.entity';
import { PostTranslation } from '../entities/post-translation.entity';

export interface PublicAuthor {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicPost {
  id: string;
  locale: Locale;
  locales: Locale[];
  title: string;
  /** Shared key (English URL segment) */
  slug: string;
  /** This language's own URL segment; null = `slug` */
  localizedSlug: string | null;
  /** URL segment per language the post exists in */
  slugs: Partial<Record<Locale, string>>;
  description: string | null;
  htmlContent: string;
  imageUrl: string | null;
  coverAlt: string | null;
  author: PublicAuthor;
  categories: PublicCategory[];
  status: PostStatus;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  keywords: string[];
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListPostsInput {
  limit: number;
  cursor?: string;
  /** Category slug filter */
  category?: string;
  locale: Locale;
}

export interface ListPostsResult {
  items: PublicPost[];
  nextCursor: string | null;
}

interface Cursor {
  publishedAt: string;
  id: string;
}

export function encodeCursor(post: { publishedAt: Date | null; id: string }): string {
  const payload: Cursor = {
    publishedAt: (post.publishedAt ?? new Date(0)).toISOString(),
    id: post.id,
  };
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
    typeof (parsed as Cursor).publishedAt !== 'string' ||
    typeof (parsed as Cursor).id !== 'string'
  ) {
    throw new HttpError(400, 'INVALID_CURSOR', 'Cursor payload is malformed');
  }

  const cursor = parsed as Cursor;
  if (Number.isNaN(Date.parse(cursor.publishedAt))) {
    throw new HttpError(400, 'INVALID_CURSOR', 'Cursor publishedAt is not a valid date');
  }
  return cursor;
}

export function toPublicAuthor(user: User): PublicAuthor {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
  };
}

/** Translated fields of a post in one language; the empty version stands for "not translated". */
export type PostTranslationFields = Pick<
  PostTranslation,
  | 'title'
  | 'slug'
  | 'description'
  | 'htmlContent'
  | 'imageUrl'
  | 'coverAlt'
  | 'seoTitle'
  | 'seoDescription'
  | 'keywords'
  | 'ogImageUrl'
  | 'canonicalUrl'
>;

export const EMPTY_TRANSLATION: PostTranslationFields = {
  title: '',
  slug: null,
  description: null,
  htmlContent: '',
  imageUrl: null,
  coverAlt: null,
  seoTitle: null,
  seoDescription: null,
  keywords: [],
  ogImageUrl: null,
  canonicalUrl: null,
};

/** One existing language version of a post: its language and own URL segment (null = shared). */
export interface PostVersion {
  locale: Locale;
  slug: string | null;
}

export interface PostLocaleView {
  locale: Locale;
  /** Language versions the post has */
  versions: PostVersion[];
  translation: PostTranslationFields;
}

/** URL segment of every language version: its own one, else the post's shared slug. */
export function versionSlugs(
  sharedSlug: string,
  versions: PostVersion[],
): Partial<Record<Locale, string>> {
  const slugs: Partial<Record<Locale, string>> = {};
  for (const version of versions) slugs[version.locale] = version.slug ?? sharedSlug;
  return slugs;
}

export function toPublicPost(
  post: Post,
  author: User,
  view: PostLocaleView,
  categories: PublicCategory[] = [],
): PublicPost {
  const { translation } = view;
  return {
    id: post.id,
    locale: view.locale,
    locales: view.versions.map((version) => version.locale),
    title: translation.title,
    slug: post.slug,
    localizedSlug: translation.slug,
    slugs: versionSlugs(post.slug, view.versions),
    description: translation.description,
    htmlContent: translation.htmlContent,
    imageUrl: translation.imageUrl,
    coverAlt: translation.coverAlt,
    author: toPublicAuthor(author),
    categories,
    status: post.status,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    keywords: translation.keywords,
    ogImageUrl: translation.ogImageUrl,
    canonicalUrl: translation.canonicalUrl,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

/**
 * Ordered categories (main first) of each post, keyed by post id. Names are in `locale`, falling
 * back to English (then the slug) when a category has no name in that language yet.
 */
export async function loadPostCategories(
  manager: EntityManager,
  postIds: string[],
  locale: Locale,
): Promise<Map<string, PublicCategory[]>> {
  const byPost = new Map<string, PublicCategory[]>();
  if (postIds.length === 0) return byPost;
  const rows: { postId: string; id: string; slug: string; name: string }[] = await manager.query(
    `SELECT link."postId" AS "postId", category.id, category.slug,
            COALESCE(localized.name, fallback.name, category.slug) AS name
     FROM post_category_links link
     JOIN post_categories category ON category.id = link."categoryId"
     LEFT JOIN post_category_translations localized
       ON localized."categoryId" = category.id AND localized.locale = $2
     LEFT JOIN post_category_translations fallback
       ON fallback."categoryId" = category.id AND fallback.locale = $3
     WHERE link."postId" = ANY($1)
     ORDER BY link.position ASC`,
    [postIds, locale, DEFAULT_LOCALE],
  );
  for (const row of rows) {
    const list = byPost.get(row.postId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    byPost.set(row.postId, list);
  }
  return byPost;
}

/** Language versions of each post (sorted, English first) with their URL segments, by post id. */
export async function loadPostVersions(
  manager: EntityManager,
  postIds: string[],
): Promise<Map<string, PostVersion[]>> {
  const byPost = new Map<string, PostVersion[]>();
  if (postIds.length === 0) return byPost;
  const rows = await manager
    .getRepository(PostTranslation)
    .createQueryBuilder('translation')
    .select(['translation.postId', 'translation.locale', 'translation.slug'])
    .where('translation.postId IN (:...postIds)', { postIds })
    .orderBy('translation.locale', 'ASC')
    .getMany();
  for (const row of rows) {
    const list = byPost.get(row.postId) ?? [];
    list.push({ locale: row.locale, slug: row.slug });
    byPost.set(row.postId, list);
  }
  return byPost;
}

type PostWithTranslation = Post & { author: User; translation: PostTranslation };

// Website-facing, read-only: only `published` posts translated into the requested language are
// listed or readable, newest "date shown" first. Writing happens in the admin panel.
@Injectable()
export class PostService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private get posts(): Repository<Post> {
    return this.ds.getRepository(Post);
  }

  /** Published posts joined with their `locale` version; posts without one are left out. */
  private publishedIn(locale: Locale) {
    return this.posts
      .createQueryBuilder('post')
      .innerJoinAndMapOne('post.author', User, 'author', 'author.id = post.authorId')
      .innerJoinAndMapOne(
        'post.translation',
        PostTranslation,
        'translation',
        'translation.postId = post.id AND translation.locale = :locale',
        { locale },
      )
      .where("post.status = 'published'");
  }

  private async toPublicPosts(rows: PostWithTranslation[], locale: Locale): Promise<PublicPost[]> {
    const postIds = rows.map((post) => post.id);
    const [categories, versions] = await Promise.all([
      loadPostCategories(this.ds.manager, postIds, locale),
      loadPostVersions(this.ds.manager, postIds),
    ]);
    return rows.map((post) =>
      toPublicPost(
        post,
        post.author,
        {
          locale,
          versions: versions.get(post.id) ?? [{ locale, slug: post.translation.slug }],
          translation: post.translation,
        },
        categories.get(post.id) ?? [],
      ),
    );
  }

  async list(input: ListPostsInput): Promise<ListPostsResult> {
    const qb = this.publishedIn(input.locale)
      .orderBy('post.publishedAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .limit(input.limit + 1);

    if (input.category) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM post_category_links link
                 JOIN post_categories category ON category.id = link."categoryId"
                 WHERE link."postId" = post.id AND category.slug = :categorySlug)`,
        { categorySlug: input.category },
      );
    }

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);
      qb.andWhere('(post.publishedAt < :cAt OR (post.publishedAt = :cAt AND post.id < :cId))', {
        cAt: cursor.publishedAt,
        cId: cursor.id,
      });
    }

    const rows = (await qb.getMany()) as PostWithTranslation[];
    const hasMore = rows.length > input.limit;
    const slice = hasMore ? rows.slice(0, input.limit) : rows;
    const last = slice[slice.length - 1];

    return {
      items: await this.toPublicPosts(slice, input.locale),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  /** By the shared slug or this language's own one. */
  async getBySlug(slug: string, locale: Locale): Promise<PublicPost> {
    const post = (await this.publishedIn(locale)
      .andWhere('(post.slug = :slug OR translation.slug = :slug)', { slug })
      .getOne()) as PostWithTranslation | null;
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    const [view] = await this.toPublicPosts([post], locale);
    if (!view) throw new Error('A row always maps to one view');
    return view;
  }

  /**
   * Categories that have at least one published post in `locale`, alphabetically by their name
   * in that language (English name when not translated yet).
   */
  async listCategories(locale: Locale): Promise<PublicCategory[]> {
    return this.ds.query(
      `SELECT category.id, category.slug,
              COALESCE(localized.name, fallback.name, category.slug) AS name
       FROM post_categories category
       LEFT JOIN post_category_translations localized
         ON localized."categoryId" = category.id AND localized.locale = $1
       LEFT JOIN post_category_translations fallback
         ON fallback."categoryId" = category.id AND fallback.locale = $2
       WHERE EXISTS (
         SELECT 1 FROM post_category_links link
         JOIN posts post ON post.id = link."postId"
         JOIN post_translations translation
           ON translation."postId" = post.id AND translation.locale = $1
         WHERE link."categoryId" = category.id AND post.status = 'published'
       )
       ORDER BY name ASC`,
      [locale, DEFAULT_LOCALE],
    );
  }
}
