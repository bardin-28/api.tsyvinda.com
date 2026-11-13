import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import {
  LOCALES,
  PAGE_STATUSES,
  type Locale,
  type PageContent,
  type PageKey,
  type PageStatus,
} from '@tsyvinda/shared-types';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';
import { User } from '../../users/entities/user.entity';
import { PageRevision } from './page-revision.entity';

/**
 * CMS page: one row per fixed page key (PAGE_DEFINITIONS). `draft` is what editors change (every
 * text as `{ en, uk }`); each save also snapshots it into `publishedRevision`, which the website
 * reads (pages are live on save).
 */
@Entity('pages')
@Index('pages_updated_at_idx', ['updatedAt'])
export class Page {
  @PrimaryUuidV7Column()
  id: string;

  @Index('pages_key_uniq', { unique: true })
  @Column({ type: 'varchar', length: 50 })
  key: PageKey;

  @Column({ type: 'jsonb' })
  draft: PageContent;

  /** Languages the page is edited and published in */
  @Column({
    type: 'enum',
    enum: LOCALES,
    enumName: 'content_locale',
    array: true,
    default: () => `'{en}'`,
  })
  enabledLocales: Locale[];

  @Column({ type: 'enum', enum: PAGE_STATUSES, enumName: 'page_status', default: 'draft' })
  status: PageStatus;

  /** Optimistic lock: every draft or slug change bumps it; writes send the version they read */
  @Column({ type: 'int', default: 1 })
  version: number;

  /** Draft version the published revision was made from */
  @Column({ type: 'int', nullable: true })
  publishedVersion: number | null;

  @Index('pages_published_revision_uniq', { unique: true })
  @Column({ type: 'uuid', nullable: true })
  publishedRevisionId: string | null;

  // Many-to-one + the unique index above: one revision is current for at most one page
  @ManyToOne(() => PageRevision, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'publishedRevisionId' })
  publishedRevision: PageRevision | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updatedById' })
  updatedBy: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
