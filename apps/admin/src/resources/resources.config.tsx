import { lazy, type ComponentType } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  AltRoute,
  Article,
  Feed,
  PermMedia,
  Category,
  Description,
  ManageAccounts,
  People,
  Settings,
  Tune,
  Wallpaper,
} from '@mui/icons-material';
import { Role } from '@tsyvinda/shared-types';
import { COVER_POST_ID_PARAM } from '../pages/CoverGenerator/coverConfig';

// Resource views load on first visit: the post editor (TipTap) alone would double the main chunk.
// RA's Layout wraps pages in Suspense.
const PostList = lazy(() => import('./posts/PostList').then((m) => ({ default: m.PostList })));
const PostCreate = lazy(() =>
  import('./posts/PostCreate').then((m) => ({ default: m.PostCreate })),
);
const PostEdit = lazy(() => import('./posts/PostEdit').then((m) => ({ default: m.PostEdit })));
const CategoryList = lazy(() =>
  import('./categories/CategoryList').then((m) => ({ default: m.CategoryList })),
);
const CategoryEdit = lazy(() =>
  import('./categories/CategoryForm').then((m) => ({ default: m.CategoryEdit })),
);
const CategoryCreate = lazy(() =>
  import('./categories/CategoryForm').then((m) => ({ default: m.CategoryCreate })),
);
const PageList = lazy(() => import('./pages/PageList').then((m) => ({ default: m.PageList })));
const PageEdit = lazy(() => import('./pages/PageEdit').then((m) => ({ default: m.PageEdit })));
const MediaList = lazy(() => import('./media/MediaList').then((m) => ({ default: m.MediaList })));
const RedirectList = lazy(() =>
  import('./redirects/RedirectList').then((m) => ({ default: m.RedirectList })),
);
const RedirectCreate = lazy(() =>
  import('./redirects/RedirectForm').then((m) => ({ default: m.RedirectCreate })),
);
const RedirectEdit = lazy(() =>
  import('./redirects/RedirectForm').then((m) => ({ default: m.RedirectEdit })),
);
const UserList = lazy(() => import('./users/UserList').then((m) => ({ default: m.UserList })));
const UserEdit = lazy(() => import('./users/UserEdit').then((m) => ({ default: m.UserEdit })));
const GeneralSettingsPage = lazy(() =>
  import('../pages/Settings/GeneralSettingsPage').then((m) => ({
    default: m.GeneralSettingsPage,
  })),
);
// three.js lives only in this chunk.
const CoverGeneratorPage = lazy(() =>
  import('../pages/CoverGenerator/CoverGeneratorPage').then((m) => ({
    default: m.CoverGeneratorPage,
  })),
);

export type AdminMenuGroupId = 'blog' | 'users' | 'settings';

export interface AdminMenuGroupConfig {
  id: AdminMenuGroupId;
  label: string;
  icon: SvgIconComponent;
  /** Listed in the sidebar's bottom section, after a divider, below all other items */
  pinBottom?: boolean;
}

/** Collapsible sidebar sections; a resource joins one through its `group`. */
export const ADMIN_MENU_GROUPS: AdminMenuGroupConfig[] = [
  { id: 'blog', label: 'Blog', icon: Article },
  { id: 'users', label: 'Users', icon: ManageAccounts },
  { id: 'settings', label: 'Settings', icon: Settings, pinBottom: true },
];

export interface AdminResourceConfig {
  /** API path segment and RA resource name, e.g. `users` → `/admin/users` */
  name: string;
  label?: string;
  icon: SvgIconComponent;
  /** Sidebar section the resource is listed under; omitted = top-level item */
  group?: AdminMenuGroupId;
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
    // Top-level under "Management", like Delta Lektorat's admin
    name: 'pages',
    label: 'Pages',
    icon: Feed,
    roles: [Role.ADMIN],
    list: PageList,
    edit: PageEdit,
  },
  {
    // Like WordPress' Media: every uploaded image, reusable from any image field
    name: 'media',
    label: 'Media',
    icon: PermMedia,
    roles: [Role.ADMIN],
    list: MediaList,
  },
  {
    name: 'redirects',
    label: 'Redirects',
    icon: AltRoute,
    group: 'settings',
    roles: [Role.ADMIN],
    list: RedirectList,
    create: RedirectCreate,
    edit: RedirectEdit,
  },
  {
    name: 'posts',
    label: 'Articles',
    icon: Description,
    group: 'blog',
    roles: [Role.ADMIN],
    list: PostList,
    create: PostCreate,
    edit: PostEdit,
  },
  {
    name: 'categories',
    label: 'Categories',
    icon: Category,
    group: 'blog',
    roles: [Role.ADMIN],
    list: CategoryList,
    create: CategoryCreate,
    edit: CategoryEdit,
  },
  {
    name: 'users',
    label: 'All users',
    icon: People,
    group: 'users',
    roles: [Role.ADMIN],
    list: UserList,
    edit: UserEdit,
  },
];

export interface AdminCustomPageConfig {
  /** Absolute route path, e.g. `/blog/cover` */
  path: string;
  label: string;
  icon: SvgIconComponent;
  /** Roles that see the page in routing and the sidebar */
  roles: Role[];
  /** Sidebar section the page is listed under; omitted = top-level item */
  group?: AdminMenuGroupId;
  component: ComponentType;
}

/** Non-CRUD pages (tools): App registers them as CustomRoutes, the sidebar lists them. */
export const ADMIN_CUSTOM_PAGES: AdminCustomPageConfig[] = [
  {
    path: '/blog/cover',
    label: 'Cover generator',
    icon: Wallpaper,
    roles: [Role.ADMIN],
    group: 'blog',
    component: CoverGeneratorPage,
  },
  {
    path: '/settings/general',
    label: 'General',
    icon: Tune,
    roles: [Role.ADMIN],
    group: 'settings',
    component: GeneralSettingsPage,
  },
];

/** Route of the cover generator, optionally opened for one post. */
export const coverGeneratorPath = (postId?: string): string =>
  postId ? `/blog/cover?${COVER_POST_ID_PARAM}=${encodeURIComponent(postId)}` : '/blog/cover';
