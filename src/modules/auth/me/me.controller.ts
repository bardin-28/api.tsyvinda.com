import type { Request, Response } from 'express';
import { HttpError } from '../../../shared/http-error';
import { authService } from '../auth.service';

export async function meController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }
  const profile = await authService.getProfile(req.user.id);
  res.status(200).json(profile);
}
