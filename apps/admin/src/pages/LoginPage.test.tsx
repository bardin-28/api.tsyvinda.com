import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, type AuthProvider, type DataProvider } from 'react-admin';
import { LoginPage } from './LoginPage';

const makeAuthProvider = (login: AuthProvider['login']): AuthProvider => ({
  login,
  logout: vi.fn().mockResolvedValue(undefined),
  checkAuth: vi.fn().mockRejectedValue(new Error('Not authenticated')),
  checkError: vi.fn().mockResolvedValue(undefined),
  getPermissions: vi.fn().mockResolvedValue(undefined),
});

const renderLogin = (authProvider: AuthProvider) =>
  render(
    <AdminContext authProvider={authProvider} dataProvider={{} as DataProvider}>
      <LoginPage />
    </AdminContext>,
  );

describe('LoginPage', () => {
  it('signs in with the trimmed email and password', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(makeAuthProvider(login));

    await userEvent.type(await screen.findByLabelText(/email/i), '  ada@example.com ');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'ada@example.com', password: 'secret123' }),
      ),
    );
  });

  it('shows the API error when sign-in fails', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    renderLogin(makeAuthProvider(login));

    await userEvent.type(await screen.findByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  it('toggles password visibility', async () => {
    renderLogin(makeAuthProvider(vi.fn()));
    const password = await screen.findByLabelText(/^password/i);
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
