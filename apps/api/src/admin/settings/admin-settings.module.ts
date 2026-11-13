import { Module } from '@nestjs/common';
import { AdminGuardsModule } from '../guards/admin-guards.module';
import { SiteSettingsModule } from '../../modules/site-settings/site-settings.module';
import { AdminSettingsController } from './admin-settings.controller';

@Module({
  imports: [AdminGuardsModule, SiteSettingsModule],
  controllers: [AdminSettingsController],
})
export class AdminSettingsModule {}
