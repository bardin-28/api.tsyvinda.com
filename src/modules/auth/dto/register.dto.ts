import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { IsMatch } from '../../../shared/validators/is-match.validator';
import { ApiTurnstileToken } from '../../../shared/turnstile/turnstile-api.decorator';
import { normalizeEmail, trimString } from './transforms';

export class RegisterDto {
  @ApiProperty({ maxLength: 50 })
  @Transform(trimString)
  @IsString()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({ maxLength: 50 })
  @Transform(trimString)
  @IsString()
  @Length(1, 50)
  lastName: string;

  @ApiProperty({ format: 'email', maxLength: 255 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  @Matches(/[A-Za-z]/, { message: 'password must contain a letter' })
  @Matches(/[0-9]/, { message: 'password must contain a digit' })
  password: string;

  @ApiProperty()
  @IsString()
  @IsMatch('password', { message: 'passwords do not match' })
  confirmPassword: string;

  @ApiTurnstileToken()
  'cf-turnstile-response': string;
}
