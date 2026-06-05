import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { buildRateLimiter } from '../../../shared/rate-limit';
import { validate } from '../../../shared/validate';
import { requireTurnstile } from '../../../shared/turnstile/turnstile.middleware';
import { forgotPasswordBodySchema, type ForgotPasswordBody } from '../entities/auth.schema';
import { authService } from '../services/auth.service';

const router = Router();
const limiter = buildRateLimiter({ windowMs: 60_000, limit: 5 }, 'rl:auth:forgot-password:');

const GENERIC_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  const body = req.body as ForgotPasswordBody;
  await authService.requestPasswordReset(body.email);
  // Always respond identically to avoid leaking whether the email is registered.
  res.status(200).json({ message: GENERIC_MESSAGE });
}

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link for an email address
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Generic acknowledgement (sent whether or not the email exists)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post(
  '/',
  limiter,
  requireTurnstile,
  validate({ body: forgotPasswordBodySchema }),
  asyncHandler(forgotPasswordController),
);

export default router;
