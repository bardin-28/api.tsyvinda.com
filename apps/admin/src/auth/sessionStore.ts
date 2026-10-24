import type { User } from '@tsyvinda/shared-types';

// Tokens live in httpOnly cookies the panel cannot read; this cached user is only a "signed in" hint.
const USER_KEY = 'tsyvinda.admin.user';

export function getUser(): User | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage blocked: the session still works, identity is re-fetched from /auth/me
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing persisted, nothing to clear
  }
}
