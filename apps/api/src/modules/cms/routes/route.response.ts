import { ApiProperty } from '@nestjs/swagger';
import { PAGE_KEYS } from '@tsyvinda/shared-types';

const PATHS = {
  type: 'object',
  additionalProperties: { type: 'string' },
  example: { en: '/about', uk: '/pro-mene' },
} as const;

export class WebsiteRouteMapDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: PATHS,
    description: 'Published page key → unprefixed path per language',
  })
  pages: Record<string, Record<string, string>>;
}

export class WebsiteRouteResolutionDto {
  @ApiProperty({ enum: ['page', 'post', 'redirect'] }) kind: string;
  @ApiProperty({ enum: PAGE_KEYS, required: false, description: 'kind=page' }) key?: string;
  @ApiProperty({ required: false, description: 'kind=post' }) slug?: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'kind=page|post: unprefixed path per language',
  })
  paths?: Record<string, string>;
  @ApiProperty({ required: false, description: 'kind=redirect: public path or URL' })
  location?: string;
  @ApiProperty({ required: false, description: 'kind=redirect: 308 (true) or 307' })
  permanent?: boolean;
}
