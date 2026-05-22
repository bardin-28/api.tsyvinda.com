import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('./db/database', () => ({
  AppDataSource: {
    isInitialized: true,
    query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('./redis/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    call: vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === 'SCRIPT') return 'sha';
      return [1, 60];
    }),
    on: vi.fn(),
  },
}));

import app from './app';
import { AppDataSource } from './db/database';
import { redis } from './redis/redis';

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AppDataSource.query).mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(redis.ping).mockResolvedValue('PONG');
  });

  it('returns 200 ok when db and redis healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: true, redis: true });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 503 degraded when db fails', async () => {
    vi.mocked(AppDataSource.query).mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.db).toBe(false);
    expect(res.body.redis).toBe(true);
  });

  it('echoes incoming x-request-id header', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('404 handler', () => {
  it('returns 404 NOT_FOUND for unknown route', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });
});
