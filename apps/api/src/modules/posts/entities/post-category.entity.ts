import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';

/** Category key; its name is per language (PostCategoryTranslation). */
@Entity('post_categories')
export class PostCategory {
  @PrimaryUuidV7Column()
  id: string;

  @Index('post_categories_slug_uniq', { unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
