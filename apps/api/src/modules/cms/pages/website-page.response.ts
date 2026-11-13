import { ApiProperty } from '@nestjs/swagger';
import { BLOCK_TYPES, LOCALES, PAGE_KEYS, type Locale } from '@tsyvinda/shared-types';

export class WebsiteSeoDto {
  @ApiProperty() title: string;
  @ApiProperty() socialTitle: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: [String] }) keywords: string[];
  @ApiProperty({ nullable: true, type: String }) ogImageUrl: string | null;
  @ApiProperty() noindex: boolean;
}

export class WebsiteBlockDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: BLOCK_TYPES }) type: string;
  @ApiProperty({ nullable: true, type: String }) anchor: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Fields of the section type in the requested language; `pageLink` fields are { key, path }, shared content (e.g. `experience`) is added under its key',
  })
  data: Record<string, unknown>;
}

export class WebsitePageDto {
  @ApiProperty({ enum: PAGE_KEYS }) key: string;
  @ApiProperty({ enum: LOCALES }) locale: Locale;
  @ApiProperty({ enum: LOCALES, isArray: true }) locales: Locale[];
  @ApiProperty() title: string;
  @ApiProperty({ type: WebsiteSeoDto }) seo: WebsiteSeoDto;
  @ApiProperty({ type: [WebsiteBlockDto] }) blocks: WebsiteBlockDto[];
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { en: '/about', uk: '/pro-mene' },
    description: 'Unprefixed path per published language',
  })
  paths: Record<string, string>;
  @ApiProperty({ format: 'date-time' }) publishedAt: string;
}
