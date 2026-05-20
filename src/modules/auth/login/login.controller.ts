import type { Request, Response } from 'express';
import { authService } from '../auth.service';
import { clientIp, clientUserAgent, setSessionCookies } from '../cookies';
import type { LoginBody } from './login.schema';

export async function loginController(req: Request, res: Response): Promise<void> {
  const body = req.body as LoginBody;
  const session = await authService.login({
    email: body.email,
    password: body.password,
    userAgent: clientUserAgent(req),
    ip: clientIp(req),
  });
  setSessionCookies(res, session);
  res.status(200).json({ user: session.user });
}
