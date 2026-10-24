import { Module } from '@nestjs/common';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { AdminPostsController } from './admin-posts.controller';
import { AdminPostsService } from './admin-posts.service';

@Module({
  imports: [AdminGuardsModule],
  controllers: [AdminPostsController],
  providers: [AdminPostsService],
})
export class AdminPostsModule {}
