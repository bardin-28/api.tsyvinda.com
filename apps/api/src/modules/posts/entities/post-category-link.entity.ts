import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './post.entity';
import { PostCategory } from './post-category.entity';

/**
 * Post ⇄ category with an order: `position` 0 is the post's main category. Both sides cascade,
 * so deleting a post or a category removes its links.
 */
@Entity('post_category_links')
@Index('post_category_links_category_idx', ['categoryId'])
export class PostCategoryLink {
  @PrimaryColumn({ type: 'uuid' })
  postId: string;

  @PrimaryColumn({ type: 'uuid' })
  categoryId: string;

  @Column({ type: 'smallint' })
  position: number;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @ManyToOne(() => PostCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: PostCategory;
}
