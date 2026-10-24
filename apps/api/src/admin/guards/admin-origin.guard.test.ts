import { describe, it, expect, beforeEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AdminOriginGuard } from './admin-origin.guard';
import { config } from '../../shared/app.config';

function ctxFor(method: string, origin?: string): ExecutionContext {
  const req = { method, headers: origin ? { origin } : {} } as unknown as Request;
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('AdminOriginGuard', () => {
  const guard = new AdminOriginGuard();

  beforeEach(() => {
    config.admin.origin = 'https://admin.example.com';
  });

  it('lets safe methods through from any origin', () => {
    expect(guard.canActivate(ctxFor('GET', 'https://evil.example'))).toBe(true);
  });

  it('allows writes from the admin panel and the API host (Swagger)', () => {
    expect(guard.canActivate(ctxFor('POST', 'https://admin.example.com'))).toBe(true);
    expect(guard.canActivate(ctxFor('POST', `https://${config.backendHost}`))).toBe(true);
  });

  it('allows writes without an Origin header (non-browser clients)', () => {
    expect(guard.canActivate(ctxFor('DELETE'))).toBe(true);
  });

  it('rejects writes from any other origin with 403', () => {
    expect(() => guard.canActivate(ctxFor('POST', 'https://evil.example'))).toThrowError(
      expect.objectContaining({ status: 403, code: 'ORIGIN_NOT_ALLOWED' }) as unknown as Error,
    );
  });

  it('rejects the website origin when no admin host is configured', () => {
    config.admin.origin = undefined;
    expect(() => guard.canActivate(ctxFor('PATCH', 'https://tsyvinda.com'))).toThrow();
  });
});
