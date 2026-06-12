import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { HttpError } from './http-error';

const MAX_SIZE = 5 * 1024 * 1024;

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// File extension for a validated image mimetype. Throws if unknown (the upload
// fileFilter already rejects others — this is a belt-and-braces guard).
export function extForMime(mimetype: string): string {
  const ext = EXT_BY_MIME[mimetype];
  if (!ext) {
    throw new HttpError(400, 'INVALID_FILE_TYPE', 'Only jpeg, png, webp are allowed');
  }
  return ext;
}

const imageFileFilter: NonNullable<MulterOptions['fileFilter']> = (_req, file, cb) => {
  if (!(file.mimetype in EXT_BY_MIME)) {
    cb(new HttpError(400, 'INVALID_FILE_TYPE', 'Only jpeg, png, webp are allowed'), false);
    return;
  }
  cb(null, true);
};

// In-memory single-`image` upload (file.buffer) for routes that stream the buffer
// straight to S3. No disk write, no filename — the handler builds the object key.
// MulterError (size) and the HttpError passed to fileFilter propagate to the
// global exception filter, which maps them to 413/400.
export function imageUploadMemoryOptions(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: imageFileFilter,
  };
}
