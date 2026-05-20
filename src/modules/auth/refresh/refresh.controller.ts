import type { Request, Response } from 'express';
import { HttpError } from '../../../shared/http-error';
import { authService } from '../auth.service';
import { clientIp, clientUserAgent, readRefreshCookie, setSessionCookies } from '../cookies';

export async function refreshController(req: Request, res: Response): Promise<void> {
  const rawRefresh = readRefreshCookie(req);
  if (!rawRefresh) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing refresh cookie');
  }
  const session = await authService.rotateRefresh({
    rawRefresh,
    userAgent: clientUserAgent(req),
    ip: clientIp(req),
  });
  setSessionCookies(res, session);
  res.status(200).json({ user: session.user });
}
