import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import type { Request, Response } from 'express';

const unlinkMock = vi.fn().mockResolvedValue(undefined);
vi.mock('fs/promises', () => ({ unlink: (...args: unknown[]) => unlinkMock(...args) }));

import { CleanupUploadInterceptor } from './cleanup-upload.interceptor';

const next: CallHandler = { handle: () => of(null) };

function ctxFor(req: Partial<Request>, res: Response): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

function fakeRes(statusCode: number): Response {
  const res = new EventEmitter() as unknown as Response & EventEmitter;
  (res as { statusCode: number }).statusCode = statusCode;
  (res as { writableEnded: boolean }).writableEnded = true;
  return res;
}

describe('CleanupUploadInterceptor', () => {
  const interceptor = new CleanupUploadInterceptor();

  beforeEach(() => unlinkMock.mockClear());

  it('unlinks the uploaded file when the response is an error', async () => {
    const req = { file: { path: '/tmp/up.jpg' } } as unknown as Request;
    const res = fakeRes(400);
    interceptor.intercept(ctxFor(req, res), next);
    (res as unknown as EventEmitter).emit('finish');
    await Promise.resolve();
    expect(unlinkMock).toHaveBeenCalledWith('/tmp/up.jpg');
  });

  it('keeps the file when the response is successful', async () => {
    const req = { file: { path: '/tmp/up.jpg' } } as unknown as Request;
    const res = fakeRes(201);
    interceptor.intercept(ctxFor(req, res), next);
    (res as unknown as EventEmitter).emit('finish');
    await Promise.resolve();
    expect(unlinkMock).not.toHaveBeenCalled();
  });
});
