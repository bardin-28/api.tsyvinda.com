import { Router } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { logoutController } from './logout.controller';

const router = Router();

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
