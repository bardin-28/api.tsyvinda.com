import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { PostDto, PostListDto } from './dto/post.response';
import { HttpError } from '../../shared/http-error';
import { extForMime, imageUploadMemoryOptions } from '../../shared/upload-options';
import { S3Service } from '../../shared/s3/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ApprovedGuard } from '../auth/guards/approved.guard';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { PostService } from './services/post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts.query';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  @ApiOkResponse({ type: PostListDto })
  list(@Query() query: ListPostsQueryDto) {
    return this.posts.list({ limit: query.limit, cursor: query.cursor });
  }

  @Get(':slug')
  @ApiOkResponse({ type: PostDto })
  get(@Param('slug') slug: string) {
    return this.posts.getBySlug(slug);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AuthGuard, ApprovedGuard)
  @ApiCookieAuth('cookieAuth')
  @ApiCreatedResponse({ type: PostDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = file
      ? await this.s3.put(
          `posts/${randomUUID()}.${extForMime(file.mimetype)}`,
          file.buffer,
          file.mimetype,
        )
      : null;

    return this.posts.create(user.id, {
      title: dto.title,
      slug: dto.slug,
      description: dto.description,
      htmlContent: dto.htmlContent,
      imageUrl,
    });
  }

  @Patch(':id')
  @UseGuards(AuthGuard, ApprovedGuard)
  @ApiCookieAuth('cookieAuth')
  @ApiOkResponse({ type: PostDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (
      dto.title === undefined &&
      dto.slug === undefined &&
      dto.description === undefined &&
      dto.htmlContent === undefined &&
      !file
    ) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }

    const imageUrl: string | undefined = file
      ? await this.s3.put(
          `posts/${randomUUID()}.${extForMime(file.mimetype)}`,
          file.buffer,
          file.mimetype,
        )
      : undefined;

    return this.posts.update(id, user.id, {
      title: dto.title,
      slug: dto.slug,
      description: dto.description,
      htmlContent: dto.htmlContent,
      imageUrl,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard, ApprovedGuard)
  @ApiCookieAuth('cookieAuth')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.posts.remove(id, user.id);
  }
}
