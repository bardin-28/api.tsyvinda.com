import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LOCALES, type Locale } from '@tsyvinda/shared-types';
import { Post } from './post.entity';

/**
 * One language version of a post: everything a reader sees in that language (title, text,
 * cover, SEO and share image). A post is shown in a language only when it has this row.
 */
@Entity('post_translations')
// A language's own URL segment is unique within that language
@Index('post_translations_locale_slug_uniq', ['locale', 'slug'], {
  unique: true,
  where: '"slug" IS NOT NULL',
})
export class PostTranslation {
  @PrimaryColumn({ type: 'uuid' })
  postId: string;

  @PrimaryColumn({ type: 'enum', enum: LOCALES, enumName: 'content_locale' })
  locale: Locale;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** This language's URL segment (e.g. transliterated title); null = the post's shared slug */
  @Column({ type: 'varchar', length: 200, nullable: true })
  slug: string | null;

  /** Search keywords of this language version */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  keywords: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'text' })
  htmlContent: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  coverAlt: string | null;

  // SEO overrides; null = derived from title / description / cover / the post's own URL
  @Column({ type: 'varchar', length: 200, nullable: true })
  seoTitle: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  seoDescription: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  ogImageUrl: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  canonicalUrl: string | null;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
