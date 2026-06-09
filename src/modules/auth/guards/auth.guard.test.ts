import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { signAccessToken } from '../services/token.service';
import { ACCESS_COOKIE_NAME } from '../shared/auth.utils';
import { HttpError } from '../../../shared/http-error';

function ctxFor(req: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('attaches req.user for a valid access token', () => {
    const token = signAccessToken('user-1');
    const req = { cookies: { [ACCESS_COOKIE_NAME]: token } } as unknown as Request;
    expect(guard.canActivate(ctxFor(req))).toBe(true);
    expect(req.user).toEqual({ id: 'user-1' });
  });

  it('throws 401 when the access cookie is missing', () => {
    const req = { cookies: {} } as unknown as Request;
    expect(() => guard.canActivate(ctxFor(req))).toThrowError(
      expect.objectContaining({ status: 401, code: 'UNAUTHENTICATED' }) as unknown as Error,
    );
  });

  it('throws when the token is invalid', () => {
    const req = { cookies: { [ACCESS_COOKIE_NAME]: 'garbage' } } as unknown as Request;
    expect(() => guard.canActivate(ctxFor(req))).toThrow(HttpError);
  });
});
