import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { In, type DataSource, type Repository } from 'typeorm';
import {
  DEFAULT_LOCALE,
  type AdminCategorySortField,
  type AdminPostCategory,
  type ListResponse,
  type Locale,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../shared/http-error';
import { PostCategory } from '../../modules/posts/entities/post-category.entity';
import { PostCategoryLink } from '../../modules/posts/entities/post-category-link.entity';
import { PostCategoryTranslation } from '../../modules/posts/entities/post-category-translation.entity';

export interface AdminListCategoriesInput {
  page: number;
  perPage: number;
  sort: AdminCategorySortField;
  order: SortOrder;
  q?: string;
  /** Language the names are shown in (English when not translated yet) */
  locale: Locale;
}

export interface AdminCategoryWriteInput {
  name?: string;
  slug?: string;
}

type CategoryRow = PostCategory & {
  translation?: PostCategoryTranslation | null;
  fallback?: PostCategoryTranslation | null;
};

// Blog categories for the admin panel. The slug is shared, the name is per language (the
// X-Content-Locale being edited). Deleting a category only unlinks it from its posts
// (post_category_links cascades); the posts themselves stay.
@Injectable()
export class AdminCategoriesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private get categories(): Repository<PostCategory> {
    return this.ds.getRepository(PostCategory);
  }

  private get names(): Repository<PostCategoryTranslation> {
    return this.ds.getRepository(PostCategoryTranslation);
  }

  private withNames(locale: Locale) {
    return this.categories
      .createQueryBuilder('category')
      .leftJoinAndMapOne(
        'category.translation',
        PostCategoryTranslation,
        'translation',
        'translation.categoryId = category.id AND translation.locale = :locale',
        { locale },
      )
      .leftJoinAndMapOne(
        'category.fallback',
        PostCategoryTranslation,
        'fallback',
        'fallback.categoryId = category.id AND fallback.locale = :fallbackLocale',
        { fallbackLocale: DEFAULT_LOCALE },
      );
  }

  async list(input: AdminListCategoriesInput): Promise<ListResponse<AdminPostCategory>> {
    const qb = this.withNames(input.locale)
      .offset((input.page - 1) * input.perPage)
      .limit(input.perPage);
    if (input.sort === 'name') {
      qb.addSelect('COALESCE(translation.name, fallback.name, category.slug)', 'sort_name').orderBy(
        'sort_name',
        input.order,
      );
    } else {
      qb.orderBy(`category.${input.sort}`, input.order);
    }
    qb.addOrderBy('category.id', input.order);
    if (input.q) {
      const term = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.where(
        `(category.slug ILIKE :term OR EXISTS (SELECT 1 FROM post_category_translations searched
          WHERE searched."categoryId" = category.id AND searched.name ILIKE :term))`,
        { term },
      );
    }
    const [rows, total] = (await qb.getManyAndCount()) as [CategoryRow[], number];
    return { items: await this.toViews(rows, true), total };
  }

  /** The category in `locale`; `name` is empty when it has no name in that language yet. */
  async getById(id: string, locale: Locale): Promise<AdminPostCategory> {
    const category = (await this.withNames(locale)
      .where('category.id = :id', { id })
      .getOne()) as CategoryRow | null;
    if (!category) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    const [view] = await this.toViews([category], false);
    if (!view) throw new Error('A row always maps to one view');
    return view;
  }

  async create(locale: Locale, input: { name: string; slug: string }): Promise<AdminPostCategory> {
    await this.assertSlugFree(input.slug);
    const id = await this.ds.transaction(async (manager) => {
      const saved = await manager
        .getRepository(PostCategory)
        .save(manager.getRepository(PostCategory).create({ slug: input.slug }));
      await manager
        .getRepository(PostCategoryTranslation)
        .insert({ categoryId: saved.id, locale, name: input.name });
      return saved.id;
    });
    return this.getById(id, locale);
  }

  async update(
    id: string,
    locale: Locale,
    patch: AdminCategoryWriteInput,
  ): Promise<AdminPostCategory> {
    const category = await this.findOrFail(id);
    if (patch.slug !== undefined && patch.slug !== category.slug) {
      await this.assertSlugFree(patch.slug, id);
      category.slug = patch.slug;
      await this.categories.save(category);
    }
    if (patch.name !== undefined) {
      await this.names.upsert({ categoryId: id, locale, name: patch.name }, [
        'categoryId',
        'locale',
      ]);
    }
    return this.getById(id, locale);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOrFail(id);
    await this.categories.remove(category);
  }

  private async toViews(rows: CategoryRow[], withFallback: boolean): Promise<AdminPostCategory[]> {
    const ids = rows.map((category) => category.id);
    const [counts, locales] = await Promise.all([this.postCounts(ids), this.nameLocales(ids)]);
    return rows.map((category) => {
      const name = category.translation?.name ?? (withFallback ? category.fallback?.name : '');
      return toAdminCategory(
        category,
        name ?? category.slug,
        locales.get(category.id) ?? [],
        counts.get(category.id) ?? 0,
      );
    });
  }

  private async findOrFail(id: string): Promise<PostCategory> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  }

  private async assertSlugFree(slug: string, ownId?: string): Promise<void> {
    const taken = await this.categories.findOne({ where: { slug } });
    if (taken && taken.id !== ownId) {
      throw new HttpError(409, 'SLUG_TAKEN', 'Slug already in use');
    }
  }

  /** Languages each category has a name in, keyed by category id. */
  private async nameLocales(categoryIds: string[]): Promise<Map<string, Locale[]>> {
    const byCategory = new Map<string, Locale[]>();
    if (categoryIds.length === 0) return byCategory;
    const rows = await this.names.find({
      select: { categoryId: true, locale: true },
      where: { categoryId: In(categoryIds) },
      order: { locale: 'ASC' },
    });
    for (const row of rows) {
      const list = byCategory.get(row.categoryId) ?? [];
      list.push(row.locale);
      byCategory.set(row.categoryId, list);
    }
    return byCategory;
  }

  private async postCounts(categoryIds: string[]): Promise<Map<string, number>> {
    if (categoryIds.length === 0) return new Map();
    const rows = await this.ds
      .getRepository(PostCategoryLink)
      .createQueryBuilder('link')
      .select('link.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .where('link.categoryId IN (:...categoryIds)', { categoryIds })
      .groupBy('link.categoryId')
      .getRawMany<{ categoryId: string; count: string }>();
    return new Map(rows.map((row) => [row.categoryId, Number(row.count)]));
  }
}

function toAdminCategory(
  category: PostCategory,
  name: string,
  locales: Locale[],
  postCount: number,
): AdminPostCategory {
  return {
    id: category.id,
    name,
    slug: category.slug,
    locales,
    postCount,
    createdAt: category.createdAt.toISOString(),
  };
}
