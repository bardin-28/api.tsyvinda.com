import { unlink } from 'fs/promises';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

// Deletes any multer-uploaded file(s) if the response ends with an error status.
// Ports `cleanup-upload.ts`; attach BEFORE the handler so the listeners are bound
// regardless of how the handler resolves.
@Injectable()
export class CleanupUploadInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    res.on('finish', () => {
      void cleanup(req, res);
    });
    res.on('close', () => {
      if (!res.writableEnded) void cleanup(req, res);
    });

    return next.handle();
  }
}

async function cleanup(req: Request, res: Response): Promise<void> {
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
}

async function safeUnlink(p: string): Promise<void> {
  try {
    await unlink(p);
  } catch {
    // best-effort
  }
}
