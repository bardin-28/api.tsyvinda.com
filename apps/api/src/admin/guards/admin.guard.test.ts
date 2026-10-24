import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Repository } from 'typeorm';
import { Role } from '@tsyvinda/shared-types';
import { AdminGuard } from './admin.guard';
import type { User } from '../../modules/users/entities/user.entity';
import { signAccessToken } from '../../modules/auth/services/token.service';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';

function ctxFor(req: Partial<Request>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function guardWith(findOne: ReturnType<typeof vi.fn>): AdminGuard {
  return new AdminGuard({ findOne } as unknown as Repository<User>);
}

const reqWith = (token?: string): Request =>
  ({ cookies: token ? { [ADMIN_ACCESS_COOKIE_NAME]: token } : {} }) as unknown as Request;

describe('AdminGuard', () => {
  it('attaches req.user for an admin token of a current admin', async () => {
    const guard = guardWith(vi.fn().mockResolvedValue({ id: 'u1', role: Role.ADMIN }));
    const req = reqWith(signAccessToken('u1', 'admin'));
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1' });
  });

  it('throws 401 when the admin cookie is missing', async () => {
    const guard = guardWith(vi.fn());
    await expect(guard.canActivate(ctxFor(reqWith()))).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('throws 401 for a website-surface token', async () => {
    const findOne = vi.fn();
    const guard = guardWith(findOne);
    await expect(guard.canActivate(ctxFor(reqWith(signAccessToken('u1'))))).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('throws 403 when the user is no longer an admin', async () => {
    const guard = guardWith(vi.fn().mockResolvedValue({ id: 'u1', role: Role.USER }));
    await expect(
      guard.canActivate(ctxFor(reqWith(signAccessToken('u1', 'admin')))),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('throws 401 when the user row is gone', async () => {
    const guard = guardWith(vi.fn().mockResolvedValue(null));
    await expect(
      guard.canActivate(ctxFor(reqWith(signAccessToken('u1', 'admin')))),
    ).rejects.toMatchObject({ status: 401 });
  });
});
