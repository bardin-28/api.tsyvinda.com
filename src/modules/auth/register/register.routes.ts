import { Router } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { buildRateLimiter } from '../../../shared/rate-limit';
import { validate } from '../../../shared/validate';
import { registerController } from './register.controller';
import { registerBodySchema } from './register.schema';

const router = Router();
const limiter = buildRateLimiter({ windowMs: 60_000, limit: 10 }, 'rl:auth:register:');

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password, confirmPassword]
 *             properties:
 *               firstName: { type: string, maxLength: 50 }
 *               lastName: { type: string, maxLength: 50 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8, maxLength: 72 }
 *               confirmPassword: { type: string }
 *     responses:
 *       201:
 *         description: Verification email sent
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Email already registered
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.post('/', limiter, validate({ body: registerBodySchema }), asyncHandler(registerController));

export default router;
