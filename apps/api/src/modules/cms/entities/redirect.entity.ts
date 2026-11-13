import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import { REDIRECT_TYPES, type RedirectType } from '@tsyvinda/shared-types';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';

/** Redirect set up in the admin panel (Website → Redirects): public path → path or URL. */
@Entity('redirects')
@Index('redirects_target_idx', ['target'])
export class Redirect {
  @PrimaryUuidV7Column()
  id: string;

  /** Public path with its language prefix, e.g. "/uk/old-page" (normalised, no trailing slash) */
  @Index('redirects_source_uniq', { unique: true })
  @Column({ type: 'varchar', length: 500 })
  source: string;

  /** Public path ("/about") or absolute http(s) URL */
  @Column({ type: 'varchar', length: 1000 })
  target: string;

  @Column({ type: 'enum', enum: REDIRECT_TYPES, enumName: 'redirect_type', default: 'permanent' })
  type: RedirectType;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
