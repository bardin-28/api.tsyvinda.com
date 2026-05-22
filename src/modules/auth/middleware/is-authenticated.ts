import type { RequestHandler } from 'express';
import { HttpError } from '../../../shared/http-error';
import { readAccessCookie } from '../shared/auth.utils';
import { verifyAccessToken } from '../services/token.service';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string };
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readAccessCookie(req);
  if (!token) {
    next(new HttpError(401, 'UNAUTHENTICATED', 'Missing auth cookie'));
    return;
  }
  try {
    const { sub } = verifyAccessToken(token);
    req.user = { id: sub };
    next();
  } catch (err) {
    next(err);
  }
};
