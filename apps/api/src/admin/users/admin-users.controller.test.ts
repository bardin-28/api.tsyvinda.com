import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import request from 'supertest';
import { Role } from '@tsyvinda/shared-types';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';
import { HttpError } from '../../shared/http-error';
import { S3Service } from '../../shared/s3/s3.service';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const user = { id: ID, email: 'grace@example.com', role: Role.USER, postCount: 0 };

const usersMock = {
  list: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const s3Mock = { put: vi.fn() };

const setAdmin = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest<Request>().user = { id: 'admin-1' };
    return true;
  },
};

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminUsersController],
    providers: [
      { provide: AdminUsersService, useValue: usersMock },
      { provide: S3Service, useValue: s3Mock },
    ],
  })
    .overrideGuard(AdminGuard)
    .useValue(setAdmin)
    .overrideGuard(AdminOriginGuard)
    .useValue({ canActivate: () => true })
    .compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('admin');
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
  usersMock.list.mockResolvedValue({ items: [user], total: 1 });
  usersMock.getById.mockResolvedValue(user);
  usersMock.update.mockResolvedValue({ ...user, role: Role.ADMIN });
  usersMock.remove.mockResolvedValue(undefined);
  s3Mock.put.mockResolvedValue('https://cdn.example/profile/new.png');
});

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

describe('GET /admin/users', () => {
  it('applies paging/sort defaults', async () => {
    const res = await request(app.getHttpServer()).get('/admin/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [user], total: 1 });
    expect(usersMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 25, sort: 'createdAt', order: 'DESC' }),
    );
  });

  it('passes search, role filter and paging through', async () => {
    await request(app.getHttpServer()).get(
      '/admin/users?q=%20grace%20&role=ADMIN&page=2&perPage=50&sort=email&order=ASC',
    );
    expect(usersMock.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'grace',
        role: Role.ADMIN,
        page: 2,
        perPage: 50,
        sort: 'email',
        order: 'ASC',
      }),
    );
  });

  it('rejects an unknown sort field and role', async () => {
    expect((await request(app.getHttpServer()).get('/admin/users?sort=passwordHash')).status).toBe(
      400,
    );
    expect((await request(app.getHttpServer()).get('/admin/users?role=ROOT')).status).toBe(400);
  });
});

describe('GET /admin/users/:id', () => {
  it('returns the user', async () => {
    const res = await request(app.getHttpServer()).get(`/admin/users/${ID}`);
    expect(res.status).toBe(200);
    expect(usersMock.getById).toHaveBeenCalledWith(ID);
  });

  it('rejects a non-UUID id', async () => {
    expect((await request(app.getHttpServer()).get('/admin/users/abc')).status).toBe(400);
  });
});

describe('PATCH /admin/users/:id', () => {
  it('changes the role as the signed-in admin', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${ID}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(usersMock.update).toHaveBeenCalledWith('admin-1', ID, {
      role: Role.ADMIN,
      profileImageUrl: undefined,
    });
  });

  it('requires a valid role', async () => {
    expect((await request(app.getHttpServer()).patch(`/admin/users/${ID}`).send({})).status).toBe(
      400,
    );
    expect(
      (await request(app.getHttpServer()).patch(`/admin/users/${ID}`).send({ role: 'ROOT' }))
        .status,
    ).toBe(400);
    expect(usersMock.update).not.toHaveBeenCalled();
  });

  it('uploads a new avatar to profile/ and passes its URL', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${ID}`)
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(s3Mock.put).toHaveBeenCalledWith(
      expect.stringMatching(/^profile\/[0-9a-f-]+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(usersMock.update).toHaveBeenCalledWith('admin-1', ID, {
      role: undefined,
      profileImageUrl: 'https://cdn.example/profile/new.png',
    });
  });

  it('clears the avatar with removeImage', async () => {
    await request(app.getHttpServer()).patch(`/admin/users/${ID}`).field('removeImage', 'true');
    expect(usersMock.update).toHaveBeenCalledWith('admin-1', ID, {
      role: undefined,
      profileImageUrl: null,
    });
    expect(s3Mock.put).not.toHaveBeenCalled();
  });

  it('rejects a non-image upload', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${ID}`)
      .attach('image', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(usersMock.update).not.toHaveBeenCalled();
  });

  it('surfaces guard conflicts as 409 with their code', async () => {
    usersMock.update.mockRejectedValue(new HttpError(409, 'LAST_ADMIN', 'nope'));
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${ID}`)
      .send({ role: 'USER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });
});

describe('DELETE /admin/users/:id', () => {
  it('deletes as the signed-in admin', async () => {
    const res = await request(app.getHttpServer()).delete(`/admin/users/${ID}`);
    expect(res.status).toBe(204);
    expect(usersMock.remove).toHaveBeenCalledWith('admin-1', ID);
  });

  it('surfaces USER_HAS_POSTS as 409', async () => {
    usersMock.remove.mockRejectedValue(new HttpError(409, 'USER_HAS_POSTS', 'has posts'));
    const res = await request(app.getHttpServer()).delete(`/admin/users/${ID}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_HAS_POSTS');
  });
});
