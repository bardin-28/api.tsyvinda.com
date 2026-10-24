import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { config } from '../../shared/app.config';
import { HttpError } from '../../shared/http-error';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CSRF defence for cookie-authenticated admin writes: a browser always sends Origin on
// cross-site POSTs, so only the admin panel (or Swagger on the API host) may write.
// No Origin = not a browser, so there are no ambient cookies to abuse.
@Injectable()
export class AdminOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (!origin) return true;

    const trusted = [config.admin.origin, `https://${config.backendHost}`];
    if (!trusted.includes(origin)) {
      throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed for admin requests');
    }
    return true;
  }
}
