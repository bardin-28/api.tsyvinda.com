import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable secret so individual tests can toggle the skip path.
const configMock = {
  turnstile: {
    secretKey: 'secret-key' as string | undefined,
    bypassToken: undefined as string | undefined,
  },
  isDev: false,
  nodeEnv: 'test' as string,
};

vi.mock('../app.config', () => ({ config: configMock }));

const verifyMock = vi.fn();

class TurnstileUnavailableError extends Error {}

vi.mock('./turnstile.service', () => ({
  verifyTurnstileToken: (...args: unknown[]) => verifyMock(...args),
  TurnstileUnavailableError,
}));

import { TURNSTILE_TOKEN_FIELD } from './constants';
import { requireTurnstile } from './turnstile.middleware';

describe('requireTurnstile', () => {
  beforeEach(() => {
    verifyMock.mockReset();
    configMock.turnstile.secretKey = 'secret-key';
    configMock.turnstile.bypassToken = undefined;
    configMock.isDev = false;
    configMock.nodeEnv = 'test';
  });

  it('skips verification and consumes nothing when no secret is configured (dev/test)', async () => {
    configMock.turnstile.secretKey = undefined;
    const req = { body: {}, ip: '9.9.9.9' } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the token is missing', async () => {
    const req = { body: {}, ip: '9.9.9.9' } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 400, code: 'TURNSTILE_REQUIRED' });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects with 403 when verification fails', async () => {
    verifyMock.mockResolvedValue({ success: false, errorCodes: ['invalid-input-response'] });
    const req = {
      body: { [TURNSTILE_TOKEN_FIELD]: 'bad' },
      ip: '9.9.9.9',
    } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 403, code: 'TURNSTILE_FAILED' });
  });

  it('rejects with 502 when Cloudflare is unavailable', async () => {
    verifyMock.mockRejectedValue(new TurnstileUnavailableError('down'));
    const req = {
      body: { [TURNSTILE_TOKEN_FIELD]: 'tok' },
      ip: '9.9.9.9',
    } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 502, code: 'TURNSTILE_UNAVAILABLE' });
  });

  it('bypasses siteverify and strips the token when token matches the bypass token', async () => {
    configMock.turnstile.bypassToken = 'bypass-secret-token-1234';
    const body: Record<string, unknown> = {
      [TURNSTILE_TOKEN_FIELD]: 'bypass-secret-token-1234',
      email: 'a@b.com',
    };
    const req = { body, ip: '9.9.9.9' } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(body[TURNSTILE_TOKEN_FIELD]).toBeUndefined();
    expect(body.email).toBe('a@b.com');
  });

  it('still verifies when a bypass token is set but the value does not match', async () => {
    configMock.turnstile.bypassToken = 'bypass-secret-token-1234';
    verifyMock.mockResolvedValue({ success: true, errorCodes: [] });
    const req = {
      body: { [TURNSTILE_TOKEN_FIELD]: 'real-widget-token' },
      ip: '9.9.9.9',
    } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(verifyMock).toHaveBeenCalledWith('secret-key', 'real-widget-token', '9.9.9.9');
  });

  it('calls next() and strips the token from the body on success', async () => {
    verifyMock.mockResolvedValue({ success: true, errorCodes: [] });
    const body: Record<string, unknown> = { [TURNSTILE_TOKEN_FIELD]: 'good', email: 'a@b.com' };
    const req = { body, ip: '9.9.9.9' } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(verifyMock).toHaveBeenCalledWith('secret-key', 'good', '9.9.9.9');
    expect(body[TURNSTILE_TOKEN_FIELD]).toBeUndefined();
    expect(body.email).toBe('a@b.com');
  });

  it('fails closed with 500 when the secret is missing outside dev/test', async () => {
    configMock.turnstile.secretKey = undefined;
    configMock.isDev = false;
    configMock.nodeEnv = 'production';
    const req = { body: {}, ip: '9.9.9.9' } as unknown as Request;
    const next = vi.fn();

    await requireTurnstile(req, {} as Response, next as unknown as NextFunction);

    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 500, code: 'TURNSTILE_MISCONFIGURED' });
  });
});
