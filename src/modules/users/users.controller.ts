import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { config } from '../../shared/app.config';
import { UserDto } from '../auth/dto/user.response';
import { HttpError } from '../../shared/http-error';
import { imageUploadOptions } from '../../shared/upload-options';
import { CleanupUploadInterceptor } from '../../shared/cleanup-upload.interceptor';
import { TurnstileInterceptor } from '../../shared/turnstile/turnstile.interceptor';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './services/profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PROFILE_IMAGE_URL_PREFIX, UPLOAD_DIR } from './shared/upload';

@ApiTags('Profile')
@ApiCookieAuth('cookieAuth')
@Controller('profile')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  @ApiOkResponse({ type: UserDto })
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user.id);
  }

  // Interceptor order matters: FileInterceptor populates req.body/req.file first,
  // then cleanup binds its error listeners, then Turnstile reads the parsed body.
  @Patch()
  @ApiOkResponse({ type: UserDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', imageUploadOptions(UPLOAD_DIR)),
    CleanupUploadInterceptor,
    TurnstileInterceptor,
  )
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const wantsRemove = dto.removeImage === 'true';

    if (file && wantsRemove) {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        'Cannot upload and remove image at the same time',
      );
    }

    if (dto.firstName === undefined && dto.lastName === undefined && !file && !wantsRemove) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }

    let profileImageUrl: string | null | undefined;
    if (file) {
      profileImageUrl = `https://${config.backendHost}${PROFILE_IMAGE_URL_PREFIX}/${file.filename}`;
    } else if (wantsRemove) {
      profileImageUrl = null;
    }

    return this.profiles.update(user.id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      profileImageUrl,
    });
  }

  @Delete('image')
  @ApiOkResponse({ type: UserDto })
  deleteImage(@CurrentUser() user: AuthUser) {
    return this.profiles.update(user.id, { profileImageUrl: null });
  }
}
