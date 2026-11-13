import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { LOCALES, type Locale } from '@tsyvinda/shared-types';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';
import { Page } from './page.entity';

/**
 * URL segment of a routed page in one language. Changing a slug keeps the old row with
 * `current = false`, so its address redirects to the page's current one.
 */
@Entity('page_slugs')
// A segment belongs to one page per scope and language, old ones included
@Index('page_slugs_scope_locale_slug_uniq', ['scope', 'locale', 'slug'], { unique: true })
@Index('page_slugs_page_locale_idx', ['pageId', 'locale'])
// One current segment per page and language
@Index('page_slugs_current_uniq', ['pageId', 'locale'], { unique: true, where: '"current"' })
export class PageSlug {
  @PrimaryUuidV7Column()
  id: string;

  @Column({ type: 'uuid' })
  pageId: string;

  @ManyToOne(() => Page, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: Page;

  @Column({ type: 'enum', enum: LOCALES, enumName: 'content_locale' })
  locale: Locale;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  /** "" for top-level pages, the parent page's key for nested ones; old rows keep theirs */
  @Column({ type: 'varchar', length: 50, default: '' })
  scope: string;

  @Column({ type: 'boolean', default: true })
  current: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
