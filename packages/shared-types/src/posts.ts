export interface PostAuthor {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

/** Post as returned by the API (dates are ISO strings on the wire). */
export interface Post {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  htmlContent: string;
  imageUrl: string | null;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
}

/** Sortable columns of `GET /admin/posts`. */
export const ADMIN_POST_SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'slug'] as const;
export type AdminPostSortField = (typeof ADMIN_POST_SORT_FIELDS)[number];
