import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_POST_SORT_FIELDS,
  type AdminPostSortField,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { trimToUndefined } from '../../shared/dto-transforms';
import { ApiImageFile } from '../../shared/swagger/api-image-file.decorator';
import { SLUG_MESSAGE, SLUG_REGEX } from '../../modules/posts/dto/slug';
import { PostDto } from '../../modules/posts/dto/post.response';

export class AdminListPostsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage: number = 25;

  @ApiPropertyOptional({ enum: ADMIN_POST_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(ADMIN_POST_SORT_FIELDS)
  sort: AdminPostSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: SortOrder = 'DESC';

  @ApiPropertyOptional({ description: 'Case-insensitive match on title or slug' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  q?: string;
}

// Multipart sends every field as a string.
const toBoolean = ({ value }: TransformFnParams): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

// Unlike the website DTO, an empty description means "clear it" (null and '' both arrive here).
const emptyToNull = ({ value }: TransformFnParams): unknown => {
  if (value === null) return '';
  return typeof value === 'string' ? value.trim() : value;
};

const MAX_HTML = 100_000;

export class AdminUpdatePostDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200, pattern: SLUG_REGEX.source })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, 200)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ maxLength: 500, description: 'Empty string clears it' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: MAX_HTML })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, MAX_HTML)
  htmlContent?: string;

  @ApiPropertyOptional({ description: 'Drop the cover image (ignored when a new image is sent)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage?: boolean;

  @ApiImageFile()
  image?: Express.Multer.File;
}

export class AdminPostListDto {
  @ApiProperty({ type: [PostDto] })
  items: PostDto[];

  @ApiProperty()
  total: number;
}
