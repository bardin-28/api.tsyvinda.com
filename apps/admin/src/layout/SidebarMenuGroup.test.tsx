import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, TestMemoryRouter, type AuthProvider } from 'react-admin';
import { Article } from '@mui/icons-material';
import { MenuList } from '@mui/material';
import { Role } from '@tsyvinda/shared-types';
import { SidebarMenuGroup } from './SidebarMenuGroup';
import { CustomSidebar, findActiveGroup } from './CustomSidebar';

const adminAuth: AuthProvider = {
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: () => Promise.resolve(),
  checkError: () => Promise.resolve(),
  getPermissions: () => Promise.resolve(Role.ADMIN),
};

describe('findActiveGroup', () => {
  const groups = [
    { id: 'blog' as const, paths: ['/posts', '/categories', '/blog/cover'] },
    { id: 'users' as const, paths: ['/users'] },
  ];

  it('finds the group of the current route, including nested routes', () => {
    expect(findActiveGroup(groups, '/posts/42')).toBe('blog');
    expect(findActiveGroup(groups, '/users')).toBe('users');
  });

  it('returns null outside every group and does not match route prefixes', () => {
    expect(findActiveGroup(groups, '/')).toBeNull();
    expect(findActiveGroup(groups, '/postscript')).toBeNull();
  });
});

describe('SidebarMenuGroup', () => {
  it('is controlled: shows items only when expanded and reports clicks', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <AdminContext>
        {/* RA's <Menu> is a MenuList in the app; MUI 9 MenuItem requires one */}
        <MenuList>
          <SidebarMenuGroup
            label="Blog"
            icon={Article}
            expanded={false}
            active={false}
            onToggle={onToggle}
          >
            <a href="/posts">Articles</a>
          </SidebarMenuGroup>
        </MenuList>
      </AdminContext>,
    );
    const header = screen.getByRole('menuitem', { name: /blog/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Articles')).not.toBeInTheDocument();

    await userEvent.click(header);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <AdminContext>
        <MenuList>
          <SidebarMenuGroup label="Blog" icon={Article} expanded active onToggle={onToggle}>
            <a href="/posts">Articles</a>
          </SidebarMenuGroup>
        </MenuList>
      </AdminContext>,
    );
    expect(screen.getByRole('menuitem', { name: /blog/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Articles')).toBeInTheDocument();
  });
});

const renderSidebar = (path: string) =>
  render(
    <TestMemoryRouter initialEntries={[path]}>
      <AdminContext authProvider={adminAuth}>
        <CustomSidebar />
      </AdminContext>
    </TestMemoryRouter>,
  );

const groupHeader = (name: RegExp) => screen.findByRole('menuitem', { name });

describe('CustomSidebar accordion', () => {
  it('opens the group of the current route', async () => {
    renderSidebar('/posts');
    expect(await groupHeader(/^blog/i)).toHaveAttribute('aria-expanded', 'true');
    expect(await groupHeader(/^users/i)).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps one group open: opening another closes the first', async () => {
    renderSidebar('/');
    const blog = await groupHeader(/^blog/i);
    const users = await groupHeader(/^users/i);

    await userEvent.click(blog);
    await waitFor(() => expect(blog).toHaveAttribute('aria-expanded', 'true'));

    await userEvent.click(users);
    await waitFor(() => expect(users).toHaveAttribute('aria-expanded', 'true'));
    expect(blog).toHaveAttribute('aria-expanded', 'false');

    // Clicking the open group closes it
    await userEvent.click(users);
    await waitFor(() => expect(users).toHaveAttribute('aria-expanded', 'false'));
  });
});
