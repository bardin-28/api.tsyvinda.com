import { Module } from '@nestjs/common';
import { CmsModule } from '../../modules/cms/cms.module';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { AdminRedirectsController } from './admin-redirects.controller';

@Module({
  imports: [AdminGuardsModule, CmsModule],
  controllers: [AdminRedirectsController],
})
export class AdminRedirectsModule {}
