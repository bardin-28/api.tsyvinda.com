import { Module } from '@nestjs/common';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { CmsModule } from '../../modules/cms/cms.module';
import { AdminPostsController } from './admin-posts.controller';
import { AdminPostsService } from './admin-posts.service';

@Module({
  imports: [AdminGuardsModule, CmsModule],
  controllers: [AdminPostsController],
  providers: [AdminPostsService],
})
export class AdminPostsModule {}
