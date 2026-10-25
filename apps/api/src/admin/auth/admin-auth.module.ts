import { Module } from '@nestjs/common';
import { AuthModule } from '../../modules/auth/auth.module';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminLoginLockoutService } from './admin-login-lockout.service';

@Module({
  imports: [AuthModule, AdminGuardsModule],
  controllers: [AdminAuthController],
  providers: [AdminBootstrapService, AdminLoginLockoutService],
})
export class AdminAuthModule {}
