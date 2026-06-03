import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../redis/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    call: vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === 'SCRIPT') return 'sha';
      return [1, 60];
    }),
    on: vi.fn(),
  },
}));

const { authServiceMock } = vi.hoisted(() => ({
  authServiceMock: {
    register: vi.fn(),
    confirmEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    login: vi.fn(),
    rotateRefresh: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('./services/auth.service', () => ({
  AuthService: vi.fn(),
  authService: authServiceMock,
  toPublicUser: (u: unknown) => u,
}));

import app from '../../app';

const samplePublicUser = {
  id: '11111111-1111-1111-1111-111111111111',
  firstName: 'Vlad',
  lastName: 'T',
  email: 'vlad@example.com',
  profileImageUrl: null,
  emailVerified: true,
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

function setCookieList(headers: Record<string, string | string[] | undefined>): string[] {
  const raw = headers['set-cookie'];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return [raw];
  return [];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /auth/register', () => {
  it('returns 201 when body is valid', async () => {
    authServiceMock.register.mockResolvedValue(undefined);
    const res = await request(app).post('/auth/register').send({
      firstName: 'Vlad',
      lastName: 'T',
      email: 'vlad@example.com',
      password: 'Secret123',
      confirmPassword: 'Secret123',
    });
    expect(res.status).toBe(201);
    expect(authServiceMock.register).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when passwords do not match', async () => {
    const res = await request(app).post('/auth/register').send({
      firstName: 'Vlad',
      lastName: 'T',
      email: 'vlad@example.com',
      password: 'Secret123',
      confirmPassword: 'Mismatch1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('returns 400 when password is too weak', async () => {
    const res = await request(app).post('/auth/register').send({
      firstName: 'Vlad',
      lastName: 'T',
      email: 'vlad@example.com',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is malformed', async () => {
    const res = await request(app).post('/auth/register').send({
      firstName: 'Vlad',
      lastName: 'T',
      email: 'not-an-email',
      password: 'Secret123',
      confirmPassword: 'Secret123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/confirm-email', () => {
  it('returns 200 when token is valid', async () => {
    authServiceMock.confirmEmail.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/confirm-email')
      .send({ token: 'a'.repeat(43) });
    expect(res.status).toBe(200);
    expect(authServiceMock.confirmEmail).toHaveBeenCalledWith('a'.repeat(43));
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/auth/confirm-email').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/forgot-password', () => {
  it('returns 200 with a generic message for a valid email', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'vlad@example.com' });
    expect(res.status).toBe(200);
    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith('vlad@example.com');
  });

  it('returns 200 even for an unknown email (no enumeration)', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });

  it('returns 400 when email is malformed', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(authServiceMock.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe('POST /auth/reset-password', () => {
  it('returns 200 when token and matching passwords are valid', async () => {
    authServiceMock.resetPassword.mockResolvedValue(undefined);
    const token = 'a'.repeat(43);
    const res = await request(app).post('/auth/reset-password').send({
      token,
      password: 'NewSecret123',
      confirmPassword: 'NewSecret123',
    });
    expect(res.status).toBe(200);
    expect(authServiceMock.resetPassword).toHaveBeenCalledWith(token, 'NewSecret123');
  });

  it('returns 400 when passwords do not match', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      token: 'a'.repeat(43),
      password: 'NewSecret123',
      confirmPassword: 'Mismatch1',
    });
    expect(res.status).toBe(400);
    expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
  });

  it('returns 400 when password is too weak', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      token: 'a'.repeat(43),
      password: 'short',
      confirmPassword: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      password: 'NewSecret123',
      confirmPassword: 'NewSecret123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns 200 + user (no accessToken in body) + sets access and refresh cookies', async () => {
    authServiceMock.login.mockResolvedValue({
      accessToken: 'access-jwt',
      refreshToken: 'raw-refresh-token-value',
      user: samplePublicUser,
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'vlad@example.com', password: 'Secret123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.user.email).toBe('vlad@example.com');

    const cookies = setCookieList(res.headers);
    const accessCookie = cookies.find((c) => c.startsWith('access='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh='));
    const hasSessionCookie = cookies.find((c) => c.startsWith('has_session='));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(accessCookie).toMatch(/Path=\//);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Path=\/(?!auth)/);
    expect(hasSessionCookie).toBeDefined();
    expect(hasSessionCookie).not.toMatch(/HttpOnly/i);
    expect(hasSessionCookie).toMatch(/Path=\//);
  });
});

describe('POST /auth/refresh', () => {
  it('returns 401 when no refresh cookie is present', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 200 + rotates both cookies when refresh succeeds', async () => {
    authServiceMock.rotateRefresh.mockResolvedValue({
      accessToken: 'new-access-jwt',
      refreshToken: 'new-raw-refresh',
      user: samplePublicUser,
    });
    const res = await request(app).post('/auth/refresh').set('Cookie', ['refresh=old-raw-refresh']);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(samplePublicUser.id);
    const cookies = setCookieList(res.headers);
    expect(cookies.find((c) => c.startsWith('access=new-access-jwt'))).toBeDefined();
    expect(cookies.find((c) => c.startsWith('refresh=new-raw-refresh'))).toBeDefined();
  });
});

describe('POST /auth/logout', () => {
  it('returns 204 and clears both cookies', async () => {
    authServiceMock.logout.mockResolvedValue(undefined);
    const res = await request(app).post('/auth/logout').set('Cookie', ['refresh=anything']);
    expect(res.status).toBe(204);
    expect(authServiceMock.logout).toHaveBeenCalledWith('anything');
    const cookies = setCookieList(res.headers);
    const accessCleared = cookies.find((c) => c.startsWith('access='));
    const refreshCleared = cookies.find((c) => c.startsWith('refresh='));
    expect(accessCleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(refreshCleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
