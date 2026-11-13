import type { User } from './auth';

/** Sortable columns of `GET /admin/users`. */
export const ADMIN_USER_SORT_FIELDS = [
  'createdAt',
  'email',
  'firstName',
  'lastName',
  'role',
] as const;
export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];

/** Row of the admin users table: the public user plus how many posts they authored. */
export interface AdminUser extends User {
  /** Users with posts cannot be deleted (their posts would cascade away with them). */
  postCount: number;
}
