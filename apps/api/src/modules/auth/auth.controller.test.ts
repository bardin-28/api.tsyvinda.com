import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const publicUser = {
  id: 'u1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  profileImageUrl: null,
  emailVerified: true,
  approvedByAdmin: true,
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
};

const authMock = {
  register: vi.fn().mockResolvedValue(undefined),
  confirmEmail: vi.fn().mockResolvedValue(undefined),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue(undefined),
  login: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: publicUser }),
  rotateRefresh: vi
    .fn()
    .mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2', user: publicUser }),
  logout: vi.fn().mockResolvedValue(undefined),
};

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: authMock }],
  }).compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
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

beforeEach(() => vi.clearAllMocks());

const validRegister = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'Ada@Example.com',
  password: 'secret123',
  confirmPassword: 'secret123',
};

describe('POST /auth/register', () => {
  it('returns 201 and normalizes the email', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send(validRegister);
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/verification email/i);
    expect(authMock.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com' }),
    );
  });

  it('returns 400 VALIDATION_FAILED when passwords mismatch', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validRegister, confirmPassword: 'different1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(authMock.register).not.toHaveBeenCalled();
  });
});

describe('POST /auth/login', () => {
  it('returns 200 with the user and sets session cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: expect.objectContaining({ id: 'u1' }) });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toMatch(/access=/);
    expect(cookies.join(';')).toMatch(/refresh=/);
  });
});

describe('POST /auth/refresh', () => {
  it('returns 401 when the refresh cookie is missing', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rotates the session when the refresh cookie is present', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'refresh=raw-token');
    expect(res.status).toBe(200);
    expect(authMock.rotateRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ rawRefresh: 'raw-token' }),
    );
  });
});

describe('POST /auth/forgot-password', () => {
  it('returns a generic 200 regardless of account existence', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });
});

describe('POST /auth/logout', () => {
  it('returns 204', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'refresh=raw-token');
    expect(res.status).toBe(204);
    expect(authMock.logout).toHaveBeenCalledWith('raw-token');
  });
});
