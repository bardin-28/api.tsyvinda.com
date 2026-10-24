import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { config } from '../app.config';
import { HttpError } from '../http-error';
import { logger } from '../logger';
import { TURNSTILE_TOKEN_FIELD } from './constants';
import { TurnstileUnavailableError, verifyTurnstileToken } from './turnstile.service';

/**
 * Verifies a Cloudflare Turnstile token before the handler runs. Reads the token
 * from `req.body[cf-turnstile-response]`, so on multipart routes this interceptor
 * MUST be placed AFTER `FileInterceptor` (multer populates the body in its own
 * interceptor phase). On JSON routes the body is already parsed.
 *
 * Skips verification when no secret is configured — only possible in dev/test,
 * since the env config requires the secret in production.
 */
@Injectable()
export class TurnstileInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    await this.verify(req);
    return next.handle();
  }

  private async verify(req: Request): Promise<void> {
    const secret = config.turnstile.secretKey;
    if (!secret) {
      if (!config.isDev && config.nodeEnv !== 'test') {
        // Should be unreachable: production boot fails without the secret.
        logger.error('Turnstile secret missing outside development; failing closed');
        throw new HttpError(500, 'TURNSTILE_MISCONFIGURED', 'Turnstile is not configured');
      }
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = body[TURNSTILE_TOKEN_FIELD];

    if (typeof token !== 'string' || token.length === 0) {
      throw new HttpError(400, 'TURNSTILE_REQUIRED', 'Captcha verification is required');
    }

    // Bypass for testing protected endpoints without a real widget (e.g. Swagger
    // /docs). Compared before siteverify so it costs no network round-trip.
    const bypassToken = config.turnstile.bypassToken;
    if (bypassToken && token === bypassToken) {
      logger.warn({ ip: req.ip }, 'Turnstile verification bypassed via configured bypass token');
      delete body[TURNSTILE_TOKEN_FIELD];
      return;
    }

    try {
      const result = await verifyTurnstileToken(secret, token, req.ip);
      if (!result.success) {
        throw new HttpError(403, 'TURNSTILE_FAILED', 'Captcha verification failed');
      }
    } catch (err) {
      if (err instanceof TurnstileUnavailableError) {
        throw new HttpError(502, 'TURNSTILE_UNAVAILABLE', 'Captcha verification is unavailable');
      }
      throw err;
    }

    // Consume the token so it never reaches handlers, logs, or the DTO.
    delete body[TURNSTILE_TOKEN_FIELD];
  }
}
