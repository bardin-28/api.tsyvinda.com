import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { HttpError } from '../../../shared/http-error';

export interface AuthUser {
  id: string;
}

// Injects the authenticated user attached by AuthGuard. Throws if used on a route
// that is not behind AuthGuard (defensive — the guard normally guarantees it).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
    }
    return req.user;
  },
);
