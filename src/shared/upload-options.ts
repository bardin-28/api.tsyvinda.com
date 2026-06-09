import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { HttpError } from './http-error';

const MAX_SIZE = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// multer options for a single `image` field, shared by the profile and post
// upload routes. Pass to `FileInterceptor('image', imageUploadOptions(dir))`.
// MulterError (size) and the HttpError passed to fileFilter propagate to the
// global exception filter, which maps them to 413/400.
export function imageUploadOptions(uploadDir: string): MulterOptions {
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => cb(null, `${randomUUID()}.${EXT_BY_MIME[file.mimetype]}`),
    }),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!(file.mimetype in EXT_BY_MIME)) {
        cb(new HttpError(400, 'INVALID_FILE_TYPE', 'Only jpeg, png, webp are allowed'), false);
        return;
      }
      cb(null, true);
    },
  };
}
