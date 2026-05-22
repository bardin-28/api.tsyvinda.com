import { randomUUID } from 'crypto';
import type { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../shared/app.config';
import { HttpError } from '../../../shared/http-error';
import { User } from '../../users/entities/user.entity';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { EmailVerification } from '../entities/email-verification.entity';
import { hashPassword } from './crypto.service';
import { RefreshToken } from '../entities/refresh-token.entity';
import { hashOpaqueToken } from './token.service';
import { UserIdentity } from '../entities/user-identity.entity';

interface Identified {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class FakeRepo<T extends Identified> {
  rows: T[] = [];

  create(input: Partial<T>): T {
    return { ...input } as T;
  }

  async save(entityOrArr: T | T[]): Promise<T | T[]> {
    const arr = Array.isArray(entityOrArr) ? entityOrArr : [entityOrArr];
    for (const entity of arr) {
      if (!entity.id) entity.id = randomUUID();
      if (!entity.createdAt) entity.createdAt = new Date();
      entity.updatedAt = new Date();
      const idx = this.rows.findIndex((r) => r.id === entity.id);
      if (idx >= 0) this.rows[idx] = entity;
      else this.rows.push(entity);
    }
    return entityOrArr;
  }

  async findOne(opts: { where: Partial<T> }): Promise<T | null> {
    return this.rows.find((r) => matches(r, opts.where)) ?? null;
  }

  async find(opts: { where: Partial<T> }): Promise<T[]> {
    return this.rows.filter((r) => matches(r, opts.where));
  }

  async update(criteria: Partial<T>, partial: Partial<T>): Promise<void> {
    for (const row of this.rows) {
      if (matches(row, criteria)) Object.assign(row as object, partial);
    }
  }
}

function matches<T>(row: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, value]) => {
    return (row as Record<string, unknown>)[key] === value;
  });
}

function makeFakeDS() {
  const repos = new Map<EntityTarget<unknown>, FakeRepo<Identified>>();
  const getRepository = <T extends Identified>(entity: EntityTarget<T>): FakeRepo<T> => {
    const key = entity as EntityTarget<unknown>;
    if (!repos.has(key)) repos.set(key, new FakeRepo<Identified>());
    return repos.get(key) as unknown as FakeRepo<T>;
  };
  const manager = { getRepository } as unknown as EntityManager;
  const ds = {
    getRepository,
    transaction: async <R>(cb: (m: EntityManager) => Promise<R>) => cb(manager),
  };
  return {
    ds: ds as unknown as DataSource,
    users: getRepository(User),
    identities: getRepository(UserIdentity),
    verifications: getRepository(EmailVerification),
    refreshTokens: getRepository(RefreshToken),
  };
}

function makeEmail() {
  return { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
}

const TEST_FRONTEND = 'https://tsyvinda.com';

beforeEach(() => {
  config.frontendHost = [TEST_FRONTEND];
});

describe('AuthService.register', () => {
  it('creates user + identity + verification and sends email', async () => {
    const fake = makeFakeDS();
    const email = makeEmail();
    const service = new AuthService(fake.ds, email as unknown as EmailService);

    await service.register({
      firstName: 'Vlad',
      lastName: 'T',
      email: 'vlad@example.com',
      password: 'Secret123',
    });

    expect(fake.users.rows).toHaveLength(1);
    const user = fake.users.rows[0]!;
    expect(user.email).toBe('vlad@example.com');
    expect(user.emailVerified).toBe(false);
    expect(user.passwordHash).toBeTruthy();
    expect(user.passwordHash).not.toBe('Secret123');

    expect(fake.identities.rows).toHaveLength(1);
    expect(fake.identities.rows[0]?.provider).toBe('local');

    expect(fake.verifications.rows).toHaveLength(1);
    expect(fake.verifications.rows[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(email.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const call = email.sendVerificationEmail.mock.calls[0]?.[0];
    expect(call.to).toBe('vlad@example.com');
    expect(call.firstName).toBe('Vlad');
    expect(call.url.startsWith(`${TEST_FRONTEND}/registration?token=`)).toBe(true);
  });

  it('throws 409 when email is already taken', async () => {
    const fake = makeFakeDS();
    await fake.users.save({
      id: randomUUID(),
      firstName: 'A',
      lastName: 'B',
      email: 'dup@example.com',
      passwordHash: 'x',
      profileImageUrl: null,
      emailVerified: true,
    } as User);
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);

    await expect(
      service.register({
        firstName: 'X',
        lastName: 'Y',
        email: 'dup@example.com',
        password: 'Secret123',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('throws 500 when FRONTEND_HOST is not configured', async () => {
    config.frontendHost = [];
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);

    await expect(
      service.register({
        firstName: 'A',
        lastName: 'B',
        email: 'nofront@example.com',
        password: 'Secret123',
      }),
    ).rejects.toMatchObject({ status: 500, code: 'EMAIL_NOT_CONFIGURED' });
  });
});

describe('AuthService.confirmEmail', () => {
  it('marks the user verified and consumes the token', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);

    const user: User = {
      id: randomUUID(),
      firstName: 'A',
      lastName: 'B',
      email: 'c@example.com',
      passwordHash: 'x',
      profileImageUrl: null,
      emailVerified: false,
    } as User;
    await fake.users.save(user);

    const rawToken = 'a'.repeat(43);
    const tokenHash = hashOpaqueToken(rawToken);
    await fake.verifications.save({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    } as EmailVerification);

    await service.confirmEmail(rawToken);

    const updated = await fake.users.findOne({ where: { id: user.id } });
    expect(updated?.emailVerified).toBe(true);
    const verification = await fake.verifications.findOne({ where: { tokenHash } });
    expect(verification?.consumedAt).toBeInstanceOf(Date);
  });

  it('throws 400 for an unknown token', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await expect(service.confirmEmail('z'.repeat(43))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_TOKEN',
    });
  });

  it('throws 400 for an expired token', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user: User = {
      id: randomUUID(),
      firstName: 'A',
      lastName: 'B',
      email: 'c@example.com',
      passwordHash: 'x',
      profileImageUrl: null,
      emailVerified: false,
    } as User;
    await fake.users.save(user);
    const raw = 'b'.repeat(43);
    await fake.verifications.save({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashOpaqueToken(raw),
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    } as EmailVerification);
    await expect(service.confirmEmail(raw)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_TOKEN',
    });
  });

  it('is idempotent within the reuse window', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user: User = {
      id: randomUUID(),
      firstName: 'A',
      lastName: 'B',
      email: 'idem@example.com',
      passwordHash: 'x',
      profileImageUrl: null,
      emailVerified: true,
    } as User;
    await fake.users.save(user);
    const raw = 'c'.repeat(43);
    await fake.verifications.save({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashOpaqueToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
    } as EmailVerification);
    await expect(service.confirmEmail(raw)).resolves.toBeUndefined();
  });
});

async function seedUserWithPassword(
  fake: ReturnType<typeof makeFakeDS>,
  overrides: Partial<User> = {},
): Promise<User> {
  const passwordHash = await hashPassword('Secret123');
  const user: User = {
    id: randomUUID(),
    firstName: 'V',
    lastName: 'T',
    email: 'login@example.com',
    passwordHash,
    profileImageUrl: null,
    emailVerified: true,
    ...overrides,
  } as User;
  await fake.users.save(user);
  return user;
}

describe('AuthService.login', () => {
  it('returns accessToken + refreshToken on success and persists a refresh row', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user = await seedUserWithPassword(fake);

    const result = await service.login({
      email: user.email,
      password: 'Secret123',
      userAgent: 'jest',
      ip: '127.0.0.1',
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.id).toBe(user.id);
    expect(fake.refreshTokens.rows).toHaveLength(1);
    expect(fake.refreshTokens.rows[0]?.userAgent).toBe('jest');
  });

  it('throws 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await seedUserWithPassword(fake);

    await expect(
      service.login({
        email: 'login@example.com',
        password: 'Wrong123',
        userAgent: null,
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws 401 INVALID_CREDENTIALS for an unknown email (enumeration safe)', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await expect(
      service.login({
        email: 'nobody@example.com',
        password: 'Secret123',
        userAgent: null,
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws 403 EMAIL_NOT_VERIFIED when account is unverified', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await seedUserWithPassword(fake, { emailVerified: false });

    await expect(
      service.login({
        email: 'login@example.com',
        password: 'Secret123',
        userAgent: null,
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });
});

describe('AuthService.rotateRefresh', () => {
  it('rotates: revokes the old token, issues a new one, persists the chain', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user = await seedUserWithPassword(fake);
    const first = await service.login({
      email: user.email,
      password: 'Secret123',
      userAgent: null,
      ip: null,
    });

    const second = await service.rotateRefresh({
      rawRefresh: first.refreshToken,
      userAgent: null,
      ip: null,
    });

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(fake.refreshTokens.rows).toHaveLength(2);
    const oldRow = fake.refreshTokens.rows.find(
      (r) => r.tokenHash === hashOpaqueToken(first.refreshToken),
    );
    const newRow = fake.refreshTokens.rows.find(
      (r) => r.tokenHash === hashOpaqueToken(second.refreshToken),
    );
    expect(oldRow?.revokedAt).toBeInstanceOf(Date);
    expect(oldRow?.replacedById).toBe(newRow?.id);
    expect(newRow?.revokedAt).toBeNull();
  });

  it('reuse detection: presenting a revoked token revokes the whole user chain', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user = await seedUserWithPassword(fake);

    const first = await service.login({
      email: user.email,
      password: 'Secret123',
      userAgent: null,
      ip: null,
    });
    await service.rotateRefresh({
      rawRefresh: first.refreshToken,
      userAgent: null,
      ip: null,
    });

    await expect(
      service.rotateRefresh({
        rawRefresh: first.refreshToken,
        userAgent: null,
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 401, code: 'REFRESH_REUSE' });

    const userRows = fake.refreshTokens.rows.filter((r) => r.userId === user.id);
    expect(userRows.every((r) => r.revokedAt instanceof Date)).toBe(true);
  });

  it('throws 401 INVALID_REFRESH when token is unknown', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await expect(
      service.rotateRefresh({
        rawRefresh: 'unknown-token-value-aaaaaaaaaaaaaaaaaaa',
        userAgent: null,
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_REFRESH' });
  });
});

describe('AuthService.getProfile', () => {
  it('returns the public user shape', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user = await seedUserWithPassword(fake);
    const profile = await service.getProfile(user.id);
    expect(profile).toMatchObject({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImageUrl: null,
      emailVerified: true,
    });
    expect((profile as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('throws 404 USER_NOT_FOUND when the user does not exist', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await expect(service.getProfile(randomUUID())).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });
});

describe('AuthService.logout', () => {
  it('revokes the matching refresh token', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    const user = await seedUserWithPassword(fake);
    const session = await service.login({
      email: user.email,
      password: 'Secret123',
      userAgent: null,
      ip: null,
    });
    await service.logout(session.refreshToken);
    const row = fake.refreshTokens.rows[0];
    expect(row?.revokedAt).toBeInstanceOf(Date);
  });

  it('is a no-op when no token is provided', async () => {
    const fake = makeFakeDS();
    const service = new AuthService(fake.ds, makeEmail() as unknown as EmailService);
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });
});

void HttpError;
