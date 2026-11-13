import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AllExceptionsFilter } from '../../shared/all-exceptions.filter';
import { validationExceptionFactory } from '../../shared/validation-exception.factory';
import { HttpError } from '../../shared/http-error';
import { WebsitePagesController } from './pages/website-pages.controller';
import { WebsiteRoutesController } from './routes/website-routes.controller';
import { RoutesService } from './services/routes.service';
import { WebsiteContentService } from './services/website-content.service';

const contentMock = { getPage: vi.fn() };
const routesMock = { routeMap: vi.fn(), resolve: vi.fn() };
let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
    controllers: [WebsitePagesController, WebsiteRoutesController],
    providers: [
      { provide: WebsiteContentService, useValue: contentMock },
      { provide: RoutesService, useValue: routesMock },
    ],
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

beforeEach(() => vi.clearAllMocks());

describe('GET /pages/:key', () => {
  it('returns the published page in the requested language', async () => {
    contentMock.getPage.mockResolvedValue({ key: 'about', locale: 'uk' });
    const res = await request(app.getHttpServer()).get('/pages/about?locale=uk');
    expect(res.status).toBe(200);
    expect(contentMock.getPage).toHaveBeenCalledWith('about', 'uk');
  });

  it('defaults to English and rejects unknown languages', async () => {
    contentMock.getPage.mockResolvedValue({});
    await request(app.getHttpServer()).get('/pages/home');
    expect(contentMock.getPage).toHaveBeenCalledWith('home', 'en');
    const res = await request(app.getHttpServer()).get('/pages/home?locale=de');
    expect(res.status).toBe(400);
  });

  it('answers 404 for unpublished pages', async () => {
    contentMock.getPage.mockRejectedValue(new HttpError(404, 'PAGE_NOT_FOUND', 'Page not found'));
    const res = await request(app.getHttpServer()).get('/pages/about');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PAGE_NOT_FOUND');
  });
});

describe('GET /routes', () => {
  it('returns the route map', async () => {
    routesMock.routeMap.mockResolvedValue({ pages: { home: { en: '/' } } });
    const res = await request(app.getHttpServer()).get('/routes');
    expect(res.body).toEqual({ pages: { home: { en: '/' } } });
  });

  it('resolves a path in a language and validates it', async () => {
    routesMock.resolve.mockResolvedValue({ kind: 'page', key: 'about', paths: {} });
    const ok = await request(app.getHttpServer()).get('/routes/resolve?path=/pro-mene&locale=uk');
    expect(ok.status).toBe(200);
    expect(routesMock.resolve).toHaveBeenCalledWith('/pro-mene', 'uk');
    const bad = await request(app.getHttpServer()).get('/routes/resolve?path=about');
    expect(bad.status).toBe(400);
  });
});
