import { Router } from 'express';
import { healthCheck } from './health.controller';

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 db:
 *                   type: boolean
 *                 redis:
 *                   type: boolean
 */
const router = Router();
router.get('/', healthCheck);

export default router;
