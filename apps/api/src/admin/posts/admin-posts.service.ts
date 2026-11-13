import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { In, type DataSource, type EntityManager, type Repository } from 'typeorm';
import {
  BLOG_PAGE_KEY,
  CACHE_TAGS,
  DEFAULT_LOCALE,
  type AdminPostSortField,
  type ListResponse,
  type Locale,
  type PostStatus,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../shared/http-error';
import { MediaService } from '../../modules/media/media.service';
import { RevalidationService } from '../../modules/cms/services/revalidation.service';
import { User } from '../../modules/users/entities/user.entity';
import { Post } from '../../modules/posts/entities/post.entity';
import { PostCategory } from '../../modules/posts/entities/post-category.entity';
import { PostCategoryLink } from '../../modules/posts/entities/post-category-link.entity';
import { PostTranslation } from '../../modules/posts/entities/post-translation.entity';
import {
  EMPTY_TRANSLATION,
  loadPostCategories,
  loadPostLocales,
  toPublicPost,
  type PostTranslationFields,
  type PublicCategory,
  type PublicPost,
} from '../../modules/posts/services/post.service';

/** Fields shared by every language of a post; undefined = leave as is. */
export interface AdminPostSharedInput {
  slug?: string;
  authorId?: string;
  categoryIds?: string[];
  status?: PostStatus;
  publishedAt?: Date | null;
}

/** Fields of one language version; undefined = leave as is, null = clear. */
export interface AdminPostTranslationInput {
  title?: string;
  description?: string | null;
  htmlContent?: string;
  imageUrl?: string | null;
  coverAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
}

export type AdminPostWriteInput = AdminPostSharedInput & AdminPostTranslationInput;

export type AdminCreatePostInput = AdminPostWriteInput & {
  title: string;
  slug: string;
  htmlContent: string;
};

const TRANSLATION_FIELDS = [
  'title',
  'description',
  'htmlContent',
  'imageUrl',
  'coverAlt',
  'seoTitle',
  'seoDescription',
  'ogImageUrl',
  'canonicalUrl',
] as const satisfies readonly (keyof AdminPostTranslationInput)[];

const SHARED_FIELDS = ['slug', 'authorId', 'status', 'publishedAt'] as const satisfies readonly (
  keyof AdminPostSharedInput | keyof Post
)[];

export interface AdminListPostsInput {
  page: number;
  perPage: number;
  sort: AdminPostSortField;
  order: SortOrder;
  q?: string;
  categoryId?: string;
  status?: PostStatus;
  /** Language the rows are shown in (falls back to English for untranslated posts) */
  locale: Locale;
}

export type AdminPostView = PublicPost & { authorId: string; categoryIds: string[] };

type PostRow = Post & {
  author: User;
  translation?: PostTranslation | null;
  fallback?: PostTranslation | null;
};

// Admin counterpart of PostService: offset paging for the panel's table, drafts included, and
// edits/deletes any post. Each request works on one language (`locale`, from X-Content-Locale):
// title, text, cover and SEO are read and written in that language, the rest is shared.
@Injectable()
export class AdminPostsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly media: MediaService,
    private readonly revalidation: RevalidationService,
  ) {}

  /** Website: the blog list and these posts' pages show the change on the next visit. */
  private revalidatePosts(slugs: string[]): void {
    this.revalidation.revalidate([
      CACHE_TAGS.posts,
      CACHE_TAGS.page(BLOG_PAGE_KEY),
      ...slugs.map((slug) => CACHE_TAGS.post(slug)),
    ]);
  }

  private get posts(): Repository<Post> {
    return this.ds.getRepository(Post);
  }

  private get translations(): Repository<PostTranslation> {
    return this.ds.getRepository(PostTranslation);
  }

  async list(input: AdminListPostsInput): Promise<ListResponse<AdminPostView>> {
    // Drafts have no publishedAt; keep them together at the end of a date sort.
    const nulls = input.order === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST';
    const qb = this.posts
      .createQueryBuilder('post')
      .innerJoinAndMapOne('post.author', User, 'author', 'author.id = post.authorId')
      .leftJoinAndMapOne(
        'post.translation',
        PostTranslation,
        'translation',
        'translation.postId = post.id AND translation.locale = :locale',
        { locale: input.locale },
      )
      .leftJoinAndMapOne(
        'post.fallback',
        PostTranslation,
        'fallback',
        'fallback.postId = post.id AND fallback.locale = :fallbackLocale',
        { fallbackLocale: DEFAULT_LOCALE },
      )
      .offset((input.page - 1) * input.perPage)
      .limit(input.perPage);

    if (input.sort === 'title') {
      qb.addSelect('COALESCE(translation.title, fallback.title)', 'sort_title').orderBy(
        'sort_title',
        input.order,
      );
    } else {
      qb.orderBy(
        `post.${input.sort}`,
        input.order,
        input.sort === 'publishedAt' ? nulls : undefined,
      );
    }
    qb.addOrderBy('post.id', input.order);

    if (input.q) {
      // Escape LIKE wildcards so a search for "100%" matches literally.
      const term = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        `(post.slug ILIKE :term OR EXISTS (SELECT 1 FROM post_translations searched
          WHERE searched."postId" = post.id AND searched.title ILIKE :term))`,
        { term },
      );
    }
    if (input.status) {
      qb.andWhere('post.status = :status', { status: input.status });
    }
    if (input.categoryId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM post_category_links link WHERE link."postId" = post.id AND link."categoryId" = :categoryId)',
        { categoryId: input.categoryId },
      );
    }

    const [rows, total] = (await qb.getManyAndCount()) as [PostRow[], number];
    // An untranslated post is listed with its English title so the row stays recognisable.
    return {
      items: await this.toViews(rows, input.locale, (row) => row.translation ?? row.fallback),
      total,
    };
  }

  /** The post in `locale`; translated fields are empty when that language does not exist yet. */
  async getById(id: string, locale: Locale): Promise<AdminPostView> {
    const post = (await this.posts
      .createQueryBuilder('post')
      .innerJoinAndMapOne('post.author', User, 'author', 'author.id = post.authorId')
      .leftJoinAndMapOne(
        'post.translation',
        PostTranslation,
        'translation',
        'translation.postId = post.id AND translation.locale = :locale',
        { locale },
      )
      .where('post.id = :id', { id })
      .getOne()) as PostRow | null;
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    const [view] = await this.toViews([post], locale, (row) => row.translation);
    if (!view) throw new Error('A row always maps to one view');
    return view;
  }

  async create(
    actorId: string,
    locale: Locale,
    input: AdminCreatePostInput,
  ): Promise<AdminPostView> {
    await this.assertSlugFree(input.slug);
    const authorId = input.authorId ?? actorId;
    await this.assertUserExists(authorId);

    const id = await this.ds.transaction(async (manager) => {
      const post = manager.getRepository(Post).create({
        slug: input.slug,
        authorId,
        status: input.status ?? 'draft',
        publishedAt: input.publishedAt ?? null,
      });
      applyPublishDate(post, input);
      const saved = await manager.getRepository(Post).save(post);
      await manager.getRepository(PostTranslation).insert({
        ...EMPTY_TRANSLATION,
        ...definedFields(input, TRANSLATION_FIELDS),
        postId: saved.id,
        locale,
      });
      if (input.categoryIds) await setCategories(manager, saved.id, input.categoryIds);
      return saved.id;
    });
    this.revalidatePosts([input.slug]);
    return this.getById(id, locale);
  }

  async update(id: string, locale: Locale, patch: AdminPostWriteInput): Promise<AdminPostView> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    const previousSlug = post.slug;
    if (patch.slug !== undefined && patch.slug !== post.slug) {
      await this.assertSlugFree(patch.slug, post.id);
    }
    if (patch.authorId !== undefined && patch.authorId !== post.authorId) {
      await this.assertUserExists(patch.authorId);
    }

    const translationPatch = definedFields(patch, TRANSLATION_FIELDS);
    const existing = await this.translations.findOne({ where: { postId: id, locale } });
    const previousImages = { imageUrl: existing?.imageUrl, ogImageUrl: existing?.ogImageUrl };
    let translation: PostTranslation | null = existing;
    if (Object.keys(translationPatch).length > 0) {
      translation =
        existing ?? this.translations.create({ ...EMPTY_TRANSLATION, postId: id, locale });
      Object.assign(translation, translationPatch);
      if (!translation.title || !translation.htmlContent) {
        throw new HttpError(
          400,
          'TRANSLATION_INCOMPLETE',
          'A language version needs at least a title and content',
        );
      }
    }

    Object.assign(post, definedFields(patch, SHARED_FIELDS));
    applyPublishDate(post, patch);

    await this.ds.transaction(async (manager) => {
      await manager.getRepository(Post).save(post);
      if (translation && translation !== existing) {
        await manager.getRepository(PostTranslation).insert(translation);
      } else if (translation) {
        await manager.getRepository(PostTranslation).save(translation);
      }
      if (patch.categoryIds) await setCategories(manager, post.id, patch.categoryIds);
    });

    const replaced = [
      patch.imageUrl !== undefined && previousImages.imageUrl !== patch.imageUrl
        ? previousImages.imageUrl
        : null,
      patch.ogImageUrl !== undefined && previousImages.ogImageUrl !== patch.ogImageUrl
        ? previousImages.ogImageUrl
        : null,
    ];
    await this.deleteUnusedImages(replaced);
    this.revalidatePosts([previousSlug, post.slug]);
    return this.getById(post.id, locale);
  }

  /** Deletes one language version; the last one cannot go (delete the post instead). */
  async removeTranslation(id: string, locale: Locale): Promise<void> {
    const versions = await this.translations.find({ where: { postId: id } });
    if (versions.length === 0) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    const target = versions.find((version) => version.locale === locale);
    if (!target) {
      throw new HttpError(404, 'TRANSLATION_NOT_FOUND', 'This language version does not exist');
    }
    if (versions.length === 1) {
      throw new HttpError(409, 'LAST_TRANSLATION', 'A post needs at least one language version');
    }
    await this.translations.delete({ postId: id, locale });
    await this.deleteUnusedImages([target.imageUrl, target.ogImageUrl]);
    const post = await this.posts.findOne({ where: { id } });
    this.revalidatePosts(post ? [post.slug] : []);
  }

  async remove(id: string): Promise<void> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found');
    }
    const versions = await this.translations.find({ where: { postId: id } });
    const slug = post.slug;
    await this.posts.remove(post);
    this.revalidatePosts([slug]);
    await this.deleteUnusedImages(
      versions.flatMap((version) => [version.imageUrl, version.ogImageUrl]),
    );
  }

  private async toViews(
    rows: PostRow[],
    locale: Locale,
    pick: (row: PostRow) => PostTranslationFields | null | undefined,
  ): Promise<AdminPostView[]> {
    const postIds = rows.map((post) => post.id);
    const [categories, locales] = await Promise.all([
      loadPostCategories(this.ds.manager, postIds, locale),
      loadPostLocales(this.ds.manager, postIds),
    ]);
    return rows.map((post) =>
      toAdminPost(
        post,
        post.author,
        {
          locale,
          locales: locales.get(post.id) ?? [],
          translation: pick(post) ?? EMPTY_TRANSLATION,
        },
        categories.get(post.id) ?? [],
      ),
    );
  }

  /** Removes images nothing uses any more (other posts, avatars and pages included). */
  private async deleteUnusedImages(urls: (string | null | undefined)[]): Promise<void> {
    await this.media.deleteIfUnused(urls);
  }

  private async assertSlugFree(slug: string, ownId?: string): Promise<void> {
    const taken = await this.posts.findOne({ where: { slug } });
    if (taken && taken.id !== ownId) {
      throw new HttpError(409, 'SLUG_TAKEN', 'Slug already in use');
    }
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.ds.getRepository(User).exists({ where: { id: userId } });
    if (!exists) {
      throw new HttpError(400, 'AUTHOR_NOT_FOUND', 'Author does not exist');
    }
  }
}

/** The listed fields of `input` that were sent (not undefined). */
function definedFields<Input extends object, Field extends keyof Input>(
  input: Input,
  fields: readonly Field[],
): Partial<Pick<Input, Field>> {
  const picked: Partial<Pick<Input, Field>> = {};
  for (const field of fields) {
    if (input[field] !== undefined) picked[field] = input[field];
  }
  return picked;
}

/** Publishing without a "date shown" stamps it now; unpublishing keeps the date. */
function applyPublishDate(post: Post, input: Pick<AdminPostWriteInput, 'publishedAt'>): void {
  if (post.status === 'published' && !post.publishedAt && input.publishedAt === undefined) {
    post.publishedAt = new Date();
  }
}

/** Replaces a post's categories with `categoryIds`, keeping their order (first = main). */
async function setCategories(
  manager: EntityManager,
  postId: string,
  categoryIds: string[],
): Promise<void> {
  if (categoryIds.length > 0) {
    const found = await manager
      .getRepository(PostCategory)
      .count({ where: { id: In(categoryIds) } });
    if (found !== categoryIds.length) {
      throw new HttpError(400, 'CATEGORY_NOT_FOUND', 'One or more categories do not exist');
    }
  }
  const links = manager.getRepository(PostCategoryLink);
  await links.delete({ postId });
  if (categoryIds.length > 0) {
    await links.insert(
      categoryIds.map((categoryId, position) => ({ postId, categoryId, position })),
    );
  }
}

function toAdminPost(
  post: Post,
  author: User,
  view: Parameters<typeof toPublicPost>[2],
  categories: PublicCategory[],
): AdminPostView {
  return {
    ...toPublicPost(post, author, view, categories),
    authorId: post.authorId,
    categoryIds: categories.map((category) => category.id),
  };
}
