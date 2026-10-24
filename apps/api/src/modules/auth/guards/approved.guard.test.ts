import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Repository } from 'typeorm';
import { ApprovedGuard } from './approved.guard';
import type { User } from '../../users/entities/user.entity';

function ctxFor(req: Partial<Request>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function guardWith(findOne: ReturnType<typeof vi.fn>): ApprovedGuard {
  return new ApprovedGuard({ findOne } as unknown as Repository<User>);
}

describe('ApprovedGuard', () => {
  it('passes when the user is approved', async () => {
    const guard = guardWith(vi.fn().mockResolvedValue({ id: 'u1', approvedByAdmin: true }));
    const req = { user: { id: 'u1' } } as unknown as Request;
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
  });

  it('throws 403 NOT_APPROVED when not approved', async () => {
    const guard = guardWith(vi.fn().mockResolvedValue({ id: 'u1', approvedByAdmin: false }));
    const req = { user: { id: 'u1' } } as unknown as Request;
    await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({
      status: 403,
      code: 'NOT_APPROVED',
    });
  });

  it('throws 401 when the user row is gone', async () => {
    const guard = guardWith(vi.fn().mockResolvedValue(null));
    const req = { user: { id: 'u1' } } as unknown as Request;
    await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when req.user is absent', async () => {
    const guard = guardWith(vi.fn());
    const req = {} as unknown as Request;
    await expect(guard.canActivate(ctxFor(req))).rejects.toMatchObject({ status: 401 });
  });
});
