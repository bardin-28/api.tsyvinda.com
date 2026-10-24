import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { HttpError } from '../../shared/http-error';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';

const stats = {
  users: {
    total: 1,
    admins: 1,
    pendingApproval: 0,
    unverified: 0,
    newLast7Days: 1,
    newLast30Days: 1,
  },
  posts: { total: 0, newLast7Days: 0, newLast30Days: 0 },
  recentUsers: [],
};

const dashboardMock = { getStats: vi.fn() };
const adminGuardMock = { canActivate: vi.fn() };

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminDashboardController],
    providers: [{ provide: AdminDashboardService, useValue: dashboardMock }],
  })
    .overrideGuard(AdminGuard)
    .useValue(adminGuardMock)
    .overrideGuard(AdminOriginGuard)
    .useValue({ canActivate: () => true })
    .compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('admin');
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  dashboardMock.getStats.mockResolvedValue(stats);
  adminGuardMock.canActivate.mockReturnValue(true);
});

describe('GET /admin/dashboard', () => {
  it('returns the stats for an admin', async () => {
    const res = await request(app.getHttpServer()).get('/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stats);
  });

  it('returns 401 when the admin guard rejects', async () => {
    adminGuardMock.canActivate.mockImplementation(() => {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing admin auth cookie');
    });
    const res = await request(app.getHttpServer()).get('/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(dashboardMock.getStats).not.toHaveBeenCalled();
  });
});
