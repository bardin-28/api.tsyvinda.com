import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { HttpError } from '../../../shared/http-error';
import { authService } from '../services/auth.service';
import { clientIp, clientUserAgent, readRefreshCookie, setSessionCookies } from '../shared/auth.utils';

const router = Router();

async function refreshController(req: Request, res: Response): Promise<void> {
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

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate refresh + access tokens
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New session issued. Both `access` and `refresh` cookies rotated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       401:
 *         description: Missing/invalid refresh
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.post('/', asyncHandler(refreshController));

export default router;
