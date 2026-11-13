import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LOCALES, PAGE_DEFINITIONS, PAGE_KEYS, type PageKey } from '@tsyvinda/shared-types';
import { logger } from '../../../shared/logger';
import { Page } from '../entities/page.entity';
import { PageRevision } from '../entities/page-revision.entity';
import { PageSlug } from '../entities/page-slug.entity';
import { normalizePageContent } from '../content/page-content';
import { DEFAULT_PAGE_CONTENT } from './default-content';

/**
 * Creates every page (PAGE_DEFINITIONS) that has no row yet, published in all
 * languages with the website's original copy and default addresses. Runs on every boot and only
 * ever inserts: existing rows (and editors' changes) are never touched. Safe with several API
 * replicas booting at once (insert … on conflict do nothing).
 */
@Injectable()
export class CmsSeedService implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seed();
    } catch (error) {
      // A seed failure must not take the API down; the admin shows what exists
      logger.error({ err: error }, 'CMS seed failed');
    }
  }

  async seed(): Promise<{ pages: PageKey[] }> {
    const created = { pages: [] as PageKey[] };
    for (const key of PAGE_KEYS) {
      if (await this.seedPage(key)) created.pages.push(key);
    }
    if (created.pages.length > 0) logger.info(created, 'CMS seed created missing content');
    return created;
  }

  private async seedPage(key: PageKey): Promise<boolean> {
    const content = normalizePageContent(key, DEFAULT_PAGE_CONTENT[key]);
    return this.ds.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(Page)
        .values({
          key,
          draft: content,
          enabledLocales: [...LOCALES],
          version: 1,
        } as QueryDeepPartialEntity<Page>)
        .orIgnore()
        .returning(['id'])
        .execute();
      const pageId: string | undefined = inserted.raw?.[0]?.id;
      if (!pageId) return false;

      const definition = PAGE_DEFINITIONS[key];
      if (definition.routed) {
        const scope = (definition as { parent?: PageKey }).parent ?? '';
        for (const locale of LOCALES) {
          const slug = definition.defaultSlugs[locale];
          // An old address of another page with the same segment would block the insert
          const taken = await manager
            .getRepository(PageSlug)
            .findOne({ where: { scope, locale, slug } });
          if (taken) await manager.getRepository(PageSlug).delete({ id: taken.id });
          await manager
            .getRepository(PageSlug)
            .insert({ pageId, locale, slug, scope, current: true });
        }
      }

      const revision = await manager.getRepository(PageRevision).save(
        manager.getRepository(PageRevision).create({
          pageId,
          version: 1,
          content,
          locales: [...LOCALES],
        }),
      );
      await manager.getRepository(Page).update(
        { id: pageId },
        {
          status: 'published',
          publishedRevisionId: revision.id,
          publishedVersion: 1,
          publishedAt: new Date(),
        },
      );
      return true;
    });
  }
}
