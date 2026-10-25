import { describe, it, expect } from 'vitest';
import { loadConfig } from './app.config';

const baseEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  EMAIL_FROM: 'Blog <noreply@example.com>',
  SMTP_HOST: 'email-smtp.eu-central-1.amazonaws.com',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-pass',
  S3_BUCKET: 'test-bucket',
  S3_PUBLIC_URL: 'http://localhost:4566/test-bucket',
} as NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('parses with defaults', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.isDev).toBe(true);
    expect(cfg.isProd).toBe(false);
    expect(cfg.redis.url).toBe('redis://localhost:6379');
    expect(cfg.auth.jwtAccessTtl).toBe('15m');
    expect(cfg.auth.refreshTtlDays).toBe(30);
    expect(cfg.auth.bcryptCost).toBe(12);
  });

  it('coerces PORT from string', () => {
    const cfg = loadConfig({ ...baseEnv, PORT: '4000' });
    expect(cfg.port).toBe(4000);
  });

  it('trusts one proxy hop by default and coerces TRUST_PROXY_HOPS', () => {
    expect(loadConfig(baseEnv).trustProxyHops).toBe(1);
    expect(loadConfig({ ...baseEnv, TRUST_PROXY_HOPS: '2' }).trustProxyHops).toBe(2);
  });

  it.each(['0', '6', 'abc', '1.5'])('rejects TRUST_PROXY_HOPS=%s', (hops) => {
    expect(() => loadConfig({ ...baseEnv, TRUST_PROXY_HOPS: hops })).toThrow(/Invalid environment/);
  });

  it('rejects non-numeric PORT', () => {
    expect(() => loadConfig({ ...baseEnv, PORT: 'abc' })).toThrow(/Invalid environment/);
  });

  it('throws when DATABASE_URL missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_ACCESS_SECRET missing', () => {
    const { JWT_ACCESS_SECRET: _omit, ...rest } = baseEnv;
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws when JWT_ACCESS_SECRET too short', () => {
    expect(() => loadConfig({ ...baseEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /Invalid environment/,
    );
  });

  it('flags isProd when NODE_ENV=production', () => {
    const cfg = loadConfig({ ...baseEnv, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret' });
    expect(cfg.isProd).toBe(true);
    expect(cfg.isDev).toBe(false);
  });

  it('disables Swagger in production unless SWAGGER_ENABLED=true', () => {
    const prod = { ...baseEnv, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret' };
    expect(loadConfig(baseEnv).swaggerEnabled).toBe(true);
    expect(loadConfig(prod).swaggerEnabled).toBe(false);
    expect(loadConfig({ ...prod, SWAGGER_ENABLED: 'true' }).swaggerEnabled).toBe(true);
    expect(loadConfig({ ...baseEnv, SWAGGER_ENABLED: 'false' }).swaggerEnabled).toBe(false);
  });

  it('leaves turnstile.secretKey undefined when unset in development', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.turnstile.secretKey).toBeUndefined();
  });

  it('throws when TURNSTILE_SECRET_KEY missing in production', () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production' })).toThrow(
      /TURNSTILE_SECRET_KEY/,
    );
  });

  it('derives the admin origin from ADMIN_HOST', () => {
    const cfg = loadConfig({ ...baseEnv, ADMIN_HOST: 'admin.example.com' });
    expect(cfg.admin.origin).toBe('https://admin.example.com');
    expect(loadConfig(baseEnv).admin.origin).toBeUndefined();
  });

  it('lowercases ADMIN_DEFAULT_EMAIL', () => {
    const cfg = loadConfig({
      ...baseEnv,
      ADMIN_DEFAULT_EMAIL: 'Admin@Example.com',
      ADMIN_DEFAULT_PASSWORD: 'long-enough-password',
    });
    expect(cfg.admin.defaultEmail).toBe('admin@example.com');
  });

  it('requires ADMIN_DEFAULT_EMAIL and ADMIN_DEFAULT_PASSWORD together', () => {
    expect(() => loadConfig({ ...baseEnv, ADMIN_DEFAULT_EMAIL: 'admin@example.com' })).toThrow(
      /ADMIN_DEFAULT_PASSWORD/,
    );
  });

  it('rejects a short ADMIN_DEFAULT_PASSWORD', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        ADMIN_DEFAULT_EMAIL: 'admin@example.com',
        ADMIN_DEFAULT_PASSWORD: 'short',
      }),
    ).toThrow(/ADMIN_DEFAULT_PASSWORD/);
  });
});
