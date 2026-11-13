import type { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';

/** HSTS lifetime: two years (the hstspreload.org minimum is one). */
export const HSTS_MAX_AGE_SECONDS = 63_072_000;

/**
 * Browser features this API never needs, all switched off (`()` = allowed for nobody).
 * Same list as the website and admin panel.
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'bluetooth=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'idle-detection=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

/**
 * The API only returns JSON, so its documents may load nothing, be framed by nobody and
 * submit nowhere. Helmet's other defaults stay on (nosniff, Referrer-Policy: no-referrer,
 * COOP/CORP same-origin, Origin-Agent-Cluster, X-DNS-Prefetch-Control, …).
 */
const apiHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  frameguard: { action: 'deny' },
  strictTransportSecurity: { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true },
});

/**
 * Swagger UI (/docs, /docs-admin) runs an inline init script and loads its own assets, so it
 * keeps Helmet without CSP/COEP. Everything else gets the strict API set.
 */
const docsHelmet = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true },
});

export function securityHeaders(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    const middleware = req.path.startsWith('/docs') ? docsHelmet : apiHelmet;
    middleware(req, res, next);
  };
}
