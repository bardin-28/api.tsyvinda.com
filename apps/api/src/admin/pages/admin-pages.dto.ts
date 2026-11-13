import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, Min } from 'class-validator';
import { LOCALES, PAGE_KEYS, type Locale } from '@tsyvinda/shared-types';

const PATHS_SCHEMA = {
  type: 'object',
  additionalProperties: { type: 'string' },
  example: { en: '/about', uk: '/pro-mene' },
} as const;

export class VersionDto {
  @ApiProperty({ description: 'Version the editor read (optimistic lock)' })
  @IsInt()
  @Min(1)
  version: number;
}

export class UpdatePageDraftDto extends VersionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'PageContent: { title, seo, blocks } with every text as { en, uk }; blocks follow the page’s fixed sections',
  })
  @IsObject()
  draft: Record<string, unknown>;

  @ApiProperty({ enum: LOCALES, isArray: true })
  @IsArray()
  @ArrayMaxSize(LOCALES.length)
  @IsIn(LOCALES, { each: true })
  enabledLocales: Locale[];
}

export class UpdatePageSlugsDto {
  @ApiProperty({ ...PATHS_SCHEMA, example: { en: 'about', uk: 'pro-mene' } })
  @IsObject()
  slugs: Record<string, string>;
}

class AdminEditorDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class AdminPageListItemDto {
  @ApiProperty({ enum: PAGE_KEYS }) id: string;
  @ApiProperty({ enum: PAGE_KEYS }) key: string;
  @ApiProperty() label: string;
  @ApiProperty() routed: boolean;
  @ApiProperty({ enum: LOCALES, isArray: true }) enabledLocales: Locale[];
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: { en: 100, uk: 92 },
    description: 'Translatable texts filled in, per language (0–100)',
  })
  translated: Record<string, number>;
  @ApiProperty(PATHS_SCHEMA) paths: Record<string, string>;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiProperty({ type: AdminEditorDto, nullable: true }) updatedBy: AdminEditorDto | null;
}

export class AdminPageListDto {
  @ApiProperty({ type: [AdminPageListItemDto] }) items: AdminPageListItemDto[];
  @ApiProperty() total: number;
}

class AdminPageOldSlugDto {
  @ApiProperty({ enum: LOCALES }) locale: Locale;
  @ApiProperty() slug: string;
  @ApiProperty({ description: 'Public path that now redirects' }) path: string;
}

export class AdminPageDto extends AdminPageListItemDto {
  @ApiProperty() version: number;
  @ApiProperty({ type: 'object', additionalProperties: true }) draft: Record<string, unknown>;
  @ApiProperty(PATHS_SCHEMA) slugs: Record<string, string>;
  @ApiProperty({ type: [AdminPageOldSlugDto] }) oldSlugs: AdminPageOldSlugDto[];
  @ApiPropertyOptional({ enum: PAGE_KEYS, nullable: true }) parent: string | null;
}

export class PageImageUploadDto {
  @ApiProperty({ example: 'https://cdn.example/pages/0193….webp' }) url: string;
}
