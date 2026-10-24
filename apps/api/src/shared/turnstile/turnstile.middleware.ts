import type { Request, Response, NextFunction } from 'express';
import { config } from '../app.config';
import { HttpError } from '../http-error';
import { logger } from '../logger';
import { TURNSTILE_TOKEN_FIELD } from './constants';
import { TurnstileUnavailableError, verifyTurnstileToken } from './turnstile.service';

/**
 * Express middleware that verifies a Cloudflare Turnstile token before the
 * protected handler runs. Reads the token from `req.body[cf-turnstile-response]`
 * (populated by both `express.json` and `multer`), so it must be mounted after
 * body parsing and before the zod `validate` middleware (which strips the key).
 *
 * Skips verification entirely when no secret is configured — only possible in
 * development/test, since the env config requires the secret in production.
 */
export async function requireTurnstile(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const secret = config.turnstile.secretKey;
  if (!secret) {
    if (!config.isDev && config.nodeEnv !== 'test') {
      // Should be unreachable: production boot fails without the secret.
      logger.error('Turnstile secret missing outside development; failing closed');
      next(new HttpError(500, 'TURNSTILE_MISCONFIGURED', 'Turnstile is not configured'));
      return;
    }
    next();
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = body[TURNSTILE_TOKEN_FIELD];

  if (typeof token !== 'string' || token.length === 0) {
    next(new HttpError(400, 'TURNSTILE_REQUIRED', 'Captcha verification is required'));
    return;
  }

  // Bypass for testing protected endpoints without a real widget (e.g. Swagger
  // /docs). Skips Cloudflare entirely when the token matches the configured
  // secret. Compared before siteverify so it costs no network round-trip.
  const bypassToken = config.turnstile.bypassToken;
  if (bypassToken && token === bypassToken) {
    logger.warn({ ip: req.ip }, 'Turnstile verification bypassed via configured bypass token');
    delete body[TURNSTILE_TOKEN_FIELD];
    next();
    return;
  }

  try {
    const result = await verifyTurnstileToken(secret, token, req.ip);
    if (!result.success) {
      next(new HttpError(403, 'TURNSTILE_FAILED', 'Captcha verification failed'));
      return;
    }
  } catch (err) {
    if (err instanceof TurnstileUnavailableError) {
      next(new HttpError(502, 'TURNSTILE_UNAVAILABLE', 'Captcha verification is unavailable'));
      return;
    }
    next(err);
    return;
  }

  // Consume the token so it never reaches handlers, logs, or zod (which would
  // strip it anyway). The body is replaced by `validate` downstream regardless.
  delete body[TURNSTILE_TOKEN_FIELD];
  next();
}
