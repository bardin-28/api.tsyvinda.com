import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { buildRateLimiter } from '../../../shared/rate-limit';
import { validate } from '../../../shared/validate';
import { resetPasswordBodySchema, type ResetPasswordBody } from '../entities/auth.schema';
import { authService } from '../services/auth.service';

const router = Router();
const limiter = buildRateLimiter({ windowMs: 60_000, limit: 10 }, 'rl:auth:reset-password:');

async function resetPasswordController(req: Request, res: Response): Promise<void> {
  const body = req.body as ResetPasswordBody;
  await authService.resetPassword(body.token, body.password);
  res.status(200).json({ message: 'Password updated. You can now sign in with your new password.' });
}

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password using the token from the reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password, confirmPassword]
 *             properties:
 *               token: { type: string, minLength: 32 }
 *               password: { type: string, minLength: 8, maxLength: 72 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post(
  '/',
  limiter,
  validate({ body: resetPasswordBodySchema }),
  asyncHandler(resetPasswordController),
);

export default router;
