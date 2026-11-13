import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HSTS_MAX_AGE_SECONDS, PERMISSIONS_POLICY, securityHeaders } from './security-headers';

function buildApp() {
  const app = express();
  app.use(securityHeaders());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/docs', (_req, res) => {
    res.type('html').send('<html></html>');
  });
  return app;
}

describe('securityHeaders', () => {
  it('sends the strict JSON-API header set', async () => {
    const res = await request(buildApp()).get('/health');

    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'",
    );
    expect(res.headers['strict-transport-security']).toBe(
      `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    );
    expect(res.headers['permissions-policy']).toBe(PERMISSIONS_POLICY);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('keeps Swagger UI working: no CSP or COEP on /docs', async () => {
    const res = await request(buildApp()).get('/docs');

    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
    expect(res.headers['permissions-policy']).toBe(PERMISSIONS_POLICY);
    expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
  });
});
