import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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
  ADMIN_CATEGORY_SORT_FIELDS,
  LOCALES,
  type AdminCategorySortField,
  type Locale,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { trimToUndefined } from '../../shared/dto-transforms';
import { SLUG_MESSAGE, SLUG_REGEX } from '../../modules/posts/dto/slug';
import { PostCategoryDto } from '../../modules/posts/dto/post.response';

export class AdminListCategoriesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage: number = 50;

  @ApiPropertyOptional({ enum: ADMIN_CATEGORY_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(ADMIN_CATEGORY_SORT_FIELDS)
  sort: AdminCategorySortField = 'name';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: SortOrder = 'ASC';

  @ApiPropertyOptional({ description: 'Case-insensitive match on name or slug' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AdminCreateCategoryDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ maxLength: 100, pattern: SLUG_REGEX.source, description: 'Filter key in URLs' })
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, 100)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug: string;
}

export class AdminUpdateCategoryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 100, pattern: SLUG_REGEX.source })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @Length(1, 100)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;
}

export class AdminCategoryDto extends PostCategoryDto {
  @ApiProperty({ enum: LOCALES, isArray: true, description: 'Languages the name exists in' })
  locales: Locale[];

  @ApiProperty({ description: 'Posts in this category (drafts included)' })
  postCount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AdminCategoryListDto {
  @ApiProperty({ type: [AdminCategoryDto] })
  items: AdminCategoryDto[];

  @ApiProperty()
  total: number;
}
