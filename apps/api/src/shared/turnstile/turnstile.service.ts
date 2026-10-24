import { logger } from '../logger';
import { SITEVERIFY_TIMEOUT_MS, SITEVERIFY_URL } from './constants';

// Shape of Cloudflare's siteverify response (only the fields we use).
interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

// Distinguishes "Cloudflare said no" (verification failed) from "Cloudflare could
// not be reached / returned garbage" (service unavailable). The middleware maps
// these to different HTTP statuses (403 vs 502).
export class TurnstileUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TurnstileUnavailableError';
  }
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify API.
 *
 * @param secret    The Turnstile secret key.
 * @param token     The `cf-turnstile-response` value from the client.
 * @param remoteIp  Optional client IP, passed through to Cloudflare for scoring.
 * @throws {TurnstileUnavailableError} when Cloudflare is unreachable or returns a
 *         non-200 / unparseable response.
 */
export async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw new TurnstileUnavailableError('Turnstile siteverify request failed', err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new TurnstileUnavailableError(`Turnstile siteverify returned HTTP ${res.status}`);
  }

  let data: SiteverifyResponse;
  try {
    data = (await res.json()) as SiteverifyResponse;
  } catch (err) {
    throw new TurnstileUnavailableError('Turnstile siteverify returned invalid JSON', err);
  }

  const errorCodes = data['error-codes'] ?? [];
  if (!data.success) {
    logger.warn({ errorCodes }, 'Turnstile verification rejected token');
  }

  return { success: data.success === true, errorCodes };
}
