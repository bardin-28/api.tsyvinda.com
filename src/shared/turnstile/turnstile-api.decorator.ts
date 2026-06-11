import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { TURNSTILE_TOKEN_FIELD } from './constants';

// Documents the Cloudflare Turnstile token field (`cf-turnstile-response`) that
// `TurnstileInterceptor` requires on protected routes. The interceptor reads the
// token from the body and removes it before the ValidationPipe runs, so the field
// carries no class-validator rules — this decorator exists purely to surface the
// required field in the Swagger request schema.
export function ApiTurnstileToken() {
  return applyDecorators(
    ApiProperty({
      name: TURNSTILE_TOKEN_FIELD,
      type: String,
      required: true,
      description:
        'Cloudflare Turnstile token. Required unless the configured bypass token is sent.',
      example: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
  );
}
