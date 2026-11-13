import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SiteSettingsDto } from './site-settings.dto';
import { SiteSettingsService } from './site-settings.service';

@ApiTags('Site settings')
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Website-wide settings the website renders with (e.g. indexing)' })
  @ApiOkResponse({ type: SiteSettingsDto })
  get() {
    return this.settings.get();
  }
}
