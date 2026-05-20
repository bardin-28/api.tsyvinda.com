import type { Request, Response } from 'express';
import { authService } from '../auth.service';
import { clearSessionCookies, readRefreshCookie } from '../cookies';

export async function logoutController(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  clearSessionCookies(res);
  res.status(204).end();
}
