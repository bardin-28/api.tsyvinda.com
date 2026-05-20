import { Router } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { refreshController } from './refresh.controller';

const router = Router();

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
