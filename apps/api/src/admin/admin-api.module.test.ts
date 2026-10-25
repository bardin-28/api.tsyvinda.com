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
    .overrideProvider(S3Service)
    .useValue({});
  for (const entity of [User, Post, EmailVerification, PasswordReset, RefreshToken, UserIdentity]) {
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
      ]),
    );
    expect(paths.every((path) => path.startsWith('/admin/'))).toBe(true);
  });
});
