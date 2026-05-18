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
 *         headers:
 *           x-request-id:
 *             description: Correlation ID (echoed or generated)
 *             schema:
 *               type: string
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
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
const router = Router();
router.get('/', healthCheck);

export default router;
