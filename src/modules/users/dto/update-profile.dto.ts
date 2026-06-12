import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { trimString } from '../../../shared/dto-transforms';

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

  @ApiPropertyOptional({ enum: ['true'], description: 'Set to "true" to clear the existing image' })
  @IsOptional()
  @IsIn(['true'])
  removeImage?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Profile image file' })
  @IsOptional()
  image?: unknown;
}
