import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { SiteSettingsService } from '../../modules/site-settings/site-settings.service';
import {
  SiteSettingsDto,
  UpdateSiteSettingsDto,
} from '../../modules/site-settings/site-settings.dto';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';

@ApiTags('Admin settings')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('settings')
export class AdminSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOkResponse({ type: SiteSettingsDto })
  get() {
    return this.settings.get();
  }

  @Patch()
  @ApiOperation({ summary: 'Change website-wide settings (search engine indexing)' })
  @ApiOkResponse({ type: SiteSettingsDto })
  update(@Body() dto: UpdateSiteSettingsDto) {
    return this.settings.update({ indexingEnabled: dto.indexingEnabled });
  }
}
