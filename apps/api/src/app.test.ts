import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { HealthController } from './modules/health/health.controller';
import { REDIS } from './redis/redis.module';
import { AllExceptionsFilter } from './shared/all-exceptions.filter';

const mockDs = {
  isInitialized: true,
  query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
};
const mockRedis = {
  ping: vi.fn().mockResolvedValue('PONG'),
};

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: getDataSourceToken(), useValue: mockDs },
      { provide: REDIS, useValue: mockRedis },
    ],
  }).compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  // Mirror the production request-id behaviour (echo incoming, else mint one).
  app.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDs.query.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');
  });

  it('returns 200 ok when db and redis healthy', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: true, redis: true });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 503 degraded when db fails', async () => {
    mockDs.query.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.db).toBe(false);
    expect(res.body.redis).toBe(true);
  });

  it('echoes incoming x-request-id header', async () => {
    const res = await request(app.getHttpServer()).get('/health').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('404 handler', () => {
  it('returns 404 NOT_FOUND for unknown route', async () => {
    const res = await request(app.getHttpServer()).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });
});
