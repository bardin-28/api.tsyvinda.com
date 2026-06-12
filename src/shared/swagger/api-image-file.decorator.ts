import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Documents an optional single `image` upload field on a multipart/form-data route
// so Swagger UI renders a file picker. The file is handled by `FileInterceptor` +
// `@UploadedFile()`, not the DTO body (whitelist strips it) — this is Swagger
// documentation only.
export function ApiImageFile() {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'string',
      format: 'binary',
      description: 'Image file (jpeg, png, or webp; max 5MB).',
    }),
  );
}
