import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';
import { User } from '../../users/entities/user.entity';

/**
 * An image of the media library: every upload (post covers, share images, avatars, page photos)
 * is registered here so any image field can reuse it. The row goes away with its file once
 * nothing uses the image any more.
 */
@Entity('media')
@Index('media_created_at_idx', ['createdAt'])
export class Media {
  @PrimaryUuidV7Column()
  id: string;

  /** Public URL (S3_PUBLIC_URL + key) — what content stores */
  @Index('media_url_uniq', { unique: true })
  @Column({ type: 'varchar', length: 1024 })
  url: string;

  /** Original file name; null for images imported from existing content */
  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  /** Bytes; null when unknown */
  @Column({ type: 'int', nullable: true })
  size: number | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
