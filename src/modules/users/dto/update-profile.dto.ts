import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { trimString } from '../../../shared/dto-transforms';
import { ApiImageFile } from '../../../shared/swagger/api-image-file.decorator';
import { ApiTurnstileToken } from '../../../shared/turnstile/turnstile-api.decorator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 50)
  lastName?: string;

  @ApiImageFile()
  image?: Express.Multer.File;

  @ApiTurnstileToken()
  'cf-turnstile-response': string;
}
