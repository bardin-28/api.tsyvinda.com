import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListMediaQueryDto {
  @ApiPropertyOptional({ description: 'Matches the file name or URL' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 40, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

class MediaUsageDto {
  @ApiProperty({ enum: ['post', 'user', 'page'] }) kind: string;
  @ApiProperty() id: string;
  @ApiProperty() label: string;
}

class MediaUploaderDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class AdminMediaDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty({ nullable: true, type: String }) fileName: string | null;
  @ApiProperty({ nullable: true, type: String }) mimeType: string | null;
  @ApiProperty({ nullable: true, type: Number }) size: number | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: MediaUploaderDto, nullable: true }) uploadedBy: MediaUploaderDto | null;
  @ApiProperty({ type: [MediaUsageDto] }) usages: MediaUsageDto[];
}

export class AdminMediaListDto {
  @ApiProperty({ type: [AdminMediaDto] }) items: AdminMediaDto[];
  @ApiProperty() total: number;
}
