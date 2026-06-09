import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Disk location + public URL prefix for post images. The multer config itself
// lives in `src/shared/upload-options.ts` (used by FileInterceptor).
export const UPLOAD_DIR = path.resolve('uploads/posts');
export const POST_IMAGE_URL_PREFIX = '/uploads/posts';

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}
