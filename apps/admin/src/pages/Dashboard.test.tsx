import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AdminContext, type AuthProvider } from 'react-admin';
import { QueryClient } from '@tanstack/react-query';
import type { DashboardStats } from '@tsyvinda/shared-types';
import { Dashboard } from './Dashboard';
import type { AdminDataProvider } from '../providers/dataProvider';

const stats: DashboardStats = {
  users: {
    total: 42,
    admins: 2,
    pendingApproval: 5,
    unverified: 7,
    newLast7Days: 3,
    newLast30Days: 11,
  },
  posts: { total: 20, newLast7Days: 1, newLast30Days: 4 },
  recentUsers: [
    {
      id: 'u1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      emailVerified: true,
      approvedByAdmin: false,
      createdAt: '2026-10-23T08:00:00.000Z',
    },
    {
      id: 'u2',
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@example.com',
      emailVerified: false,
      approvedByAdmin: false,
      createdAt: '2026-10-22T08:00:00.000Z',
    },
  ],
};

const authProvider: AuthProvider = {
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn().mockResolvedValue(undefined),
  checkError: vi.fn().mockResolvedValue(undefined),
  getPermissions: vi.fn().mockResolvedValue('ADMIN'),
  getIdentity: vi.fn().mockResolvedValue({ id: 'a1', fullName: 'Ada Admin' }),
};

const renderDashboard = (getDashboard: AdminDataProvider['getDashboard']) =>
  render(
    <AdminContext
      // No retries: the error case would otherwise wait out react-query's backoff
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      authProvider={authProvider}
      dataProvider={{ getDashboard } as unknown as AdminDataProvider}
    >
      <Dashboard />
    </AdminContext>,
  );

describe('Dashboard', () => {
  it('greets the admin and shows the KPIs', async () => {
    renderDashboard(vi.fn().mockResolvedValue(stats));

    expect(await screen.findByText('Welcome, Ada Admin')).toBeInTheDocument();
    const pending = (await screen.findByText('Pending approval', { selector: 'p' })).closest(
      '.MuiCard-root',
    ) as HTMLElement;
    expect(within(pending).getByText('5')).toBeInTheDocument();
    const users = screen
      .getByText('Users', { selector: 'p' })
      .closest('.MuiCard-root') as HTMLElement;
    expect(within(users).getByText('42')).toBeInTheDocument();
  });

  it('lists the latest signups with their status', async () => {
    renderDashboard(vi.fn().mockResolvedValue(stats));

    const table = await screen.findByRole('table', { name: /latest signups/i });
    const grace = within(table).getByText('grace@example.com').closest('tr') as HTMLElement;
    expect(within(grace).getByText('Pending approval')).toBeInTheDocument();
    const alan = within(table).getByText('alan@example.com').closest('tr') as HTMLElement;
    expect(within(alan).getByText('Unverified')).toBeInTheDocument();
  });

  it('shows an error when the stats cannot be loaded', async () => {
    renderDashboard(vi.fn().mockRejectedValue(new Error('Request failed')));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
  });
});
