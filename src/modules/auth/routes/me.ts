import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { HttpError } from '../../../shared/http-error';
import { requireAuth } from '../middleware/is-authenticated';
import { authService } from '../services/auth.service';

const router = Router();

async function meController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }
  const profile = await authService.getProfile(req.user.id);
  res.status(200).json(profile);
}

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.get('/', requireAuth, asyncHandler(meController));

export default router;
