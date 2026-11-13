import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { ADMIN_API_MODULES, AdminApiModule } from './admin-api.module';
import { AdminBootstrapService } from './auth/admin-bootstrap.service';
import { AdminLoginLockoutService } from './auth/admin-login-lockout.service';
import { AdminPostsService } from './posts/admin-posts.service';
import { AdminUsersService } from './users/admin-users.service';
import { AdminCategoriesService } from './categories/admin-categories.service';
import { SiteSettingsService } from '../modules/site-settings/site-settings.service';
import { S3Module } from '../shared/s3/s3.module';
import { S3Service } from '../shared/s3/s3.service';
import { AuthService } from '../modules/auth/services/auth.service';
import { User } from '../modules/users/entities/user.entity';
import { Post } from '../modules/posts/entities/post.entity';
import { EmailVerification } from '../modules/auth/entities/email-verification.entity';
import { PasswordReset } from '../modules/auth/entities/password-reset.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { UserIdentity } from '../modules/auth/entities/user-identity.entity';
import { AllExceptionsFilter } from '../shared/all-exceptions.filter';
import { CmsSeedService } from '../modules/cms/seed/cms-seed.service';
import { RoutesService } from '../modules/cms/services/routes.service';
import { WebsiteContentService } from '../modules/cms/services/website-content.service';
import { PagesService } from '../modules/cms/services/pages.service';
import { RedirectsService } from '../modules/cms/services/redirects.service';
import { Page } from '../modules/cms/entities/page.entity';
import { PageRevision } from '../modules/cms/entities/page-revision.entity';
import { PageSlug } from '../modules/cms/entities/page-slug.entity';
import { Redirect } from '../modules/cms/entities/redirect.entity';

let app: NestExpressApplication;

beforeAll(async () => {
  let builder = Test.createTestingModule({ imports: [AdminApiModule, S3Module] })
    .overrideProvider(getDataSourceToken())
    .useValue({})
    .overrideProvider(AuthService)
    .useValue({})
    .overrideProvider(AdminBootstrapService)
    .useValue({})
    .overrideProvider(AdminLoginLockoutService)
    .useValue({})
    .overrideProvider(AdminPostsService)
    .useValue({})
    .overrideProvider(AdminUsersService)
    .useValue({})
    .overrideProvider(AdminCategoriesService)
    .useValue({})
    .overrideProvider(SiteSettingsService)
    .useValue({})
    .overrideProvider(S3Service)
    .useValue({})
    .overrideProvider(CmsSeedService)
    .useValue({});
  for (const service of [RoutesService, WebsiteContentService, PagesService, RedirectsService]) {
    builder = builder.overrideProvider(service).useValue({});
  }
  for (const entity of [
    User,
    Post,
    EmailVerification,
    PasswordReset,
    RefreshToken,
    UserIdentity,
    Page,
    PageRevision,
    PageSlug,
    Redirect,
  ]) {
    builder = builder.overrideProvider(getRepositoryToken(entity)).useValue({});
  }
  const moduleRef = await builder.compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('AdminApiModule', () => {
  it('mounts admin controllers under /admin (guarded, not 404)', async () => {
    const res = await request(app.getHttpServer()).get('/admin/dashboard');
    expect(res.status).toBe(401);
    const me = await request(app.getHttpServer()).get('/admin/auth/me');
    expect(me.status).toBe(401);
    const posts = await request(app.getHttpServer()).get('/admin/posts');
    expect(posts.status).toBe(401);
    const users = await request(app.getHttpServer()).get('/admin/users');
    expect(users.status).toBe(401);
    const categories = await request(app.getHttpServer()).get('/admin/categories');
    expect(categories.status).toBe(401);
    const settings = await request(app.getHttpServer()).get('/admin/settings');
    expect(settings.status).toBe(401);
    for (const path of ['/admin/pages', '/admin/redirects']) {
      expect((await request(app.getHttpServer()).get(path)).status).toBe(401);
    }
  });

  it('does not expose admin controllers without the prefix', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard');
    expect(res.status).toBe(404);
  });

  it('builds an admin Swagger document with only /admin paths', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      include: ADMIN_API_MODULES,
    });
    const paths = Object.keys(doc.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/admin/auth/login',
        '/admin/auth/refresh',
        '/admin/auth/logout',
        '/admin/auth/me',
        '/admin/dashboard',
        '/admin/posts',
        '/admin/posts/{id}',
        '/admin/categories',
        '/admin/categories/{id}',
        '/admin/settings',
        '/admin/users',
        '/admin/users/{id}',
        '/admin/pages',
        '/admin/pages/{key}',
        '/admin/pages/{key}/slugs',
        '/admin/redirects/{id}',
      ]),
    );
    expect(paths.every((path) => path.startsWith('/admin/'))).toBe(true);
  });
});
