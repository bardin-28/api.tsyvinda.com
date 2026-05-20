import type { Request, Response } from 'express';
import { authService } from '../auth.service';
import type { ConfirmEmailBody } from './confirm-email.schema';

export async function confirmEmailController(req: Request, res: Response): Promise<void> {
  const body = req.body as ConfirmEmailBody;
  await authService.confirmEmail(body.token);
  res.status(200).json({ message: 'Email confirmed.' });
}
