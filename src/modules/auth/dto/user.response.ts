import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ format: 'email' })
  email: string;

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
