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
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { MediaService } from '../../modules/media/media.service';
import { imageUploadMemoryOptions } from '../../shared/upload-options';
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
    keywords: dto.keywords,
    localizedSlug: dto.localizedSlug,
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
    private readonly media: MediaService,
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
      imageUrl: coverFile
        ? await this.upload(coverFile, user.id)
        : await this.fromLibrary(dto.imageUrl, 'imageUrl'),
      ogImageUrl: ogImageFile
        ? await this.upload(ogImageFile, user.id, 'og')
        : await this.fromLibrary(dto.ogImageUrl, 'ogImageUrl'),
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
    @CurrentUser() user: AuthUser,
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
      dto.imageUrl ||
      dto.ogImageUrl ||
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
      imageUrl: coverFile
        ? await this.upload(coverFile, user.id)
        : dto.imageUrl
          ? await this.fromLibrary(dto.imageUrl, 'imageUrl')
          : dto.removeImage
            ? null
            : undefined,
      ogImageUrl: ogImageFile
        ? await this.upload(ogImageFile, user.id, 'og')
        : dto.ogImageUrl
          ? await this.fromLibrary(dto.ogImageUrl, 'ogImageUrl')
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

  /** Covers go to `posts/`, social images to `posts/og/`; both join the media library. */
  private upload(
    file: Express.Multer.File,
    userId: string,
    kind: 'cover' | 'og' = 'cover',
  ): Promise<string> {
    return this.media.storeUrl(file, kind === 'og' ? 'posts/og' : 'posts', userId);
  }

  /** An image picked from the media library (null when none was picked). */
  private async fromLibrary(url: string | undefined, field: string): Promise<string | null> {
    if (!url) return null;
    await this.media.assertInLibrary(url, field);
    return url;
  }
}
