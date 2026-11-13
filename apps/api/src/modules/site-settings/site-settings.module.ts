import { Module } from '@nestjs/common';
import { SiteSettingsController } from './site-settings.controller';
import { SiteSettingsService } from './site-settings.service';

@Module({
  controllers: [SiteSettingsController],
  providers: [SiteSettingsService],
  // The admin settings module edits the same row
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
