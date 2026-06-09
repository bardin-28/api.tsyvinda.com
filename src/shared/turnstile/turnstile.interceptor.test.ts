import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import type { Request } from 'express';

// Defined via vi.hoisted so the hoisted vi.mock factories can reference them.
const { configMock, verifyMock, TurnstileUnavailableError } = vi.hoisted(() => {
  class TurnstileUnavailableError extends Error {}
  return {
    configMock: {
      turnstile: {
        secretKey: 'secret-key' as string | undefined,
        bypassToken: undefined as string | undefined,
      },
      isDev: false,
      nodeEnv: 'test' as string,
    },
    verifyMock: vi.fn(),
    TurnstileUnavailableError,
  };
});

vi.mock('../app.config', () => ({ config: configMock }));
vi.mock('./turnstile.service', () => ({
  verifyTurnstileToken: (...args: unknown[]) => verifyMock(...args),
  TurnstileUnavailableError,
}));

import { TURNSTILE_TOKEN_FIELD } from './constants';
import { TurnstileInterceptor } from './turnstile.interceptor';

const next: CallHandler = { handle: () => of('ok') };

function ctxFor(req: Partial<Request>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('TurnstileInterceptor', () => {
  const interceptor = new TurnstileInterceptor();

  beforeEach(() => {
    verifyMock.mockReset();
    configMock.turnstile.secretKey = 'secret-key';
    configMock.turnstile.bypassToken = undefined;
    configMock.isDev = false;
    configMock.nodeEnv = 'test';
  });

  it('skips verification when no secret is configured (dev/test)', async () => {
    configMock.turnstile.secretKey = undefined;
    const req = { body: {}, ip: '9.9.9.9' } as unknown as Request;
    await expect(interceptor.intercept(ctxFor(req), next)).resolves.toBeDefined();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('requires a token when a secret is set', async () => {
    const req = { body: {}, ip: '1.1.1.1' } as unknown as Request;
    await expect(interceptor.intercept(ctxFor(req), next)).rejects.toMatchObject({
      status: 400,
      code: 'TURNSTILE_REQUIRED',
    });
  });

  it('verifies and consumes the token on success', async () => {
    verifyMock.mockResolvedValue({ success: true, errorCodes: [] });
    const body: Record<string, unknown> = { [TURNSTILE_TOKEN_FIELD]: 'tok' };
    const req = { body, ip: '1.1.1.1' } as unknown as Request;
    await interceptor.intercept(ctxFor(req), next);
    expect(verifyMock).toHaveBeenCalledWith('secret-key', 'tok', '1.1.1.1');
    expect(body[TURNSTILE_TOKEN_FIELD]).toBeUndefined();
  });

  it('rejects with 403 when Cloudflare denies the token', async () => {
    verifyMock.mockResolvedValue({ success: false, errorCodes: ['invalid'] });
    const req = { body: { [TURNSTILE_TOKEN_FIELD]: 'tok' }, ip: '1.1.1.1' } as unknown as Request;
    await expect(interceptor.intercept(ctxFor(req), next)).rejects.toMatchObject({
      status: 403,
      code: 'TURNSTILE_FAILED',
    });
  });

  it('maps unavailability to 502', async () => {
    verifyMock.mockRejectedValue(new TurnstileUnavailableError('down'));
    const req = { body: { [TURNSTILE_TOKEN_FIELD]: 'tok' }, ip: '1.1.1.1' } as unknown as Request;
    await expect(interceptor.intercept(ctxFor(req), next)).rejects.toMatchObject({
      status: 502,
      code: 'TURNSTILE_UNAVAILABLE',
    });
  });

  it('bypasses Cloudflare when the bypass token matches', async () => {
    configMock.turnstile.bypassToken = 'bypass-secret';
    const body: Record<string, unknown> = { [TURNSTILE_TOKEN_FIELD]: 'bypass-secret' };
    const req = { body, ip: '1.1.1.1' } as unknown as Request;
    await interceptor.intercept(ctxFor(req), next);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(body[TURNSTILE_TOKEN_FIELD]).toBeUndefined();
  });
});
