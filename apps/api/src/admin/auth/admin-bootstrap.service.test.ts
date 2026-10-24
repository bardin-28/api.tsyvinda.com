import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { Role } from '@tsyvinda/shared-types';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { User } from '../../modules/users/entities/user.entity';
import { UserIdentity } from '../../modules/auth/entities/user-identity.entity';
import { verifyPassword } from '../../modules/auth/services/crypto.service';

function makeRepo() {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
    create: vi.fn((input: object) => ({ ...input })),
    save: vi.fn(async (entity: { id?: string }) => ({ ...entity, id: entity.id ?? 'new-id' })),
  };
}

let users: ReturnType<typeof makeRepo>;
let identities: ReturnType<typeof makeRepo>;
let service: AdminBootstrapService;

beforeEach(() => {
  users = makeRepo();
  identities = makeRepo();
  const getRepository = (entity: EntityTarget<unknown>) => (entity === User ? users : identities);
  const manager = { getRepository } as unknown as EntityManager;
  const ds = {
    getRepository,
    transaction: async <R>(cb: (m: EntityManager) => Promise<R>) => cb(manager),
  } as unknown as DataSource;
  service = new AdminBootstrapService(ds);
});

describe('AdminBootstrapService.ensureDefaultAdmin', () => {
  it('does nothing when the env pair is unset', async () => {
    await service.ensureDefaultAdmin(undefined, undefined);
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('creates a verified, approved ADMIN with a hashed password and a local identity', async () => {
    await service.ensureDefaultAdmin('admin@example.com', 'long-enough-password');

    const created = users.save.mock.calls[0]?.[0] as User;
    expect(created).toMatchObject({
      email: 'admin@example.com',
      role: Role.ADMIN,
      emailVerified: true,
      approvedByAdmin: true,
    });
    expect(created.passwordHash).not.toBe('long-enough-password');
    await expect(verifyPassword('long-enough-password', created.passwordHash!)).resolves.toBe(true);
    expect(identities.save.mock.calls[0]?.[0]).toMatchObject({
      userId: 'new-id',
      provider: 'local',
    } satisfies Partial<UserIdentity>);
  });

  it('leaves an existing admin untouched (password never overwritten)', async () => {
    users.findOne.mockResolvedValueOnce({ id: 'u1', role: Role.ADMIN });
    await service.ensureDefaultAdmin('admin@example.com', 'long-enough-password');
    expect(users.update).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
  });

  it('promotes an existing non-admin with that email, without touching the password', async () => {
    users.findOne.mockResolvedValueOnce({ id: 'u1', role: Role.USER });
    await service.ensureDefaultAdmin('admin@example.com', 'long-enough-password');
    expect(users.update).toHaveBeenCalledWith({ id: 'u1' }, { role: Role.ADMIN });
    expect(users.save).not.toHaveBeenCalled();
  });
});
