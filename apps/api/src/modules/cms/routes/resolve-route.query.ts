import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { LocaleQueryDto } from '../../posts/dto/locale.query';

export class ResolveRouteQueryDto extends LocaleQueryDto {
  @ApiProperty({ example: '/about', description: 'Path without the language prefix' })
  @IsString()
  @MaxLength(1000)
  @Matches(/^\//, { message: 'path must start with "/"' })
  path: string;
}
