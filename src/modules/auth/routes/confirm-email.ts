import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { validate } from '../../../shared/validate';
import { confirmEmailBodySchema, type ConfirmEmailBody } from '../entities/auth.schema';
import { authService } from '../services/auth.service';

const router = Router();

async function confirmEmailController(req: Request, res: Response): Promise<void> {
  const body = req.body as ConfirmEmailBody;
  await authService.confirmEmail(body.token);
  res.status(200).json({ message: 'Email confirmed.' });
}

/**
 * @openapi
 * /auth/confirm-email:
 *   post:
 *     summary: Confirm a user's email with the token from the verification link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, minLength: 32 }
 *     responses:
 *       200:
 *         description: Email confirmed
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/', validate({ body: confirmEmailBodySchema }), asyncHandler(confirmEmailController));

export default router;
