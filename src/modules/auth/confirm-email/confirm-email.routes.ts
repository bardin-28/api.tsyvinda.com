import { Router } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { validate } from '../../../shared/validate';
import { confirmEmailController } from './confirm-email.controller';
import { confirmEmailBodySchema } from './confirm-email.schema';

const router = Router();

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
router.post(
  '/',
  validate({ body: confirmEmailBodySchema }),
  asyncHandler(confirmEmailController),
);

export default router;
