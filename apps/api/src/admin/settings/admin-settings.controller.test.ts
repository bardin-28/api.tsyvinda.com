import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminSettingsController } from './admin-settings.controller';
import { SiteSettingsController } from '../../modules/site-settings/site-settings.controller';
import { SiteSettingsService } from '../../modules/site-settings/site-settings.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const settings = { indexingEnabled: true, updatedAt: '2026-11-13T10:00:00.000Z' };
const settingsMock = { get: vi.fn(), update: vi.fn() };
const allow = { canActivate: () => true };

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminSettingsController, SiteSettingsController],
    providers: [{ provide: SiteSettingsService, useValue: settingsMock }],
  })
    .overrideGuard(AdminGuard)
    .useValue(allow)
    .overrideGuard(AdminOriginGuard)
    .useValue(allow)
    .compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  settingsMock.get.mockResolvedValue(settings);
  settingsMock.update.mockResolvedValue({ ...settings, indexingEnabled: false });
});

describe('GET /site-settings (public)', () => {
  it('returns the settings the website renders with', async () => {
    const res = await request(app.getHttpServer()).get('/site-settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(settings);
  });
});

describe('/settings (admin)', () => {
  it('reads the settings', async () => {
    const res = await request(app.getHttpServer()).get('/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(settings);
  });

  it('switches indexing off', async () => {
    const res = await request(app.getHttpServer())
      .patch('/settings')
      .send({ indexingEnabled: false });
    expect(res.status).toBe(200);
    expect(settingsMock.update).toHaveBeenCalledWith({ indexingEnabled: false });
    expect(res.body.indexingEnabled).toBe(false);
  });

  it('requires a boolean', async () => {
    for (const body of [{}, { indexingEnabled: 'no' }]) {
      const res = await request(app.getHttpServer()).patch('/settings').send(body);
      expect(res.status).toBe(400);
    }
    expect(settingsMock.update).not.toHaveBeenCalled();
  });
});
