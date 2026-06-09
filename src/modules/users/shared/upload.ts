import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Disk location + public URL prefix for profile images. The multer config itself
// lives in `src/shared/upload-options.ts` (used by FileInterceptor).
export const UPLOAD_DIR = path.resolve('uploads/profile');
export const PROFILE_IMAGE_URL_PREFIX = '/uploads/profile';

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}
