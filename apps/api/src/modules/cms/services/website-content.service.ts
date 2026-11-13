import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';
import {
  BLOCK_DEFINITIONS,
  isBlockType,
  type BlockDefinition,
  type Locale,
  type PageKey,
  type WebsiteBlock,
  type WebsitePage,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { Page } from '../entities/page.entity';
import { flattenFieldValues, type FlattenContext } from '../content/field-values';
import type { RouteIndex } from '../content/route-index';
import { RoutesService } from './routes.service';

const pageNotFound = () => new HttpError(404, 'PAGE_NOT_FOUND', 'Page not found');

/** Published page content in one language, as the website renders it. */
@Injectable()
export class WebsiteContentService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly routes: RoutesService,
  ) {}

  async getPage(key: PageKey, locale: Locale): Promise<WebsitePage> {
    const page = await this.ds
      .getRepository(Page)
      .findOne({ where: { key }, relations: { publishedRevision: true } });
    const revision = page?.publishedRevision;
    if (!page || page.status !== 'published' || !revision || !revision.locales.includes(locale)) {
      throw pageNotFound();
    }

    const index = await this.routes.loadIndex();
    const ctx = flattenContext(index, locale);
    const content = revision.content;

    const blocks: WebsiteBlock[] = [];
    for (const block of content.blocks) {
      // A type removed from the code since publishing is skipped, not an error
      if (!isBlockType(block.type)) continue;
      const def: BlockDefinition = BLOCK_DEFINITIONS[block.type];
      const data = flattenFieldValues(def.fields, block.data, ctx);
      blocks.push({ id: block.id, type: block.type, anchor: block.anchor, data });
    }

    const seo = content.seo;
    const title = content.title[locale];
    return {
      key,
      locale,
      locales: revision.locales,
      title,
      seo: {
        title: seo.title[locale] || title,
        socialTitle: seo.socialTitle[locale] || seo.title[locale] || title,
        description: seo.description[locale],
        keywords: seo.keywords[locale]
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        ogImageUrl: seo.ogImageUrl,
        noindex: seo.noindex,
      },
      blocks,
      paths: index.paths(key),
      publishedAt: (page.publishedAt ?? revision.createdAt).toISOString(),
    };
  }
}

export function flattenContext(index: RouteIndex, locale: Locale): FlattenContext {
  return {
    locale,
    pagePath: (key) => index.path(key, locale),
    publicPath: (key) => index.publicPath(key, locale),
  };
}
