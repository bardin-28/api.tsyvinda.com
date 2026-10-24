import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import request from 'supertest';
import { PostsController } from './posts.controller';
import { PostService } from './services/post.service';
import { S3Service } from '../../shared/s3/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ApprovedGuard } from '../auth/guards/approved.guard';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const postsMock = {
  list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  getBySlug: vi.fn().mockResolvedValue({ id: 'p1', slug: 'hello' }),
  create: vi.fn().mockResolvedValue({ id: 'p1' }),
  update: vi.fn().mockResolvedValue({ id: 'p1' }),
  remove: vi.fn().mockResolvedValue(undefined),
};

const s3Mock = {
  put: vi.fn().mockResolvedValue('https://s3.example/posts/x.jpg'),
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
    controllers: [PostsController],
    providers: [
      { provide: PostService, useValue: postsMock },
      { provide: S3Service, useValue: s3Mock },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue(setUser)
    .overrideGuard(ApprovedGuard)
    .useValue({ canActivate: () => true })
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

describe('GET /posts', () => {
  it('lists with the default limit of 20', async () => {
    const res = await request(app.getHttpServer()).get('/posts');
    expect(res.status).toBe(200);
    expect(postsMock.list).toHaveBeenCalledWith({ limit: 20, cursor: undefined });
  });

  it('rejects an out-of-range limit', async () => {
    const res = await request(app.getHttpServer()).get('/posts').query({ limit: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /posts/:slug', () => {
  it('fetches by slug', async () => {
    const res = await request(app.getHttpServer()).get('/posts/hello');
    expect(res.status).toBe(200);
    expect(postsMock.getBySlug).toHaveBeenCalledWith('hello');
  });
});

describe('POST /posts', () => {
  it('creates a post (no image → null imageUrl) and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .send({ title: 'T', slug: 'my-post', htmlContent: '<p>hi</p>' });
    expect(res.status).toBe(201);
    expect(postsMock.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ slug: 'my-post', imageUrl: null }),
    );
  });

  it('uploads an image to S3 and passes the returned URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .field('title', 'T')
      .field('slug', 'my-post')
      .field('htmlContent', '<p>hi</p>')
      .attach('image', Buffer.from('img-bytes'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(s3Mock.put).toHaveBeenCalledWith(
      expect.stringMatching(/^posts\/[0-9a-f-]+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(postsMock.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ imageUrl: 'https://s3.example/posts/x.jpg' }),
    );
  });

  it('rejects a non-image upload', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .field('title', 'T')
      .field('slug', 'my-post')
      .field('htmlContent', '<p>hi</p>')
      .attach('image', Buffer.from('nope'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(s3Mock.put).not.toHaveBeenCalled();
  });

  it('rejects an invalid slug', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .send({ title: 'T', slug: 'Bad Slug', htmlContent: 'x' });
    expect(res.status).toBe(400);
    expect(postsMock.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /posts/:id', () => {
  it('rejects when no field and no file is provided', async () => {
    const res = await request(app.getHttpServer()).patch('/posts/p1').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at least one field/i);
  });

  it('updates a single field', async () => {
    const res = await request(app.getHttpServer()).patch('/posts/p1').send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(postsMock.update).toHaveBeenCalledWith(
      'p1',
      'u1',
      expect.objectContaining({ title: 'New' }),
    );
  });

  it('updates only the image, ignoring blank multipart text fields', async () => {
    const res = await request(app.getHttpServer())
      .patch('/posts/p1')
      .field('title', '')
      .field('slug', '')
      .field('description', '')
      .field('htmlContent', '')
      .attach('image', Buffer.from('img-bytes'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(s3Mock.put).toHaveBeenCalled();
    expect(postsMock.update).toHaveBeenCalledWith(
      'p1',
      'u1',
      expect.objectContaining({
        title: undefined,
        slug: undefined,
        description: undefined,
        htmlContent: undefined,
        imageUrl: 'https://s3.example/posts/x.jpg',
      }),
    );
  });
});

describe('DELETE /posts/:id', () => {
  it('returns 204', async () => {
    const res = await request(app.getHttpServer()).delete('/posts/p1');
    expect(res.status).toBe(204);
    expect(postsMock.remove).toHaveBeenCalledWith('p1', 'u1');
  });
});
