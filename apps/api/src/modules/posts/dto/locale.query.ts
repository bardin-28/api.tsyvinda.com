import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@tsyvinda/shared-types';

/** `?locale=` of the website endpoints; English when omitted. */
export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: LOCALES, default: DEFAULT_LOCALE })
  @IsOptional()
  @IsIn(LOCALES)
  locale: Locale = DEFAULT_LOCALE;
}
