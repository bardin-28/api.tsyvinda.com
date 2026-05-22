import { unlink } from 'fs/promises';
import type { NextFunction, Request, Response } from 'express';

export function cleanupUploadOnError(req: Request, res: Response, next: NextFunction): void {
  const cleanup = async (): Promise<void> => {
    if (res.statusCode < 400) return;
    const single = req.file;
    if (single?.path) {
      await safeUnlink(single.path);
    }
    const multi = req.files;
    if (Array.isArray(multi)) {
      await Promise.all(multi.map((f) => safeUnlink(f.path)));
    } else if (multi && typeof multi === 'object') {
      for (const arr of Object.values(multi)) {
        await Promise.all(arr.map((f) => safeUnlink(f.path)));
      }
    }
  };

  res.on('finish', () => {
    void cleanup();
  });
  res.on('close', () => {
    if (!res.writableEnded) void cleanup();
  });

  next();
}

async function safeUnlink(p: string): Promise<void> {
  try {
    await unlink(p);
  } catch {
    // best-effort
  }
}
