import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import request from 'supertest';
import { UsersController } from './users.controller';
import { ProfileService } from './services/profile.service';
import { S3Service } from '../../shared/s3/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const profilesMock = {
  get: vi.fn().mockResolvedValue({ id: 'u1', firstName: 'Ada' }),
  update: vi.fn().mockResolvedValue({ id: 'u1', firstName: 'Grace' }),
  removeImage: vi.fn().mockResolvedValue({ id: 'u1', profileImageUrl: null }),
};

const s3Mock = {
  put: vi.fn().mockResolvedValue('https://s3.example/profile/x.jpg'),
  deleteByUrl: vi.fn().mockResolvedValue(undefined),
};

const setUser = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest<Request>().user = { id: 'u1' };
    return true;
  },
};

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [
      { provide: ProfileService, useValue: profilesMock },
      { provide: S3Service, useValue: s3Mock },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue(setUser)
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

beforeEach(() => vi.clearAllMocks());

describe('GET /profile', () => {
  it('returns the current user profile', async () => {
    const res = await request(app.getHttpServer()).get('/profile');
    expect(res.status).toBe(200);
    expect(profilesMock.get).toHaveBeenCalledWith('u1');
  });
});

describe('PATCH /profile', () => {
  it('rejects when no field and no file is provided', async () => {
    const res = await request(app.getHttpServer()).patch('/profile').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at least one field/i);
  });

  it('updates a single field', async () => {
    const res = await request(app.getHttpServer()).patch('/profile').send({ firstName: 'Grace' });
    expect(res.status).toBe(200);
    expect(profilesMock.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ firstName: 'Grace' }),
    );
  });

  it('uploads a profile image to S3 and passes the returned URL', async () => {
    const res = await request(app.getHttpServer())
      .patch('/profile')
      .attach('image', Buffer.from('img-bytes'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(s3Mock.put).toHaveBeenCalledWith(
      expect.stringMatching(/^profile\/[0-9a-f-]+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(profilesMock.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ profileImageUrl: 'https://s3.example/profile/x.jpg' }),
    );
  });

  it('rejects a non-image upload', async () => {
    const res = await request(app.getHttpServer())
      .patch('/profile')
      .attach('image', Buffer.from('nope'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(s3Mock.put).not.toHaveBeenCalled();
  });
});

describe('DELETE /profile/image', () => {
  it('clears the profile image', async () => {
    const res = await request(app.getHttpServer()).delete('/profile/image');
    expect(res.status).toBe(200);
    expect(profilesMock.removeImage).toHaveBeenCalledWith('u1');
    expect(res.body.profileImageUrl).toBeNull();
  });
});

describe('DELETE /profile/image', () => {
  it('clears the profile image', async () => {
    const res = await request(app.getHttpServer()).delete('/profile/image');
    expect(res.status).toBe(200);
    expect(profilesMock.update).toHaveBeenCalledWith('u1', { profileImageUrl: null });
  });
});
