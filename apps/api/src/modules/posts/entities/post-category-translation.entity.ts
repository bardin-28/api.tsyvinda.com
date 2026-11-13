import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { LOCALES, type Locale } from '@tsyvinda/shared-types';
import { PostCategory } from './post-category.entity';

/** Category name in one language; the website falls back to English when a name is missing. */
@Entity('post_category_translations')
export class PostCategoryTranslation {
  @PrimaryColumn({ type: 'uuid' })
  categoryId: string;

  @PrimaryColumn({ type: 'enum', enum: LOCALES, enumName: 'content_locale' })
  locale: Locale;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ManyToOne(() => PostCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: PostCategory;
}
