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
import { randomUUID } from 'crypto';
import { UserDto } from '../auth/dto/user.response';
import { HttpError } from '../../shared/http-error';
import { extForMime, imageUploadMemoryOptions } from '../../shared/upload-options';
import { S3Service } from '../../shared/s3/s3.service';
import { TurnstileInterceptor } from '../../shared/turnstile/turnstile.interceptor';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './services/profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Profile')
@ApiCookieAuth('cookieAuth')
@Controller('profile')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  @ApiOkResponse({ type: UserDto })
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user.id);
  }

  // Interceptor order matters: FileInterceptor populates req.body/req.file first
  // (memory storage), then Turnstile reads the parsed body. Sending a new `image`
  // replaces the existing one; the previous object is deleted in the service layer.
  // Clearing the image is a separate DELETE /profile/image call.
  @Patch()
  @ApiOkResponse({ type: UserDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', imageUploadMemoryOptions()), TurnstileInterceptor)
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (dto.firstName === undefined && dto.lastName === undefined && !file) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
    }

    const profileImageUrl = file
      ? await this.s3.put(
          `profile/${randomUUID()}.${extForMime(file.mimetype)}`,
          file.buffer,
          file.mimetype,
        )
      : undefined;

    return this.profiles.update(user.id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      profileImageUrl,
    });
  }

  // Clears the profile image and deletes the stored object (no-op if none set).
  @Delete('image')
  @ApiOkResponse({ type: UserDto })
  removeImage(@CurrentUser() user: AuthUser) {
    return this.profiles.removeImage(user.id);
  }
}
