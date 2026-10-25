import { describe, it, expect, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import {
  ADMIN_LOGIN_LOCK_MS,
  ADMIN_LOGIN_MAX_FAILURES,
  AdminLoginLockoutService,
} from './admin-login-lockout.service';

// Minimal in-memory stand-in for the ioredis calls the service makes.
function fakeRedis() {
  const store = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    get: async (k: string) => (store.has(k) ? String(store.get(k)) : null),
    incr: async (k: string) => {
      const n = (store.get(k) ?? 0) + 1;
      store.set(k, n);
      return n;
    },
    pexpire: async (k: string, ms: number) => {
      ttls.set(k, ms);
      return 1;
    },
    del: async (k: string) => {
      store.delete(k);
      return 1;
    },
  };
}

describe('AdminLoginLockoutService', () => {
  let redis: ReturnType<typeof fakeRedis>;
  let service: AdminLoginLockoutService;

  beforeEach(() => {
    redis = fakeRedis();
    service = new AdminLoginLockoutService(redis as unknown as Redis);
  });

  it('allows logins below the failure threshold', async () => {
    for (let i = 0; i < ADMIN_LOGIN_MAX_FAILURES - 1; i++) await service.recordFailure('a@x.com');
    await expect(service.assertNotLocked('a@x.com')).resolves.toBeUndefined();
  });

  it('locks the email with 429 LOGIN_LOCKED once the threshold is reached', async () => {
    for (let i = 0; i < ADMIN_LOGIN_MAX_FAILURES; i++) await service.recordFailure('a@x.com');
    await expect(service.assertNotLocked('a@x.com')).rejects.toMatchObject({
      status: 429,
      code: 'LOGIN_LOCKED',
    });
    // Other accounts are unaffected.
    await expect(service.assertNotLocked('b@x.com')).resolves.toBeUndefined();
  });

  it('starts the lock window on the first failure only', async () => {
    await service.recordFailure('a@x.com');
    await service.recordFailure('a@x.com');
    expect([...redis.ttls.values()]).toEqual([ADMIN_LOGIN_LOCK_MS]);
  });

  it('clears the counter on reset', async () => {
    for (let i = 0; i < ADMIN_LOGIN_MAX_FAILURES; i++) await service.recordFailure('a@x.com');
    await service.reset('a@x.com');
    await expect(service.assertNotLocked('a@x.com')).resolves.toBeUndefined();
  });

  it('does not put the raw email in the Redis key', async () => {
    await service.recordFailure('a@x.com');
    const [key] = [...redis.store.keys()];
    expect(key).toMatch(/^admin-login-fail:[0-9a-f]{64}$/);
  });
});
