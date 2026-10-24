import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { AdminGuard } from './admin.guard';
import { AdminOriginGuard } from './admin-origin.guard';

// Imported by every admin feature module so its controllers can use the admin guards.
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AdminGuard, AdminOriginGuard],
  exports: [TypeOrmModule, AdminGuard, AdminOriginGuard],
})
export class AdminGuardsModule {}
