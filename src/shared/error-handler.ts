import type { ErrorRequestHandler } from 'express';
import { HttpError } from './http-error';

interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId =
    typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

  if (err instanceof HttpError) {
    const payload: ErrorPayload = {
      error: { code: err.code, message: err.message, details: err.details, requestId },
    };
    res.status(err.status).json(payload);
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('Unhandled error:', err);

  const payload: ErrorPayload = {
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      requestId,
    },
  };
  res.status(500).json(payload);
};
