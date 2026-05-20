import { Router } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { buildRateLimiter } from '../../../shared/rate-limit';
import { validate } from '../../../shared/validate';
import { loginController } from './login.controller';
import { loginBodySchema } from './login.schema';

const router = Router();
const limiter = buildRateLimiter({ windowMs: 60_000, limit: 10 }, 'rl:auth:login:');

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Authenticated. Access + refresh tokens issued as httpOnly cookies (`access`, `refresh`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       401:
 *         description: Invalid credentials
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       403:
 *         description: Email not verified
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.post('/', limiter, validate({ body: loginBodySchema }), asyncHandler(loginController));

export default router;
