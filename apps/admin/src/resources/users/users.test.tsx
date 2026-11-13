import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  AdminContext,
  ResourceContextProvider,
  TestMemoryRouter,
  type AuthProvider,
  type DataProvider,
} from 'react-admin';
import { Route, Routes } from 'react-router-dom';
import { Role, type AdminUser } from '@tsyvinda/shared-types';
import { UserList } from './UserList';
import { UserEdit, deleteBlockedReason } from './UserEdit';

const makeUser = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u2',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  role: Role.USER,
  profileImageUrl: null,
  emailVerified: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  postCount: 0,
  ...over,
});

const authProvider: AuthProvider = {
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: () => Promise.resolve(),
  checkError: () => Promise.resolve(),
  getPermissions: () => Promise.resolve(Role.ADMIN),
  getIdentity: () => Promise.resolve({ id: 'admin-1', fullName: 'Ada Admin' }),
};

describe('deleteBlockedReason', () => {
  it('allows deleting another user without posts', () => {
    expect(deleteBlockedReason(makeUser(), 'admin-1')).toBeNull();
  });

  it('blocks deleting yourself', () => {
    expect(deleteBlockedReason(makeUser({ id: 'admin-1' }), 'admin-1')).toMatch(/your own/);
  });

  it('blocks users with posts and says how many', () => {
    expect(deleteBlockedReason(makeUser({ postCount: 1 }), 'admin-1')).toMatch(/Has 1 post;/);
    expect(deleteBlockedReason(makeUser({ postCount: 3 }), 'admin-1')).toMatch(/Has 3 posts/);
  });
});

describe('UserList', () => {
  it('lists users newest first, 50 per page, with role and post count', async () => {
    const getList = vi.fn().mockResolvedValue({ data: [makeUser({ postCount: 4 })], total: 1 });
    render(
      <AdminContext dataProvider={{ getList } as unknown as DataProvider}>
        <ResourceContextProvider value="users">
          <UserList />
        </ResourceContextProvider>
      </AdminContext>,
    );

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    // Avatar and status columns were removed from the table
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(getList).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        sort: { field: 'createdAt', order: 'DESC' },
        pagination: { page: 1, perPage: 50 },
      }),
    );
  });
});

function renderEdit(user: AdminUser, update = vi.fn()) {
  const dataProvider = {
    getOne: vi.fn().mockResolvedValue({ data: user }),
    update,
  } as unknown as DataProvider;
  render(
    <TestMemoryRouter initialEntries={[`/users/${user.id}`]}>
      <AdminContext dataProvider={dataProvider} authProvider={authProvider}>
        <ResourceContextProvider value="users">
          <Routes>
            <Route path="/users/:id" element={<UserEdit />} />
          </Routes>
        </ResourceContextProvider>
      </AdminContext>
    </TestMemoryRouter>,
  );
  return { update };
}

describe('UserEdit', () => {
  it('locks the role and delete for your own account', async () => {
    renderEdit(makeUser({ id: 'admin-1', role: Role.ADMIN }));

    expect(await screen.findByText('You cannot change your own role')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /role/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled());
  });

  it('disables delete for a user with posts', async () => {
    renderEdit(makeUser({ postCount: 2 }));
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled());
  });
});
