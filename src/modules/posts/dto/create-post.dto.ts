import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trimString } from '../../../shared/dto-transforms';
import { SLUG_MESSAGE, SLUG_REGEX } from './slug';

const MAX_HTML = 100_000;

export class CreatePostDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ maxLength: 200, pattern: SLUG_REGEX.source })
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ maxLength: MAX_HTML })
  @IsString()
  @Length(1, MAX_HTML)
  htmlContent: string;

  // Swagger-only: renders the file picker for the `image` multipart field.
  // Multer handles the actual file; it never lands in the validated body.
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  image?: unknown;
}
