import { Injectable } from '@nestjs/common';
import { config } from '../../../shared/app.config';
import { logger } from '../../../shared/logger';

const TIMEOUT_MS = 5_000;

/**
 * Tells the website which cached data changed (`POST {WEBSITE_REVALIDATE_URL} { tags }` with the
 * shared bearer secret), so the next visit renders the edit. Fire-and-forget: a failure is
 * logged and the website's own 60 s cache expiry takes over. No-op when unconfigured.
 */
@Injectable()
export class RevalidationService {
  /** Overridable in tests */
  options: { url?: string; secret?: string } = {
    url: config.website.revalidateUrl,
    secret: config.website.revalidateSecret,
  };

  revalidate(tags: Iterable<string>): void {
    const unique = [...new Set(tags)];
    if (unique.length === 0 || !this.options.url || !this.options.secret) return;
    void this.send(unique);
  }

  private async send(tags: string[]): Promise<void> {
    try {
      const response = await fetch(this.options.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.secret}`,
        },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn({ status: response.status, tags }, 'Website revalidation was refused');
      }
    } catch (error) {
      logger.warn({ err: error, tags }, 'Website revalidation failed');
    }
  }
}
