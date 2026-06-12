import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trimString } from '../../../shared/dto-transforms';
import { ApiImageFile } from '../../../shared/swagger/api-image-file.decorator';
import { SLUG_MESSAGE, SLUG_REGEX } from './slug';

const MAX_HTML = 100_000;

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200, pattern: SLUG_REGEX.source })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: MAX_HTML })
  @IsOptional()
  @IsString()
  @Length(1, MAX_HTML)
  htmlContent?: string;

  @ApiImageFile()
  image?: Express.Multer.File;
}
