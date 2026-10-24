import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@tsyvinda/shared-types';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @ApiProperty({ required: false, nullable: true })
  profileImageUrl: string | null;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  approvedByAdmin: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class AuthLoginResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}
