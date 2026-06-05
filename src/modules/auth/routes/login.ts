import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { buildRateLimiter } from '../../../shared/rate-limit';
import { validate } from '../../../shared/validate';
import { requireTurnstile } from '../../../shared/turnstile/turnstile.middleware';
import { loginBodySchema, type LoginBody } from '../entities/auth.schema';
import { authService } from '../services/auth.service';
import { clientIp, clientUserAgent, setSessionCookies } from '../shared/auth.utils';

const router = Router();
const limiter = buildRateLimiter({ windowMs: 60_000, limit: 10 }, 'rl:auth:login:');

async function loginController(req: Request, res: Response): Promise<void> {
  const body = req.body as LoginBody;
  const session = await authService.login({
    email: body.email,
    password: body.password,
    userAgent: clientUserAgent(req),
    ip: clientIp(req),
  });
  setSessionCookies(res, session);
  res.status(200).json({ user: session.user });
}

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
router.post(
  '/',
  limiter,
  requireTurnstile,
  validate({ body: loginBodySchema }),
  asyncHandler(loginController),
);

export default router;
