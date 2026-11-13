import type { Locale } from './locales';

export interface PostAuthor {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

/** Blog category; a post lists them in order, the first is its main category. */
export interface PostCategory {
  id: string;
  name: string;
  /** URL/filter key, e.g. `frontend` → `/blog?category=frontend` */
  slug: string;
}

export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * Post as returned by the API (dates are ISO strings on the wire). Title, text, cover and SEO
 * fields are per language (`locale`); slug, author, categories and publishing are shared.
 */
export interface Post {
  id: string;
  /** Language of the translated fields below */
  locale: Locale;
  /** Languages this post is translated into */
  locales: Locale[];
  title: string;
  slug: string;
  description: string | null;
  htmlContent: string;
  imageUrl: string | null;
  /** Alt text of the cover image (also og:image:alt when the cover is the share image) */
  coverAlt: string | null;
  author: PostAuthor;
  categories: PostCategory[];
  status: PostStatus;
  /** "Date shown" on the website; set when first published, editable */
  publishedAt: string | null;
  /** Search/social overrides; null = derived (title, description, cover, own URL), per language */
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin view of a post: adds the ids the edit form binds to. */
export interface AdminPost extends Post {
  authorId: string;
  /** Ordered: the first is the main category */
  categoryIds: string[];
}

/** Sortable columns of `GET /admin/posts`. */
export const ADMIN_POST_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'publishedAt',
  'title',
  'slug',
  'status',
] as const;
export type AdminPostSortField = (typeof ADMIN_POST_SORT_FIELDS)[number];

/** Category row of the admin categories table. */
export interface AdminPostCategory extends PostCategory {
  /** Languages the name exists in */
  locales: Locale[];
  postCount: number;
  createdAt: string;
}

/** Sortable columns of `GET /admin/categories`. */
export const ADMIN_CATEGORY_SORT_FIELDS = ['name', 'slug', 'createdAt'] as const;
export type AdminCategorySortField = (typeof ADMIN_CATEGORY_SORT_FIELDS)[number];
