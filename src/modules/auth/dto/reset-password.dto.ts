import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { IsMatch } from '../../../shared/validators/is-match.validator';
import { ApiTurnstileToken } from '../../../shared/turnstile/turnstile-api.decorator';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 32, maxLength: 128 })
  @IsString()
  @Length(32, 128)
  token: string;

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
