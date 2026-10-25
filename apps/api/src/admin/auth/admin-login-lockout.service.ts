import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { HttpError } from '../../shared/http-error';

export const ADMIN_LOGIN_MAX_FAILURES = 10;
export const ADMIN_LOGIN_LOCK_MS = 15 * 60_000;

// Per-email lockout for the admin login, on top of the per-IP throttle: an attacker
// rotating IPs still gets only ADMIN_LOGIN_MAX_FAILURES guesses per account per window.
// Counts failures for any email (existing or not), so it doesn't reveal which accounts
// exist. Trade-off: someone can lock the real admin out for the window; accepted.
@Injectable()
export class AdminLoginLockoutService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async assertNotLocked(email: string): Promise<void> {
    const failures = Number(await this.redis.get(this.key(email)));
    if (failures >= ADMIN_LOGIN_MAX_FAILURES) {
      throw new HttpError(
        429,
        'LOGIN_LOCKED',
        'Too many failed sign-in attempts. Try again later.',
      );
    }
  }

  async recordFailure(email: string): Promise<void> {
    const key = this.key(email);
    // Fixed window from the first failure; later failures don't extend it.
    if ((await this.redis.incr(key)) === 1) {
      await this.redis.pexpire(key, ADMIN_LOGIN_LOCK_MS);
    }
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(this.key(email));
  }

  // Hashed so raw admin emails don't sit in Redis key names.
  private key(email: string): string {
    return `admin-login-fail:${createHash('sha256').update(email).digest('hex')}`;
  }
}
