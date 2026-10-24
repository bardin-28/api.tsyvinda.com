import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';
import { config } from './app.config';
import { HttpError } from './http-error';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// Maps a generic HTTP status to the string code the API used under Express, so
// Nest-thrown HttpExceptions keep the same `code` contract as before.
const STATUS_CODE: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
};

type RequestWithId = Request & { id?: string; log?: { error: (...args: unknown[]) => void } };

// Single global filter reproducing the old `error-handler.ts` + `not-found.ts`
// contract: every error becomes `{ error: { code, message, details?, requestId? } }`.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();
    const requestId = typeof req.id === 'string' ? req.id : undefined;
    const log = req.log ?? console;

    if (err instanceof HttpError) {
      if (err.status >= 500) log.error({ err, requestId }, 'http error');
      this.send(res, err.status, {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      });
      return;
    }

    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        this.send(res, HttpStatus.PAYLOAD_TOO_LARGE, {
          code: 'FILE_TOO_LARGE',
          message: 'Image exceeds 5MB limit',
          requestId,
        });
        return;
      }
      this.send(res, HttpStatus.BAD_REQUEST, {
        code: 'UPLOAD_ERROR',
        message: err.message,
        requestId,
      });
      return;
    }

    if (err instanceof HttpException) {
      const status = err.getStatus();
      const { code, message } = this.fromHttpException(err, req);
      if (status >= 500) log.error({ err, requestId }, 'http error');
      this.send(res, status, { code, message, requestId });
      return;
    }

    log.error({ err, requestId }, 'unhandled error');
    const message = err instanceof Error ? err.message : 'Internal server error';
    this.send(res, HttpStatus.INTERNAL_SERVER_ERROR, {
      code: 'INTERNAL_ERROR',
      message: config.isProd ? 'Internal server error' : message,
      requestId,
    });
  }

  private fromHttpException(err: HttpException, req: Request): { code: string; message: string } {
    const status = err.getStatus();

    // Preserve the old 404 body: `Route GET /x not found`.
    if (err instanceof NotFoundException) {
      return { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` };
    }

    const body = err.getResponse();
    if (body && typeof body === 'object') {
      const obj = body as { code?: string; message?: string | string[] };
      const message = Array.isArray(obj.message)
        ? obj.message.join(', ')
        : (obj.message ?? err.message);
      return { code: obj.code ?? STATUS_CODE[status] ?? 'HTTP_ERROR', message };
    }
    return {
      code: STATUS_CODE[status] ?? 'HTTP_ERROR',
      message: typeof body === 'string' ? body : err.message,
    };
  }

  private send(res: Response, status: number, error: ErrorBody['error']): void {
    res.status(status).json({ error });
  }
}
