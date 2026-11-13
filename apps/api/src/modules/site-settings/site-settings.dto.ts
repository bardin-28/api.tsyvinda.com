import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SiteSettingsDto {
  @ApiProperty({
    description:
      'Off: every website page answers with X-Robots-Tag noindex, nofollow and the sitemap is empty',
  })
  indexingEnabled: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, description: 'Null until first saved' })
  updatedAt: string | null;
}

export class UpdateSiteSettingsDto {
  @ApiProperty({ description: 'Allow search engines to index the website' })
  @IsBoolean()
  indexingEnabled: boolean;
}
