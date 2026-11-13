import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager } from 'typeorm';
import {
  BLOG_PAGE_KEY,
  CACHE_TAGS,
  LOCALES,
  PAGE_DEFINITIONS,
  PAGE_KEYS,
  PAGE_SLUG_MAX,
  PAGE_SLUG_REGEX,
  RESERVED_SLUGS,
  isLocale,
  localizePath,
  type AdminEditor,
  type AdminPage,
  type AdminPageListItem,
  type Locale,
  type PageContent,
  type PageKey,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { S3Service } from '../../../shared/s3/s3.service';
import { extForMime } from '../../../shared/upload-options';
import { uuidv7 } from '../../../shared/uuid-v7';
import { User } from '../../users/entities/user.entity';
import { Page } from '../entities/page.entity';
import { PageRevision } from '../entities/page-revision.entity';
import { PageSlug } from '../entities/page-slug.entity';
import {
  missingRequired,
  normalizeEnabledLocales,
  normalizePageContent,
  pageImageUrls,
  translationProgress,
} from '../content/page-content';
import type { RouteIndex } from '../content/route-index';
import { RevalidationService } from './revalidation.service';
import { RoutesService } from './routes.service';

/** S3 folder of images uploaded from the page editor. */
export const PAGE_IMAGE_FOLDER = 'pages';

export const pageNotFound = () => new HttpError(404, 'PAGE_NOT_FOUND', 'Page not found');

export function versionConflict(currentVersion: number): HttpError {
  return new HttpError(
    409,
    'VERSION_CONFLICT',
    'Someone else saved this in the meantime. Reload to see their changes.',
    { currentVersion },
  );
}

export function toEditor(user: User | null | undefined): AdminEditor | null {
  return user ? { id: user.id, name: `${user.firstName} ${user.lastName}`.trim() } : null;
}

const pageOrder = (key: string) => PAGE_KEYS.indexOf(key as PageKey);

/** Every website page and every page tag: a URL or language change can affect links anywhere. */
function allPageTags(): string[] {
  return [CACHE_TAGS.routes, ...PAGE_KEYS.map((key) => CACHE_TAGS.page(key))];
}

/**
 * Admin side of CMS pages: content (with an optimistic version lock) that goes live on save as a
 * revision snapshot the website reads, and URL segments per language (old ones kept for redirects).
 */
@Injectable()
export class PagesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly routes: RoutesService,
    private readonly revalidation: RevalidationService,
    private readonly s3: S3Service,
  ) {}

  /** Stores an image picked in the page editor; the editor puts the URL into an image field. */
  async uploadImage(file: { buffer: Buffer; mimetype: string }): Promise<{ url: string }> {
    const key = `${PAGE_IMAGE_FOLDER}/${uuidv7()}.${extForMime(file.mimetype)}`;
    return { url: await this.s3.put(key, file.buffer, file.mimetype) };
  }

  async list(): Promise<AdminPageListItem[]> {
    const [pages, index] = await Promise.all([this.loadPages(), this.routes.loadIndex()]);
    return pages
      .sort((a, b) => pageOrder(a.key) - pageOrder(b.key))
      .map((page) => this.toListItem(page, index));
  }

  async get(key: PageKey): Promise<AdminPage> {
    const page = (await this.loadPages(key))[0];
    if (!page) throw pageNotFound();
    const [index, slugRows] = await Promise.all([
      this.routes.loadIndex(),
      this.ds
        .getRepository(PageSlug)
        .find({ where: { pageId: page.id }, order: { createdAt: 'DESC' } }),
    ]);
    const slugs: Partial<Record<Locale, string>> = {};
    for (const row of slugRows) if (row.current) slugs[row.locale] = row.slug;
    const draftPaths = index.paths(key, { draft: true });
    return {
      ...this.toListItem(page, index),
      version: page.version,
      draft: alignToSections(key, page.draft),
      slugs,
      oldSlugs: slugRows
        .filter((row) => !row.current)
        .map((row) => ({
          locale: row.locale,
          slug: row.slug,
          path: localizePath(oldPath(draftPaths[row.locale], row.slug), row.locale),
        })),
      parent: (PAGE_DEFINITIONS[key] as { parent?: PageKey }).parent ?? null,
    };
  }

  /**
   * Saves the content and puts it live at once (a new revision the website reads). Refused with
   * 400 while a required field is empty in an enabled language or a routed page has no address in
   * one; nothing is saved then.
   */
  async save(
    key: PageKey,
    input: { version: number; draft: unknown; enabledLocales: unknown },
    userId: string,
  ): Promise<AdminPage> {
    const draft = normalizePageContent(key, input.draft);
    const enabledLocales = normalizeEnabledLocales(input.enabledLocales);
    const missing = missingRequired(draft, enabledLocales);
    if (missing.length > 0) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Fill in the required fields', {
        fieldErrors: Object.fromEntries(missing.map((path) => [path, 'Required'])),
      });
    }

    let previousImages: string[] = [];
    await this.ds.transaction(async (manager) => {
      const page = await this.lockPage(manager, key, input.version);
      previousImages = pageImageUrls(page.draft);
      if (PAGE_DEFINITIONS[key].routed) {
        const slugs = await manager
          .getRepository(PageSlug)
          .find({ where: { pageId: page.id, current: true } });
        const withoutSlug = enabledLocales.filter(
          (locale) => !slugs.some((slug) => slug.locale === locale),
        );
        if (withoutSlug.length > 0) {
          throw new HttpError(400, 'SLUG_MISSING', 'Set the address in every enabled language', {
            fieldErrors: Object.fromEntries(
              withoutSlug.map((locale) => [`slugs.${locale}`, 'Required']),
            ),
          });
        }
      }

      const version = page.version + 1;
      const revision = await manager.getRepository(PageRevision).save(
        manager.getRepository(PageRevision).create({
          pageId: page.id,
          version,
          content: draft,
          locales: enabledLocales,
          createdById: userId,
        }),
      );
      Object.assign(page, {
        draft,
        enabledLocales,
        version,
        status: 'published',
        publishedRevisionId: revision.id,
        publishedVersion: version,
        publishedAt: new Date(),
        updatedById: userId,
      } satisfies Partial<Page>);
      await manager.getRepository(Page).save(page);
    });
    this.revalidation.revalidate([...allPageTags(), CACHE_TAGS.posts]);
    await this.deleteUnusedImages(previousImages, pageImageUrls(draft));
    return this.get(key);
  }

  /**
   * Removes images the page no longer shows from S3, once the save is committed. Only files the
   * page editor uploaded (`pages/…`); best-effort (S3Service logs failures). Pages have no
   * history view, so older revisions don't keep their images.
   */
  private async deleteUnusedImages(previous: string[], current: string[]): Promise<void> {
    const kept = new Set(current);
    const removed = [...new Set(previous)].filter(
      (url) => !kept.has(url) && this.s3.keyFromUrl(url)?.startsWith(`${PAGE_IMAGE_FOLDER}/`),
    );
    await Promise.all(removed.map((url) => this.s3.deleteByUrl(url)));
  }

  async updateSlugs(
    key: PageKey,
    input: { slugs: Record<string, unknown> },
    userId: string,
  ): Promise<AdminPage> {
    const definition = PAGE_DEFINITIONS[key];
    if (!definition.routed) {
      throw new HttpError(400, 'PAGE_NOT_ROUTED', 'This page has no editable address');
    }
    const parent = (definition as { parent?: PageKey }).parent;
    const scope = parent ?? '';
    const slugs = normalizeSlugs(input.slugs, !parent);

    await this.ds.transaction(async (manager) => {
      // Addresses are live at once and independent of the draft: no version check or bump, so
      // an editor can change them while the draft has unsaved edits
      const page = await this.lockPage(manager, key);
      const repo = manager.getRepository(PageSlug);
      for (const [locale, slug] of Object.entries(slugs) as [Locale, string][]) {
        const current = await repo.findOne({ where: { pageId: page.id, locale, current: true } });
        if (current?.slug === slug) continue;

        const taken = await repo.findOne({ where: { scope, locale, slug } });
        if (taken && taken.pageId !== page.id && taken.current) {
          throw new HttpError(409, 'SLUG_TAKEN', `"${slug}" is used by another page`, {
            fieldErrors: { [`slugs.${locale}`]: 'Used by another page' },
          });
        }
        // Another page's old address: the new owner takes it over (its redirect ends)
        if (taken && taken.pageId !== page.id) await repo.delete({ id: taken.id });

        if (current) await repo.update({ id: current.id }, { current: false });
        if (taken && taken.pageId === page.id) {
          await repo.update({ id: taken.id }, { current: true });
        } else {
          await repo.insert({ pageId: page.id, locale, slug, scope, current: true });
        }
      }
      await manager.getRepository(Page).update({ id: page.id }, { updatedById: userId });
    });

    this.revalidation.revalidate([
      ...allPageTags(),
      ...(key === BLOG_PAGE_KEY ? [CACHE_TAGS.posts] : []),
    ]);
    return this.get(key);
  }

  /** Row lock + version check: 404 for an unknown page, 409 when the version moved on. */
  private async lockPage(manager: EntityManager, key: PageKey, version?: number): Promise<Page> {
    const page = await manager
      .getRepository(Page)
      .findOne({ where: { key }, lock: { mode: 'pessimistic_write' } });
    if (!page) throw pageNotFound();
    if (version !== undefined && page.version !== version) throw versionConflict(page.version);
    return page;
  }

  private loadPages(key?: PageKey): Promise<Page[]> {
    return this.ds.getRepository(Page).find({
      where: key ? { key } : {},
      relations: { updatedBy: true },
    });
  }

  private toListItem(page: Page, index: RouteIndex): AdminPageListItem {
    const definition = PAGE_DEFINITIONS[page.key];
    return {
      id: page.key,
      key: page.key,
      label: definition.label,
      routed: definition.routed,
      enabledLocales: page.enabledLocales,
      translated: translationProgress(page.draft),
      paths: index.paths(page.key, { draft: true }),
      updatedAt: page.updatedAt.toISOString(),
      updatedBy: toEditor(page.updatedBy),
    };
  }
}

/**
 * Stored content in the page's current fixed sections (content saved before a section list
 * changed gets the new list, matched by position and type), so the editor's section indexes
 * always line up with the definition. Unreadable content is returned as stored.
 */
function alignToSections(key: PageKey, content: PageContent): PageContent {
  try {
    return normalizePageContent(key, content);
  } catch {
    return content;
  }
}

/** Old address of a page: its current path with the last segment swapped. */
function oldPath(currentPath: string | undefined, slug: string): string {
  if (!currentPath) return `/${slug}`;
  const parent = currentPath.slice(0, currentPath.lastIndexOf('/'));
  return `${parent}/${slug}`;
}

/** Validates the slugs sent per language (lowercased, trimmed); 400 with field errors. */
export function normalizeSlugs(
  raw: Record<string, unknown>,
  topLevel: boolean,
): Partial<Record<Locale, string>> {
  const errors: Record<string, string> = {};
  const slugs: Partial<Record<Locale, string>> = {};
  for (const [locale, value] of Object.entries(raw ?? {})) {
    if (!isLocale(locale)) {
      errors[`slugs.${locale}`] = `Unknown language (${LOCALES.join(', ')})`;
      continue;
    }
    if (value === undefined || value === null || value === '') continue;
    const slug = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!PAGE_SLUG_REGEX.test(slug) || slug.length > PAGE_SLUG_MAX) {
      errors[`slugs.${locale}`] =
        'Lowercase letters, digits and hyphens (no hyphen at the start or end)';
    } else if (topLevel && RESERVED_SLUGS.includes(slug)) {
      errors[`slugs.${locale}`] = `"${slug}" is reserved by the website`;
    } else {
      slugs[locale] = slug;
    }
  }
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid address', { fieldErrors: errors });
  }
  return slugs;
}
