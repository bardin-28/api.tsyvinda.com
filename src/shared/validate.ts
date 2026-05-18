import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { HttpError } from './http-error';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new HttpError(400, 'VALIDATION_FAILED', 'Request validation failed', err.flatten()));
        return;
      }
      next(err);
    }
  };
}

export type Infer<S extends ZodTypeAny> = z.infer<S>;
