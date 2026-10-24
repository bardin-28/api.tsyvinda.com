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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { randomUUID } from 'crypto';
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { S3Service } from '../../shared/s3/s3.service';
import { extForMime, imageUploadMemoryOptions } from '../../shared/upload-options';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { CreatePostDto } from '../../modules/posts/dto/create-post.dto';
import { PostDto } from '../../modules/posts/dto/post.response';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AdminListPostsQueryDto, AdminPostListDto, AdminUpdatePostDto } from './admin-posts.dto';
import { AdminPostsService } from './admin-posts.service';

@ApiTags('Admin posts')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('posts')
export class AdminPostsController {
  constructor(
    private readonly posts: AdminPostsService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Paged post list (search on title/slug)' })
  @ApiOkResponse({ type: AdminPostListDto })
  list(@Query() query: AdminListPostsQueryDto) {
    return this.posts.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: PostDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.posts.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a post authored by the signed-in admin' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiCreatedResponse({ type: PostDto })
  @ApiResponse({ status: 409, description: 'Slug already in use', type: ErrorDto })
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.posts.create(user.id, {
      title: dto.title,
      slug: dto.slug,
      description: dto.description,
      htmlContent: dto.htmlContent,
      imageUrl: file ? await this.upload(file) : null,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update any post' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOkResponse({ type: PostDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({ status: 409, description: 'Slug already in use', type: ErrorDto })
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (
      dto.title === undefined &&
      dto.slug === undefined &&
      dto.description === undefined &&
      dto.htmlContent === undefined &&
      !dto.removeImage &&
      !file
    ) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }

    const imageUrl = file ? await this.upload(file) : dto.removeImage ? null : undefined;
    return this.posts.update(id, {
      title: dto.title,
      slug: dto.slug,
      description: dto.description === '' ? null : dto.description,
      htmlContent: dto.htmlContent,
      imageUrl,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Post and its cover image deleted' })
  @ApiResponse({ status: 404, type: ErrorDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.posts.remove(id);
  }

  private upload(file: Express.Multer.File): Promise<string> {
    return this.s3.put(
      `posts/${randomUUID()}.${extForMime(file.mimetype)}`,
      file.buffer,
      file.mimetype,
    );
  }
}
