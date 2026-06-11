import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { ApiTurnstileToken } from '../../../shared/turnstile/turnstile-api.decorator';
import { normalizeEmail } from './transforms';

export class ForgotPasswordDto {
  @ApiProperty({ format: 'email' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiTurnstileToken()
  'cf-turnstile-response': string;
}
