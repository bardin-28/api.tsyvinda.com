import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { uuidv7 } from '../../shared/uuid-v7';
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { S3Service } from '../../shared/s3/s3.service';
import { extForMime, imageUploadMemoryOptions } from '../../shared/upload-options';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { LOCALES, type Locale } from '@tsyvinda/shared-types';
import { ApiContentLocaleHeader, ContentLocale } from '../content-locale.decorator';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import {
  AdminCreatePostDto,
  AdminListPostsQueryDto,
  AdminPostDto,
  AdminPostListDto,
  AdminUpdatePostDto,
  type AdminPostMetaDto,
} from './admin-posts.dto';
import { AdminPostsService, type AdminPostWriteInput } from './admin-posts.service';

const POST_IMAGE_FIELDS = [
  { name: 'image', maxCount: 1 },
  { name: 'ogImage', maxCount: 1 },
];

interface PostImageFiles {
  image?: Express.Multer.File[];
  ogImage?: Express.Multer.File[];
}

/** Publishing, author, categories and SEO fields; undefined = not sent. */
function toMetaInput(dto: AdminPostMetaDto): AdminPostWriteInput {
  return {
    authorId: dto.authorId,
    categoryIds: dto.categoryIds,
    status: dto.status,
    publishedAt:
      dto.publishedAt === undefined
        ? undefined
        : dto.publishedAt
          ? new Date(dto.publishedAt)
          : null,
    coverAlt: dto.coverAlt,
    seoTitle: dto.seoTitle,
    seoDescription: dto.seoDescription,
    canonicalUrl: dto.canonicalUrl,
  };
}

@ApiTags('Admin posts')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@ApiContentLocaleHeader()
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('posts')
export class AdminPostsController {
  constructor(
    private readonly posts: AdminPostsService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Paged post list, drafts included (search on title/slug, filter by category/status)',
  })
  @ApiOkResponse({ type: AdminPostListDto })
  list(@Query() query: AdminListPostsQueryDto, @ContentLocale() locale: Locale) {
    return this.posts.list({ ...query, locale });
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminPostDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('id', ParseUUIDPipe) id: string, @ContentLocale() locale: Locale) {
    return this.posts.getById(id, locale);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a post (draft unless status=published); author defaults to you',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiCreatedResponse({ type: AdminPostDto })
  @ApiResponse({
    status: 400,
    description: 'AUTHOR_NOT_FOUND, CATEGORY_NOT_FOUND or invalid fields',
    type: ErrorDto,
  })
  @ApiResponse({ status: 409, description: 'Slug already in use', type: ErrorDto })
  @UseInterceptors(FileFieldsInterceptor(POST_IMAGE_FIELDS, imageUploadMemoryOptions(2)))
  async create(
    @CurrentUser() user: AuthUser,
    @ContentLocale() locale: Locale,
    @Body() dto: AdminCreatePostDto,
    @UploadedFiles() files: PostImageFiles = {},
  ) {
    const coverFile = files.image?.[0];
    const ogImageFile = files.ogImage?.[0];
    return this.posts.create(user.id, locale, {
      ...toMetaInput(dto),
      title: dto.title,
      slug: dto.slug,
      description: dto.description || null,
      htmlContent: dto.htmlContent,
      imageUrl: coverFile ? await this.upload(coverFile) : null,
      ogImageUrl: ogImageFile ? await this.upload(ogImageFile, 'og') : null,
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update any post: shared fields plus the X-Content-Locale version (created when missing; needs title and content)',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOkResponse({ type: AdminPostDto })
  @ApiResponse({
    status: 400,
    description: 'Nothing to change, AUTHOR_NOT_FOUND, CATEGORY_NOT_FOUND or invalid fields',
    type: ErrorDto,
  })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({ status: 409, description: 'Slug already in use', type: ErrorDto })
  @UseInterceptors(FileFieldsInterceptor(POST_IMAGE_FIELDS, imageUploadMemoryOptions(2)))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @ContentLocale() locale: Locale,
    @Body() dto: AdminUpdatePostDto,
    @UploadedFiles() files: PostImageFiles = {},
  ) {
    const coverFile = files.image?.[0];
    const ogImageFile = files.ogImage?.[0];
    const meta = toMetaInput(dto);
    const hasChange =
      [dto.title, dto.slug, dto.description, dto.htmlContent].some((v) => v !== undefined) ||
      Object.values(meta).some((v) => v !== undefined) ||
      dto.removeImage ||
      dto.removeOgImage ||
      coverFile ||
      ogImageFile;
    if (!hasChange) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }

    return this.posts.update(id, locale, {
      ...meta,
      title: dto.title,
      slug: dto.slug,
      description: dto.description === '' ? null : dto.description,
      htmlContent: dto.htmlContent,
      imageUrl: coverFile ? await this.upload(coverFile) : dto.removeImage ? null : undefined,
      ogImageUrl: ogImageFile
        ? await this.upload(ogImageFile, 'og')
        : dto.removeOgImage
          ? null
          : undefined,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Post and its cover image deleted' })
  @ApiResponse({ status: 404, type: ErrorDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.posts.remove(id);
  }

  @Delete(':id/translations/:locale')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one language version of a post (not the last one)' })
  @ApiNoContentResponse({ description: 'Language version and its images deleted' })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({ status: 409, description: 'LAST_TRANSLATION', type: ErrorDto })
  async removeTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(LOCALES)) locale: Locale,
  ): Promise<void> {
    await this.posts.removeTranslation(id, locale);
  }

  /** Covers go to `posts/`, social images to `posts/og/`. */
  private upload(file: Express.Multer.File, kind: 'cover' | 'og' = 'cover'): Promise<string> {
    const folder = kind === 'og' ? 'posts/og' : 'posts';
    return this.s3.put(
      `${folder}/${uuidv7()}.${extForMime(file.mimetype)}`,
      file.buffer,
      file.mimetype,
    );
  }
}
