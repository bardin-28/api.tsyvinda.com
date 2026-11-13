import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminPagesController } from './admin-pages.controller';
import { PagesService } from '../../modules/cms/services/pages.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';
import { HttpError } from '../../shared/http-error';

const pagesMock = {
  list: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  uploadImage: vi.fn(),
  updateSlugs: vi.fn(),
};
const signedInAdmin = {
  canActivate: (context: ExecutionContext) => {
    context.switchToHttp().getRequest().user = { id: 'admin-1' };
    return true;
  },
};

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminPagesController],
    providers: [{ provide: PagesService, useValue: pagesMock }],
  })
    .overrideGuard(AdminGuard)
    .useValue(signedInAdmin)
    .overrideGuard(AdminOriginGuard)
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

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(pagesMock)) fn.mockResolvedValue({ id: 'about' });
});

describe('Admin pages', () => {
  it('lists pages in the react-admin envelope', async () => {
    pagesMock.list.mockResolvedValue([{ id: 'home' }, { id: 'about' }]);
    const res = await request(app.getHttpServer()).get('/pages');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [{ id: 'home' }, { id: 'about' }], total: 2 });
  });

  it('filters the list by title or address', async () => {
    pagesMock.list.mockResolvedValue([
      { id: 'home', label: 'Home', paths: { en: '/' } },
      { id: 'about', label: 'About', paths: { en: '/about', uk: '/pro-mene' } },
    ]);
    const byTitle = await request(app.getHttpServer()).get('/pages?q=hom');
    expect(byTitle.body.items.map((page: { id: string }) => page.id)).toEqual(['home']);
    const byPath = await request(app.getHttpServer()).get('/pages?q=PRO-');
    expect(byPath.body).toMatchObject({ items: [{ id: 'about' }], total: 1 });
  });

  it('uploads a page image and refuses other file types', async () => {
    pagesMock.uploadImage.mockResolvedValue({ url: 'https://cdn.example/pages/a.png' });
    const res = await request(app.getHttpServer())
      .post('/pages/uploads')
      .attach('image', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ url: 'https://cdn.example/pages/a.png' });
    expect(pagesMock.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png' }),
      'admin-1',
    );

    const pdf = await request(app.getHttpServer())
      .post('/pages/uploads')
      .attach('image', Buffer.from('%PDF'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);
    const empty = await request(app.getHttpServer()).post('/pages/uploads');
    expect(empty.body.error.code).toBe('FILE_REQUIRED');
  });

  it('404s unknown page keys before reaching the service', async () => {
    const res = await request(app.getHttpServer()).get('/pages/nope');
    expect(res.status).toBe(400);
    expect(pagesMock.get).not.toHaveBeenCalled();
  });

  it('saves (and publishes) the content with the version and the editor', async () => {
    const body = { version: 2, draft: { title: { en: 'About' } }, enabledLocales: ['en'] };
    const res = await request(app.getHttpServer()).patch('/pages/about').send(body);
    expect(res.status).toBe(200);
    expect(pagesMock.save).toHaveBeenCalledWith('about', body, 'admin-1');
  });

  it('validates the body', async () => {
    const res = await request(app.getHttpServer())
      .patch('/pages/about')
      .send({ version: 0, draft: 'x', enabledLocales: ['de'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(pagesMock.save).not.toHaveBeenCalled();
  });

  it('passes version conflicts through as 409', async () => {
    pagesMock.save.mockRejectedValue(
      new HttpError(409, 'VERSION_CONFLICT', 'Saved by someone else', { currentVersion: 5 }),
    );
    const res = await request(app.getHttpServer())
      .patch('/pages/about')
      .send({ version: 4, draft: {}, enabledLocales: ['en'] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { currentVersion: 5 },
    });
  });

  it('changes slugs and has no publish endpoints', async () => {
    const slugs = await request(app.getHttpServer())
      .put('/pages/about/slugs')
      .send({ slugs: { uk: 'pro-mene' } });
    expect(slugs.status).toBe(200);
    expect(pagesMock.updateSlugs).toHaveBeenCalledWith(
      'about',
      { slugs: { uk: 'pro-mene' } },
      'admin-1',
    );
    for (const action of ['publish', 'unpublish']) {
      const res = await request(app.getHttpServer())
        .post(`/pages/about/${action}`)
        .send({ version: 5 });
      expect(res.status).toBe(404);
    }
  });
});
