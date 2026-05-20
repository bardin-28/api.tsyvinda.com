import { Router } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { requireAuth } from '../auth.middleware';
import { meController } from './me.controller';

const router = Router();

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
