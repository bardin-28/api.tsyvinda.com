import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';
import { POST_STATUSES, type PostStatus } from '@tsyvinda/shared-types';
import { User } from '../../users/entities/user.entity';

/** Shared part of a post; its text, cover and SEO live in PostTranslation, one per language. */
@Entity('posts')
@Index('posts_created_id_idx', ['createdAt', 'id'])
// Public blog: published posts, newest "date shown" first
@Index('posts_status_published_id_idx', ['status', 'publishedAt', 'id'])
export class Post {
  @PrimaryUuidV7Column()
  id: string;

  @Index('posts_slug_uniq', { unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug: string;

  @Column({ type: 'enum', enum: POST_STATUSES, enumName: 'post_status', default: 'draft' })
  status: PostStatus;

  /** "Date shown" on the website; set on first publish, editable by admins */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Index('posts_author_id_idx')
  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
