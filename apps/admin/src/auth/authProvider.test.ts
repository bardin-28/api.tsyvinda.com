import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Role, type User } from '@tsyvinda/shared-types';
import { authProvider } from './authProvider';
import { ApiError, apiClient } from '../services/apiClient';
import { getUser, setUser } from './sessionStore';

const admin: User = {
  id: 'u1',
  firstName: 'Ada',
  lastName: 'Admin',
  email: 'ada@example.com',
  role: Role.ADMIN,
  profileImageUrl: null,
  emailVerified: true,
  approvedByAdmin: true,
  createdAt: '2020-01-01T00:00:00.000Z',
};

const apiError = (status: number, message: string) =>
  new ApiError('fail', status, { error: { code: 'X', message } });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('authProvider', () => {
  it('login posts the credentials and caches the returned user', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { user: admin } });

    await authProvider.login({ username: 'ada@example.com', password: 'secret' });

    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'ada@example.com',
      password: 'secret',
    });
    expect(getUser()).toEqual(admin);
  });

  it('login surfaces the API message', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(401, 'Invalid email or password'));

    await expect(authProvider.login({ username: 'x@example.com', password: 'y' })).rejects.toThrow(
      'Invalid email or password',
    );
    expect(getUser()).toBeNull();
  });

  it('logout clears the cached user even when the call fails', async () => {
    setUser(admin);
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('offline'));

    await authProvider.logout({});

    expect(getUser()).toBeNull();
  });

  it('checkAuth rejects without a cached user and resolves with one', async () => {
    await expect(authProvider.checkAuth({})).rejects.toThrow();
    setUser(admin);
    await expect(authProvider.checkAuth({})).resolves.toBeUndefined();
  });

  it('checkError logs out on 401 only', async () => {
    setUser(admin);
    await expect(authProvider.checkError(apiError(403, 'no'))).resolves.toBeUndefined();
    expect(getUser()).toEqual(admin);
    await expect(authProvider.checkError(apiError(401, 'no'))).rejects.toThrow();
    expect(getUser()).toBeNull();
  });

  it('getIdentity falls back to /auth/me when nothing is cached', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: admin });

    const identity = await authProvider.getIdentity!();

    expect(get).toHaveBeenCalledWith('/auth/me');
    expect(identity).toMatchObject({ id: 'u1', fullName: 'Ada Admin', role: Role.ADMIN });
    expect(getUser()).toEqual(admin);
  });

  it('getPermissions returns the cached role', async () => {
    setUser(admin);
    await expect(authProvider.getPermissions!({})).resolves.toBe(Role.ADMIN);
  });
});
