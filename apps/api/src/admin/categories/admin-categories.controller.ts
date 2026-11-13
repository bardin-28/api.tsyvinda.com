import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import type { Locale } from '@tsyvinda/shared-types';
import { ApiContentLocaleHeader, ContentLocale } from '../content-locale.decorator';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import {
  AdminCategoryDto,
  AdminCategoryListDto,
  AdminCreateCategoryDto,
  AdminListCategoriesQueryDto,
  AdminUpdateCategoryDto,
} from './admin-categories.dto';
import { AdminCategoriesService } from './admin-categories.service';

@ApiTags('Admin categories')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@ApiContentLocaleHeader()
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Blog categories with post counts' })
  @ApiOkResponse({ type: AdminCategoryListDto })
  list(@Query() query: AdminListCategoriesQueryDto, @ContentLocale() locale: Locale) {
    return this.categories.list({ ...query, locale });
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminCategoryDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('id', ParseUUIDPipe) id: string, @ContentLocale() locale: Locale) {
    return this.categories.getById(id, locale);
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: AdminCategoryDto })
  @ApiResponse({ status: 409, description: 'Slug already in use', type: ErrorDto })
  create(@Body() dto: AdminCreateCategoryDto, @ContentLocale() locale: Locale) {
    return this.categories.create(locale, { name: dto.name, slug: dto.slug });
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminCategoryDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({ status: 409, description: 'Slug already in use', type: ErrorDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ContentLocale() locale: Locale,
    @Body() dto: AdminUpdateCategoryDto,
  ) {
    if (dto.name === undefined && dto.slug === undefined) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }
    return this.categories.update(id, locale, { name: dto.name, slug: dto.slug });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a category; its posts stay, only the link is removed' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  @ApiResponse({ status: 404, type: ErrorDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.remove(id);
  }
}
