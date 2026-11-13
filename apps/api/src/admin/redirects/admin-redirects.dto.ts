import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { REDIRECT_TYPES, type RedirectType } from '@tsyvinda/shared-types';
import { trimToUndefined } from '../../shared/dto-transforms';

export class AdminListRedirectsQueryDto {
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

  @ApiPropertyOptional({ description: 'Case-insensitive match on source or target' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class AdminRedirectInputDto {
  @ApiProperty({ example: '/uk/old-page', description: 'Public path, with the language prefix' })
  @IsString()
  @MaxLength(500)
  source: string;

  @ApiProperty({ example: '/uk/about', description: 'Public path or absolute http(s) URL' })
  @IsString()
  @MaxLength(1000)
  target: string;

  @ApiProperty({ enum: REDIRECT_TYPES, default: 'permanent' })
  @IsIn(REDIRECT_TYPES)
  type: RedirectType;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note: string | null = null;
}

export class AdminRedirectDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() source: string;
  @ApiProperty() target: string;
  @ApiProperty({ enum: REDIRECT_TYPES }) type: string;
  @ApiProperty() enabled: boolean;
  @ApiProperty({ nullable: true, type: String }) note: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class AdminRedirectListDto {
  @ApiProperty({ type: [AdminRedirectDto] }) items: AdminRedirectDto[];
  @ApiProperty() total: number;
}
