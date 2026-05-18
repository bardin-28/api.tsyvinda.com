import { describe, it, expect } from 'vitest';
import { loadConfig } from './app.config';

const baseEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
} as NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('parses with defaults', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.isDev).toBe(true);
    expect(cfg.isProd).toBe(false);
    expect(cfg.redis.url).toBe('redis://localhost:6379');
  });

  it('coerces PORT from string', () => {
    const cfg = loadConfig({ ...baseEnv, PORT: '4000' });
    expect(cfg.port).toBe(4000);
  });

  it('rejects non-numeric PORT', () => {
    expect(() => loadConfig({ ...baseEnv, PORT: 'abc' })).toThrow(/Invalid environment/);
  });

  it('throws when DATABASE_URL missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it('flags isProd when NODE_ENV=production', () => {
    const cfg = loadConfig({ ...baseEnv, NODE_ENV: 'production' });
    expect(cfg.isProd).toBe(true);
    expect(cfg.isDev).toBe(false);
  });
});
