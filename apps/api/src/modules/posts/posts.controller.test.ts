import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PostCategoriesController, PostsController } from './posts.controller';
import { PostService } from './services/post.service';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const postsMock = {
  list: vi.fn(),
  getBySlug: vi.fn(),
  listCategories: vi.fn(),
};

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [PostsController, PostCategoriesController],
    providers: [{ provide: PostService, useValue: postsMock }],
  }).compile();

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
  postsMock.list.mockResolvedValue({ items: [], nextCursor: null });
  postsMock.getBySlug.mockResolvedValue({ id: 'p1', slug: 'hello' });
  postsMock.listCategories.mockResolvedValue([{ id: 'c1', name: 'Frontend', slug: 'frontend' }]);
});

describe('GET /posts', () => {
  it('lists with the default page size', async () => {
    const res = await request(app.getHttpServer()).get('/posts');
    expect(res.status).toBe(200);
    expect(postsMock.list).toHaveBeenCalledWith({
      limit: 20,
      cursor: undefined,
      category: undefined,
      locale: 'en',
    });
  });

  it('passes the cursor and category filter through', async () => {
    await request(app.getHttpServer()).get('/posts?limit=5&cursor=abc&category=frontend');
    expect(postsMock.list).toHaveBeenCalledWith({
      limit: 5,
      cursor: 'abc',
      category: 'frontend',
      locale: 'en',
    });
  });

  it('lists in the requested language and rejects an unknown one', async () => {
    await request(app.getHttpServer()).get('/posts?locale=uk');
    expect(postsMock.list).toHaveBeenCalledWith(expect.objectContaining({ locale: 'uk' }));
    expect((await request(app.getHttpServer()).get('/posts?locale=de')).status).toBe(400);
  });

  it('rejects an out-of-range limit', async () => {
    expect((await request(app.getHttpServer()).get('/posts?limit=500')).status).toBe(400);
  });
});

describe('GET /posts/:slug', () => {
  it('returns the post', async () => {
    const res = await request(app.getHttpServer()).get('/posts/hello');
    expect(res.status).toBe(200);
    expect(postsMock.getBySlug).toHaveBeenCalledWith('hello', 'en');
    await request(app.getHttpServer()).get('/posts/hello?locale=uk');
    expect(postsMock.getBySlug).toHaveBeenLastCalledWith('hello', 'uk');
  });
});

describe('GET /post-categories', () => {
  it('lists categories that have published posts', async () => {
    const res = await request(app.getHttpServer()).get('/post-categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'c1', name: 'Frontend', slug: 'frontend' }]);
    expect(postsMock.listCategories).toHaveBeenCalledWith('en');
  });
});

describe('writes', () => {
  // Posts are written in the admin panel only
  it.each([
    ['post', '/posts'],
    ['patch', '/posts/p1'],
    ['delete', '/posts/p1'],
  ] as const)('%s %s is not exposed', async (method, path) => {
    const res = await request(app.getHttpServer())[method](path).send({});
    expect(res.status).toBe(404);
  });
});
