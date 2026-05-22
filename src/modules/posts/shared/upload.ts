import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../../../shared/http-error';

export const UPLOAD_DIR = path.resolve('uploads/posts');
export const POST_IMAGE_URL_PREFIX = '/uploads/posts';
const MAX_SIZE = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype];
    cb(null, `${randomUUID()}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!(file.mimetype in EXT_BY_MIME)) {
      cb(new HttpError(400, 'INVALID_FILE_TYPE', 'Only jpeg, png, webp are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('image');

export function postImageUpload(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new HttpError(413, 'FILE_TOO_LARGE', 'Image exceeds 5MB limit'));
        return;
      }
      next(new HttpError(400, 'UPLOAD_ERROR', err.message));
      return;
    }
    next(err);
  });
}
