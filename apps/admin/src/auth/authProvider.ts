import type { AuthProvider, UserIdentity } from 'react-admin';
import type { AuthSession, LoginRequest, User } from '@tsyvinda/shared-types';
import {
  AUTH_LOGIN_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_ME_PATH,
  apiClient,
  extractErrorStatus,
  toHttpError,
} from '../services/apiClient';
import { clearSession, getUser, setUser } from './sessionStore';

const toIdentity = (user: User): UserIdentity => ({
  id: user.id,
  fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
  email: user.email,
  role: user.role,
  avatar: user.profileImageUrl ?? undefined,
});

async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>(AUTH_ME_PATH);
  setUser(data);
  return data;
}

// The admin login itself rejects non-admins with 401, so any successful login is an admin session.
export const authProvider: AuthProvider = {
  async login({ username, password }: { username: string; password: string }) {
    const body: LoginRequest = { email: username, password };
    try {
      const { data } = await apiClient.post<AuthSession>(AUTH_LOGIN_PATH, body);
      setUser(data.user);
    } catch (error) {
      throw new Error(toHttpError(error).message, { cause: error });
    }
  },

  // Local state is cleared even if the call fails, so the panel never looks signed in afterwards.
  async logout() {
    try {
      await apiClient.post(AUTH_LOGOUT_PATH);
    } catch {
      // Cookies expire on their own; the refresh token row lapses server-side
    } finally {
      clearSession();
    }
  },

  async checkAuth() {
    if (!getUser()) {
      throw new Error('Not authenticated');
    }
  },

  // A 401 here already failed apiClient's refresh-and-retry; 403 is a live
  // session hitting a forbidden action, so it must not log out.
  async checkError(error: unknown) {
    if (extractErrorStatus(error) === 401) {
      clearSession();
      throw new Error('Session expired');
    }
  },

  async getIdentity() {
    const user = getUser() ?? (await fetchMe());
    return toIdentity(user);
  },

  async getPermissions() {
    return getUser()?.role;
  },
};
