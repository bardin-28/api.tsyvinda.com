import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LocaleQueryDto } from './locale.query';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ListPostsQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Opaque cursor returned by a previous call as nextCursor' })
  @IsOptional()
  @IsString()
  @Length(1, 512)
  cursor?: string;

  @ApiPropertyOptional({ description: 'Only posts in this category (category slug)' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;
}
