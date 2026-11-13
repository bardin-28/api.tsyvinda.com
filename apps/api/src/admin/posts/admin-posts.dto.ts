import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_POST_SORT_FIELDS,
  POST_STATUSES,
  type AdminPostSortField,
  type PostStatus,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { trimToUndefined } from '../../shared/dto-transforms';
import { ApiImageFile } from '../../shared/swagger/api-image-file.decorator';
import { SLUG_MESSAGE, SLUG_REGEX } from '../../modules/posts/dto/slug';
import { PostDto } from '../../modules/posts/dto/post.response';
import { CreatePostDto } from '../../modules/posts/dto/create-post.dto';

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
  @ApiPropertyOptional({ format: 'uuid', description: 'Only posts in this category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: POST_STATUSES })
  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: PostStatus;
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

// Optional text overrides: '' or null clears (→ null), undefined = not sent.
const blankToNull = ({ value }: TransformFnParams): unknown => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

// JSON bodies send arrays; multipart sends them JSON-encoded ('["id1","id2"]').
const toIdArray = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  if (value.trim() === '') return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

/** Publishing, author, categories and SEO fields shared by admin create and update. */
export class AdminPostMetaDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Any user; omitted on create = you' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Ordered: the first is the main category. [] removes all.',
  })
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ enum: POST_STATUSES, description: 'Publishing sets publishedAt if empty' })
  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: PostStatus;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: '"Date shown"; empty clears',
  })
  @IsOptional()
  @Transform(blankToNull)
  @IsISO8601()
  publishedAt?: string | null;

  @ApiPropertyOptional({
    maxLength: 300,
    nullable: true,
    description: 'Cover alt text; empty clears',
  })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(300)
  coverAlt?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true, description: 'Empty: the title' })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  seoTitle?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, description: 'Empty: the description' })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @ApiPropertyOptional({
    maxLength: 1024,
    nullable: true,
    description: "Empty: the post's own URL",
  })
  @IsOptional()
  @Transform(blankToNull)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(1024)
  canonicalUrl?: string | null;

  @ApiPropertyOptional({ description: 'Drop the OG image (ignored when a new ogImage is sent)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeOgImage?: boolean;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Social sharing image, ideally 1200×630 (jpeg, png, webp; max 5MB). Empty: the cover.',
  })
  ogImage?: Express.Multer.File;

  @ApiPropertyOptional({
    maxLength: 1024,
    description: 'Cover from the media library (its URL); ignored when a new image is sent',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
  @MaxLength(1024)
  imageUrl?: string;

  @ApiPropertyOptional({
    maxLength: 1024,
    description: 'Share image from the media library (its URL); ignored when a new ogImage is sent',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
  @MaxLength(1024)
  ogImageUrl?: string;
}

export class AdminCreatePostDto extends IntersectionType(CreatePostDto, AdminPostMetaDto) {}

class AdminUpdatePostFieldsDto {
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

export class AdminUpdatePostDto extends IntersectionType(
  AdminUpdatePostFieldsDto,
  AdminPostMetaDto,
) {}

export class AdminPostDto extends PostDto {
  @ApiProperty({ format: 'uuid' })
  authorId: string;

  @ApiProperty({ type: [String], format: 'uuid', description: 'Ordered category ids (main first)' })
  categoryIds: string[];
}

export class AdminPostListDto {
  @ApiProperty({ type: [AdminPostDto] })
  items: AdminPostDto[];

  @ApiProperty()
  total: number;
}
