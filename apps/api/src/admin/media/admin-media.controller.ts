import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { imageUploadMemoryOptions } from '../../shared/upload-options';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { MediaService } from '../../modules/media/media.service';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AdminMediaDto, AdminMediaListDto, ListMediaQueryDto } from './admin-media.dto';

@ApiTags('Admin media')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'Library images, newest first, with where each is used' })
  @ApiOkResponse({ type: AdminMediaListDto })
  list(@Query() query: ListMediaQueryDto) {
    return this.media.list({
      q: query.q?.trim() || undefined,
      page: query.page ?? 1,
      perPage: query.perPage ?? 40,
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminMediaDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.get(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  @ApiOperation({ summary: 'Upload an image to the library (jpeg, png, webp; 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: AdminMediaDto })
  @ApiResponse({ status: 400, description: 'INVALID_FILE_TYPE or FILE_REQUIRED', type: ErrorDto })
  @ApiResponse({ status: 413, description: 'File too large', type: ErrorDto })
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new HttpError(400, 'FILE_REQUIRED', 'Choose an image to upload');
    const media = await this.media.store(file, 'media', user.id);
    return this.media.get(media.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a library image (refused while anything uses it)' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 409, description: 'MEDIA_IN_USE with details.usages', type: ErrorDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.media.remove(id);
  }
}
