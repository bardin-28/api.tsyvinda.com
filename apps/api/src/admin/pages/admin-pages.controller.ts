import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PAGE_KEYS, type PageKey } from '@tsyvinda/shared-types';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { HttpError } from '../../shared/http-error';
import { imageUploadMemoryOptions } from '../../shared/upload-options';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { PagesService } from '../../modules/cms/services/pages.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import {
  AdminPageDto,
  AdminPageListDto,
  PageImageUploadDto,
  UpdatePageDraftDto,
  UpdatePageSlugsDto,
} from './admin-pages.dto';

const pageKeyPipe = new ParseEnumPipe(PAGE_KEYS);

@ApiTags('Admin pages')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('pages')
export class AdminPagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'Every website page with its addresses and translation progress' })
  @ApiQuery({ name: 'q', required: false, description: 'Matches the title or an address' })
  @ApiOkResponse({ type: AdminPageListDto })
  async list(@Query('q') q?: string) {
    const needle = typeof q === 'string' ? q.trim().toLowerCase() : '';
    const items = (await this.pages.list()).filter(
      (page) =>
        !needle ||
        page.label.toLowerCase().includes(needle) ||
        Object.values(page.paths).some((path) => path?.toLowerCase().includes(needle)),
    );
    return { items, total: items.length };
  }

  // Declared before ':key' routes; POST has no ':key' counterpart, so no clash either way
  @Post('uploads')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  @ApiOperation({
    summary: 'Upload an image for a page image field (jpeg, png, webp; 5 MB); returns its URL',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: PageImageUploadDto })
  @ApiResponse({ status: 400, description: 'INVALID_FILE_TYPE or no file', type: ErrorDto })
  @ApiResponse({ status: 413, description: 'File too large', type: ErrorDto })
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new HttpError(400, 'FILE_REQUIRED', 'Choose an image to upload');
    return this.pages.uploadImage(file);
  }

  @Get(':key')
  @ApiOkResponse({ type: AdminPageDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('key', pageKeyPipe) key: PageKey) {
    return this.pages.get(key);
  }

  @Patch(':key')
  @ApiOperation({
    summary: 'Save the content (all languages at once); live on the website right away',
  })
  @ApiOkResponse({ type: AdminPageDto })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_FAILED (invalid or missing required fields) or SLUG_MISSING',
    type: ErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: 'VERSION_CONFLICT: saved by someone else',
    type: ErrorDto,
  })
  save(
    @Param('key', pageKeyPipe) key: PageKey,
    @Body() dto: UpdatePageDraftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pages.save(key, dto, user.id);
  }

  @Put(':key/slugs')
  @ApiOperation({
    summary:
      'Change the address per language; live at once, old addresses redirect to the new ones',
  })
  @ApiOkResponse({ type: AdminPageDto })
  @ApiResponse({ status: 400, description: 'Invalid or reserved slug, or Home', type: ErrorDto })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT or SLUG_TAKEN', type: ErrorDto })
  updateSlugs(
    @Param('key', pageKeyPipe) key: PageKey,
    @Body() dto: UpdatePageSlugsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pages.updateSlugs(key, dto, user.id);
  }
}
