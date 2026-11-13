import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { RedirectsService } from '../../modules/cms/services/redirects.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import {
  AdminListRedirectsQueryDto,
  AdminRedirectDto,
  AdminRedirectInputDto,
  AdminRedirectListDto,
} from './admin-redirects.dto';

@ApiTags('Admin redirects')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('redirects')
export class AdminRedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @ApiOkResponse({ type: AdminRedirectListDto })
  list(@Query() query: AdminListRedirectsQueryDto) {
    return this.redirects.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminRedirectDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.redirects.get(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Redirect an address the website no longer has' })
  @ApiCreatedResponse({ type: AdminRedirectDto })
  @ApiResponse({ status: 400, description: 'Invalid path, loop or chain', type: ErrorDto })
  @ApiResponse({ status: 409, description: 'REDIRECT_EXISTS', type: ErrorDto })
  create(@Body() dto: AdminRedirectInputDto) {
    return this.redirects.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminRedirectDto })
  @ApiResponse({ status: 400, type: ErrorDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({ status: 409, description: 'REDIRECT_EXISTS', type: ErrorDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminRedirectInputDto) {
    return this.redirects.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, type: ErrorDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.redirects.remove(id);
  }
}
