import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Role } from '@tsyvinda/shared-types';
import { AdminAuthController } from './admin-auth.controller';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AuthService } from '../../modules/auth/services/auth.service';
import { User } from '../../modules/users/entities/user.entity';
import { signAccessToken } from '../../modules/auth/services/token.service';
import {
  ACCESS_COOKIE_NAME,
  ADMIN_ACCESS_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
} from '../../modules/auth/shared/auth.utils';
import { config } from '../../shared/app.config';
import { HttpError } from '../../shared/http-error';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const ADMIN_ORIGIN = 'https://admin.example.com';

const adminUser = {
  id: 'admin-1',
  firstName: 'Ada',
  lastName: 'Admin',
  email: 'ada@example.com',
  role: Role.ADMIN,
  profileImageUrl: null,
  emailVerified: true,
  approvedByAdmin: true,
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
};

const authMock = {
  login: vi.fn(),
  rotateRefresh: vi.fn(),
  logout: vi.fn(),
  getPublicUser: vi.fn(),
};
const usersRepoMock = { findOne: vi.fn() };

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminAuthController],
    providers: [
      AdminGuard,
      AdminOriginGuard,
      { provide: AuthService, useValue: authMock },
      { provide: getRepositoryToken(User), useValue: usersRepoMock },
    ],
  }).compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  // Stands in for the RouterModule /admin prefix of AdminApiModule.
  app.setGlobalPrefix('admin');
  app.use(cookieParser());
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
  config.admin.origin = ADMIN_ORIGIN;
  authMock.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: adminUser });
  authMock.rotateRefresh.mockResolvedValue({
    accessToken: 'a2',
    refreshToken: 'r2',
    user: adminUser,
  });
  authMock.logout.mockResolvedValue(undefined);
  authMock.getPublicUser.mockResolvedValue(adminUser);
  usersRepoMock.findOne.mockResolvedValue({ id: adminUser.id, role: Role.ADMIN });
});

const cookiesOf = (res: request.Response): string =>
  ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).join(';');

describe('POST /admin/auth/login', () => {
  it('signs in on the admin surface and sets /admin-scoped admin cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .set('Origin', ADMIN_ORIGIN)
      .send({ email: 'Ada@Example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: expect.objectContaining({ id: 'admin-1', role: 'ADMIN' }) });
    expect(res.body).not.toHaveProperty('accessToken');
    expect(authMock.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', surface: 'admin' }),
    );
    const cookies = cookiesOf(res);
    expect(cookies).toMatch(new RegExp(`${ADMIN_ACCESS_COOKIE_NAME}=a;`));
    expect(cookies).toMatch(new RegExp(`${ADMIN_REFRESH_COOKIE_NAME}=r;`));
    expect(cookies).toMatch(/Path=\/admin/);
    expect(cookies).toMatch(/HttpOnly/);
    expect(cookies).not.toMatch(/(^|;\s*)access=/);
  });

  it('passes through the 401 for bad credentials or a non-admin', async () => {
    authMock.login.mockRejectedValueOnce(
      new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    );
    const res = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'user@example.com', password: 'secret123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(cookiesOf(res)).toBe('');
  });

  it('rejects a write from a foreign origin with 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'ada@example.com', password: 'secret123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(authMock.login).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for a malformed body', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /admin/auth/refresh', () => {
  it('returns 401 when the admin refresh cookie is missing', async () => {
    // A website refresh cookie must not count.
    const res = await request(app.getHttpServer())
      .post('/admin/auth/refresh')
      .set('Cookie', ['refresh=website-token']);
    expect(res.status).toBe(401);
    expect(authMock.rotateRefresh).not.toHaveBeenCalled();
  });

  it('rotates the admin session on the admin surface', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/auth/refresh')
      .set('Cookie', [`${ADMIN_REFRESH_COOKIE_NAME}=r`]);
    expect(res.status).toBe(200);
    expect(authMock.rotateRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ rawRefresh: 'r', surface: 'admin' }),
    );
    expect(cookiesOf(res)).toMatch(new RegExp(`${ADMIN_ACCESS_COOKIE_NAME}=a2;`));
  });
});

describe('POST /admin/auth/logout', () => {
  it('revokes the admin refresh token and clears the admin cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/auth/logout')
      .set('Cookie', [`${ADMIN_REFRESH_COOKIE_NAME}=r`]);
    expect(res.status).toBe(204);
    expect(authMock.logout).toHaveBeenCalledWith('r');
    expect(cookiesOf(res)).toMatch(new RegExp(`${ADMIN_ACCESS_COOKIE_NAME}=;`));
  });
});

describe('GET /admin/auth/me', () => {
  it('returns the admin for a valid admin access cookie', async () => {
    const token = signAccessToken(adminUser.id, 'admin');
    const res = await request(app.getHttpServer())
      .get('/admin/auth/me')
      .set('Cookie', [`${ADMIN_ACCESS_COOKIE_NAME}=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'admin-1', role: 'ADMIN' });
    expect(authMock.getPublicUser).toHaveBeenCalledWith('admin-1');
  });

  it('returns 401 without an admin cookie, even with a website session', async () => {
    const token = signAccessToken(adminUser.id);
    const res = await request(app.getHttpServer())
      .get('/admin/auth/me')
      .set('Cookie', [`${ACCESS_COOKIE_NAME}=${token}`]);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a website token placed in the admin cookie', async () => {
    const token = signAccessToken(adminUser.id);
    const res = await request(app.getHttpServer())
      .get('/admin/auth/me')
      .set('Cookie', [`${ADMIN_ACCESS_COOKIE_NAME}=${token}`]);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 403 once the user is no longer an admin', async () => {
    usersRepoMock.findOne.mockResolvedValueOnce({ id: adminUser.id, role: Role.USER });
    const token = signAccessToken(adminUser.id, 'admin');
    const res = await request(app.getHttpServer())
      .get('/admin/auth/me')
      .set('Cookie', [`${ADMIN_ACCESS_COOKIE_NAME}=${token}`]);
    expect(res.status).toBe(403);
  });
});
