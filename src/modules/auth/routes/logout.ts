import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { authService } from '../services/auth.service';
import { clearSessionCookies, readRefreshCookie } from '../shared/auth.utils';

const router = Router();

async function logoutController(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  clearSessionCookies(res);
  res.status(204).end();
}

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke current refresh token and clear cookie
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Logged out
 */
router.post('/', asyncHandler(logoutController));

export default router;
