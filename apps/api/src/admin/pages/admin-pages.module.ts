import { Module } from '@nestjs/common';
import { CmsModule } from '../../modules/cms/cms.module';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { AdminPagesController } from './admin-pages.controller';

@Module({
  imports: [AdminGuardsModule, CmsModule],
  controllers: [AdminPagesController],
})
export class AdminPagesModule {}
