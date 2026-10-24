import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { HttpError } from '../../../shared/http-error';
import { readAccessCookie } from '../shared/auth.utils';
import { verifyAccessToken } from '../services/token.service';

// Global Express namespace: pnpm doesn't hoist express-serve-static-core, so it can't be augmented by name.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

// Replaces the old `requireAuth` middleware: reads the `access` cookie, verifies
// the JWT, and attaches `{ id }` to the request. Throws HttpError on failure,
// which the global filter formats.
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = readAccessCookie(req);
    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing auth cookie');
    }
    const { sub } = verifyAccessToken(token);
    req.user = { id: sub };
    return true;
  }
}
