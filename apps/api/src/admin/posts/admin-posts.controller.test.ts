import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import request from 'supertest';
import { AdminPostsController } from './admin-posts.controller';
import { AdminPostsService } from './admin-posts.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { MediaService } from '../../modules/media/media.service';
import { mediaMock } from '../../modules/media/media.test-utils';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const post = { id: ID, title: 'Hello', slug: 'hello' };

const postsMock = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeTranslation: vi.fn(),
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
    controllers: [AdminPostsController],
    providers: [
      { provide: AdminPostsService, useValue: postsMock },
      { provide: MediaService, useValue: mediaMock(s3Mock) },
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
  postsMock.list.mockResolvedValue({ items: [post], total: 1 });
  postsMock.getById.mockResolvedValue(post);
  postsMock.create.mockResolvedValue(post);
  postsMock.update.mockResolvedValue(post);
  postsMock.remove.mockResolvedValue(undefined);
  s3Mock.put.mockResolvedValue('https://cdn.example/posts/new.png');
});

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

describe('GET /admin/posts', () => {
  it('applies paging/sort defaults', async () => {
    const res = await request(app.getHttpServer()).get('/admin/posts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [post], total: 1 });
    expect(postsMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 25, sort: 'createdAt', order: 'DESC' }),
    );
  });

  it('passes page, perPage, sort, order and q through', async () => {
    await request(app.getHttpServer()).get(
      '/admin/posts?page=3&perPage=10&sort=title&order=ASC&q=%20hello%20',
    );
    expect(postsMock.list).toHaveBeenCalledWith({
      page: 3,
      perPage: 10,
      sort: 'title',
      order: 'ASC',
      q: 'hello',
      locale: 'en',
    });
  });

  it('reads the content language from X-Content-Locale', async () => {
    await request(app.getHttpServer()).get('/admin/posts').set('X-Content-Locale', 'uk');
    expect(postsMock.list).toHaveBeenCalledWith(expect.objectContaining({ locale: 'uk' }));
    const res = await request(app.getHttpServer())
      .get('/admin/posts')
      .set('X-Content-Locale', 'de');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_LOCALE');
  });

  it('rejects an unknown sort column', async () => {
    const res = await request(app.getHttpServer()).get('/admin/posts?sort=htmlContent');
    expect(res.status).toBe(400);
    expect(postsMock.list).not.toHaveBeenCalled();
  });
});

describe('GET /admin/posts/:id', () => {
  it('returns the post', async () => {
    const res = await request(app.getHttpServer()).get(`/admin/posts/${ID}`);
    expect(res.status).toBe(200);
    expect(postsMock.getById).toHaveBeenCalledWith(ID, 'en');
  });

  it('rejects a non-uuid id', async () => {
    const res = await request(app.getHttpServer()).get('/admin/posts/hello');
    expect(res.status).toBe(400);
  });
});

describe('POST /admin/posts', () => {
  const body = { title: 'Hello', slug: 'hello', htmlContent: '<p>Hi</p>' };

  it('creates from JSON as the signed-in admin', async () => {
    const res = await request(app.getHttpServer()).post('/admin/posts').send(body);
    expect(res.status).toBe(201);
    expect(postsMock.create).toHaveBeenCalledWith(
      'admin-1',
      'en',
      expect.objectContaining({
        ...body,
        description: null,
        imageUrl: null,
        ogImageUrl: null,
        authorId: undefined,
        status: undefined,
        categoryIds: undefined,
      }),
    );
    expect(s3Mock.put).not.toHaveBeenCalled();
  });

  it('passes publishing, author, categories and SEO fields (multipart, JSON-encoded ids)', async () => {
    const authorId = '0190a5c1-7c1a-7b3c-8d4e-5f6a7b8c9d0e';
    const categoryIds = [
      '0190a5c1-7c1a-7b3c-8d4e-000000000001',
      '0190a5c1-7c1a-7b3c-8d4e-000000000002',
    ];
    const res = await request(app.getHttpServer())
      .post('/admin/posts')
      .field('title', 'Hello')
      .field('slug', 'hello')
      .field('htmlContent', '<p>Hi</p>')
      .field('authorId', authorId)
      .field('categoryIds', JSON.stringify(categoryIds))
      .field('status', 'published')
      .field('publishedAt', '2026-11-01T10:00:00.000Z')
      .field('seoTitle', '  Better title  ')
      .field('seoDescription', '')
      .field('canonicalUrl', 'https://example.com/original')
      .field('coverAlt', 'Orange knot')
      .attach('ogImage', PNG, { filename: 'og.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(s3Mock.put).toHaveBeenCalledWith(
      expect.stringMatching(/^posts\/og\/[0-9a-f-]+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(postsMock.create).toHaveBeenCalledWith(
      'admin-1',
      'en',
      expect.objectContaining({
        authorId,
        categoryIds,
        status: 'published',
        publishedAt: new Date('2026-11-01T10:00:00.000Z'),
        seoTitle: 'Better title',
        seoDescription: null,
        canonicalUrl: 'https://example.com/original',
        coverAlt: 'Orange knot',
        imageUrl: null,
        ogImageUrl: 'https://cdn.example/posts/new.png',
      }),
    );
  });

  it('uses cover and share images picked from the media library', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/posts')
      .send({
        ...body,
        imageUrl: 'https://cdn.example/media/cover.webp',
        ogImageUrl: 'https://cdn.example/media/og.webp',
      });
    expect(res.status).toBe(201);
    expect(postsMock.create).toHaveBeenCalledWith(
      'admin-1',
      'en',
      expect.objectContaining({
        imageUrl: 'https://cdn.example/media/cover.webp',
        ogImageUrl: 'https://cdn.example/media/og.webp',
      }),
    );
    expect(s3Mock.put).not.toHaveBeenCalled();
  });

  it('rejects invalid publishing/SEO values', async () => {
    const send = (extra: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/admin/posts')
        .send({ ...body, ...extra });
    expect((await send({ status: 'archived' })).status).toBe(400);
    expect((await send({ categoryIds: ['not-a-uuid'] })).status).toBe(400);
    expect((await send({ canonicalUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await send({ publishedAt: 'yesterday' })).status).toBe(400);
    expect(postsMock.create).not.toHaveBeenCalled();
  });

  it('uploads a multipart cover image to S3', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/posts')
      .field('title', 'Hello')
      .field('slug', 'hello')
      .field('htmlContent', '<p>Hi</p>')
      .attach('image', PNG, { filename: 'cover.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(s3Mock.put).toHaveBeenCalledWith(
      expect.stringMatching(/^posts\/.+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(postsMock.create).toHaveBeenCalledWith(
      'admin-1',
      'en',
      expect.objectContaining({ imageUrl: 'https://cdn.example/posts/new.png' }),
    );
  });

  it('rejects an invalid slug', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/posts')
      .send({ ...body, slug: 'Not A Slug' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('PATCH /admin/posts/:id', () => {
  it('updates fields and leaves the image alone by default', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/posts/${ID}`)
      .send({ title: 'New title', htmlContent: '<p>New</p>' });
    expect(res.status).toBe(200);
    expect(postsMock.update).toHaveBeenCalledWith(ID, 'en', {
      title: 'New title',
      slug: undefined,
      description: undefined,
      htmlContent: '<p>New</p>',
      imageUrl: undefined,
    });
  });

  it('clears the description when it is sent empty or null', async () => {
    await request(app.getHttpServer()).patch(`/admin/posts/${ID}`).send({ description: '' });
    expect(postsMock.update).toHaveBeenLastCalledWith(
      ID,
      'en',
      expect.objectContaining({ description: null }),
    );
    await request(app.getHttpServer()).patch(`/admin/posts/${ID}`).send({ description: null });
    expect(postsMock.update).toHaveBeenLastCalledWith(
      ID,
      'en',
      expect.objectContaining({ description: null }),
    );
  });

  it('removes the image with removeImage (multipart string "true")', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/posts/${ID}`)
      .field('removeImage', 'true');
    expect(res.status).toBe(200);
    expect(postsMock.update).toHaveBeenCalledWith(
      ID,
      'en',
      expect.objectContaining({ imageUrl: null }),
    );
  });

  it('a new image wins over removeImage', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/posts/${ID}`)
      .field('removeImage', 'true')
      .attach('image', PNG, { filename: 'cover.png', contentType: 'image/png' });
    expect(postsMock.update).toHaveBeenCalledWith(
      ID,
      'en',
      expect.objectContaining({ imageUrl: 'https://cdn.example/posts/new.png' }),
    );
  });

  it('returns 400 when nothing would change', async () => {
    const res = await request(app.getHttpServer()).patch(`/admin/posts/${ID}`).send({});
    expect(res.status).toBe(400);
    expect(postsMock.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /admin/posts/:id', () => {
  it('returns 204', async () => {
    const res = await request(app.getHttpServer()).delete(`/admin/posts/${ID}`);
    expect(res.status).toBe(204);
    expect(postsMock.remove).toHaveBeenCalledWith(ID);
  });
});

describe('DELETE /admin/posts/:id/translations/:locale', () => {
  it('deletes one language version', async () => {
    const res = await request(app.getHttpServer()).delete(`/admin/posts/${ID}/translations/uk`);
    expect(res.status).toBe(204);
    expect(postsMock.removeTranslation).toHaveBeenCalledWith(ID, 'uk');
  });

  it('rejects an unknown language', async () => {
    const res = await request(app.getHttpServer()).delete(`/admin/posts/${ID}/translations/de`);
    expect(res.status).toBe(400);
  });
});
