import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MulterError } from 'multer';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpError } from './http-error';

function capture() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json };
  const req = { id: 'req-1', method: 'GET', originalUrl: '/x', log: { error: vi.fn() } };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('formats an HttpError with its code/status and requestId', () => {
    const { host, status, json } = capture();
    filter.catch(new HttpError(409, 'EMAIL_TAKEN', 'Email already registered'), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'EMAIL_TAKEN',
        message: 'Email already registered',
        details: undefined,
        requestId: 'req-1',
      },
    });
  });

  it('maps a multer size error to 413 FILE_TOO_LARGE', () => {
    const { host, status, json } = capture();
    filter.catch(new MulterError('LIMIT_FILE_SIZE'), host);
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'FILE_TOO_LARGE', message: 'Image exceeds 5MB limit', requestId: 'req-1' },
    });
  });

  it('maps a Nest NotFoundException to NOT_FOUND with the route message', () => {
    const { host, status, json } = capture();
    filter.catch(new NotFoundException(), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Route GET /x not found', requestId: 'req-1' },
    });
  });

  it('maps an unknown error to 500 INTERNAL_ERROR', () => {
    const { host, status, json } = capture();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    const payload = json.mock.calls[0]?.[0] as { error: { code: string } };
    expect(payload.error.code).toBe('INTERNAL_ERROR');
  });
});
