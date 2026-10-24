import { lazy, type ComponentType } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import { Article } from '@mui/icons-material';
import { Role } from '@tsyvinda/shared-types';

// Resource views load on first visit: the post editor (TipTap) alone would double the main chunk.
// RA's Layout wraps pages in Suspense.
const PostList = lazy(() => import('./posts/PostList').then((m) => ({ default: m.PostList })));
const PostCreate = lazy(() =>
  import('./posts/PostCreate').then((m) => ({ default: m.PostCreate })),
);
const PostEdit = lazy(() => import('./posts/PostEdit').then((m) => ({ default: m.PostEdit })));

export interface AdminResourceConfig {
  /** API path segment and RA resource name, e.g. `users` → `/admin/users` */
  name: string;
  label?: string;
  icon: SvgIconComponent;
  /** Roles that see the resource in routing and the sidebar */
  roles: Role[];
  list?: ComponentType;
  show?: ComponentType;
  edit?: ComponentType;
  create?: ComponentType;
}

/**
 * Single source of truth for CRUD resources: App routing, the sidebar and the dashboard read it.
 * Adding one = a folder under `src/resources/<name>/` + an entry here; the API follows the
 * dataProvider's REST contract.
 */
export const ADMIN_RESOURCES: AdminResourceConfig[] = [
  {
    name: 'posts',
    label: 'Posts',
    icon: Article,
    roles: [Role.ADMIN],
    list: PostList,
    create: PostCreate,
    edit: PostEdit,
  },
];
