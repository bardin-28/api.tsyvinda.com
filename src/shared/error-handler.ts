import type { ErrorRequestHandler, Request } from 'express';
import { HttpError } from './http-error';

interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

function getRequestId(req: Request): string | undefined {
  const reqWithId = req as Request & { id?: string };
  if (typeof reqWithId.id === 'string' && reqWithId.id) return reqWithId.id;
  const header = req.headers['x-request-id'];
  return typeof header === 'string' && header ? header : undefined;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = getRequestId(req);
  const reqLogger = (req as Request & { log?: typeof console }).log;

  if (err instanceof HttpError) {
    const payload: ErrorPayload = {
      error: { code: err.code, message: err.message, details: err.details, requestId },
    };
    if (err.status >= 500) {
      (reqLogger ?? console).error({ err, requestId }, 'http error');
    }
    res.status(err.status).json(payload);
    return;
  }

  (reqLogger ?? console).error({ err, requestId }, 'unhandled error');

  const message = err instanceof Error ? err.message : 'Internal server error';
  const payload: ErrorPayload = {
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      requestId,
    },
  };
  res.status(500).json(payload);
};
