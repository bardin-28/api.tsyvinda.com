import { Module } from '@nestjs/common';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { AdminMediaController } from './admin-media.controller';

@Module({
  imports: [AdminGuardsModule],
  controllers: [AdminMediaController],
})
export class AdminMediaModule {}
