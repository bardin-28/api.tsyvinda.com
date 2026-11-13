import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_USER_SORT_FIELDS,
  Role,
  type AdminUserSortField,
  type SortOrder,
} from '@tsyvinda/shared-types';
import { trimToUndefined } from '../../shared/dto-transforms';
import { UserDto } from '../../modules/auth/dto/user.response';
import { ApiImageFile } from '../../shared/swagger/api-image-file.decorator';

export class AdminListUsersQueryDto {
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

  @ApiPropertyOptional({ enum: ADMIN_USER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(ADMIN_USER_SORT_FIELDS)
  sort: AdminUserSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: SortOrder = 'DESC';

  @ApiPropertyOptional({
    description: 'Case-insensitive match on first name, last name, full name or email',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

// Multipart sends every field as a string.
const toBoolean = ({ value }: TransformFnParams): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/** At least one of role / image / removeImage (checked in the controller). */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({
    enum: Role,
    enumName: 'Role',
    description: 'You cannot demote yourself, and the last admin cannot be demoted',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Drop the profile image (ignored when a new image is sent)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeImage?: boolean;

  @ApiImageFile()
  image?: Express.Multer.File;
}

export class AdminUserDto extends UserDto {
  @ApiProperty({ description: 'Posts authored; users with posts cannot be deleted' })
  postCount: number;
}

export class AdminUserListDto {
  @ApiProperty({ type: [AdminUserDto] })
  items: AdminUserDto[];

  @ApiProperty()
  total: number;
}
