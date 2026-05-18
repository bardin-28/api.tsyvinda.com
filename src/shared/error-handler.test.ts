import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from './error-handler';
import { HttpError } from './http-error';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps HttpError to its status and code', () => {
    const res = mockRes();
    const req = mockReq({ 'x-request-id': 'req-123' });
    const err = new HttpError(400, 'BAD_INPUT', 'nope', { field: 'x' });

    errorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: 'nope',
        details: { field: 'x' },
        requestId: 'req-123',
      },
    });
  });

  it('maps unknown errors to 500 INTERNAL_ERROR', () => {
    const res = mockRes();
    const req = mockReq();
    const err = new Error('boom');

    errorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const calls = (res.json as ReturnType<typeof vi.fn>).mock.calls;
    const payload = calls[0]?.[0];
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.requestId).toBeUndefined();
  });

  it('hides error message in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = mockRes();
      errorHandler(new Error('secret'), mockReq(), res, vi.fn() as NextFunction);
      const calls = (res.json as ReturnType<typeof vi.fn>).mock.calls;
    const payload = calls[0]?.[0];
      expect(payload.error.message).toBe('Internal server error');
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
