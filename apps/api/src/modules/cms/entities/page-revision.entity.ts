import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { LOCALES, type Locale, type PageContent } from '@tsyvinda/shared-types';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';
import { User } from '../../users/entities/user.entity';
import { Page } from './page.entity';

/** Snapshot of a page's draft taken on publish; the website renders the page's current one. */
@Entity('page_revisions')
@Index('page_revisions_page_version_uniq', ['pageId', 'version'], { unique: true })
export class PageRevision {
  @PrimaryUuidV7Column()
  id: string;

  @Column({ type: 'uuid' })
  pageId: string;

  @ManyToOne(() => Page, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: Page;

  /** Draft version this snapshot was taken from */
  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  content: PageContent;

  /** Languages published in this revision */
  @Column({ type: 'enum', enum: LOCALES, enumName: 'content_locale', array: true })
  locales: Locale[];

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
