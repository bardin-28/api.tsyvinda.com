import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminPostsModule } from './posts/admin-posts.module';

// One list drives both the /admin route prefix and the admin Swagger document (/docs-admin).
export const ADMIN_API_MODULES = [AdminAuthModule, AdminDashboardModule, AdminPostsModule];

export const ADMIN_ROUTE_PREFIX = 'admin';

@Module({
  imports: [
    ...ADMIN_API_MODULES,
    RouterModule.register([
      { path: ADMIN_ROUTE_PREFIX, module: AdminApiModule, children: ADMIN_API_MODULES },
    ]),
  ],
})
export class AdminApiModule {}
