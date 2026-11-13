import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { HttpError } from '../../shared/http-error';
import { MediaService } from '../../modules/media/media.service';
import { imageUploadMemoryOptions } from '../../shared/upload-options';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import {
  AdminListUsersQueryDto,
  AdminUpdateUserDto,
  AdminUserDto,
  AdminUserListDto,
} from './admin-users.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin users')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
@ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('users')
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly media: MediaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Paged user list (search on name/email, filter by role)' })
  @ApiOkResponse({ type: AdminUserListDto })
  list(@Query() query: AdminListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminUserDto })
  @ApiResponse({ status: 404, type: ErrorDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Change a user's role (USER ⇄ ADMIN) and/or profile image",
    description:
      'Role changes apply on their next request. Send `image` to replace the avatar, `removeImage=true` to clear it.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOkResponse({ type: AdminUserDto })
  @ApiResponse({
    status: 400,
    description: 'No change sent, or an invalid field/image',
    type: ErrorDto,
  })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({
    status: 409,
    description: 'CANNOT_DEMOTE_SELF or LAST_ADMIN',
    type: ErrorDto,
  })
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()))
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (dto.role === undefined && !dto.removeImage && !dto.profileImageUrl && !file) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }
    // Same storage layout as the website's own profile upload; joins the media library
    let profileImageUrl: string | null | undefined;
    if (file) profileImageUrl = await this.media.storeUrl(file, 'profile', actor.id);
    else if (dto.profileImageUrl) {
      await this.media.assertInLibrary(dto.profileImageUrl, 'profileImageUrl');
      profileImageUrl = dto.profileImageUrl;
    } else if (dto.removeImage) profileImageUrl = null;
    return this.users.update(actor.id, id, { role: dto.role, profileImageUrl });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a user (sessions and profile image go with them)' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiResponse({ status: 404, type: ErrorDto })
  @ApiResponse({
    status: 409,
    description: 'CANNOT_DELETE_SELF or USER_HAS_POSTS',
    type: ErrorDto,
  })
  async remove(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.remove(actor.id, id);
  }
}
