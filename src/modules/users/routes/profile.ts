import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../auth/middleware/is-authenticated';
import { asyncHandler } from '../../../shared/async-handler';
import { cleanupUploadOnError } from '../../../shared/cleanup-upload';
import { HttpError } from '../../../shared/http-error';
import { config } from '../../../shared/app.config';
import { validate } from '../../../shared/validate';
import { requireTurnstile } from '../../../shared/turnstile/turnstile.middleware';
import { updateProfileSchema, type UpdateProfileBody } from '../entities/profile.schema';
import { profileService } from '../services/profile.service';
import { PROFILE_IMAGE_URL_PREFIX, profileImageUpload } from '../shared/upload';

const router = Router();

async function getProfileController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }
  const profile = await profileService.get(req.user.id);
  res.status(200).json(profile);
}

async function patchProfileController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }

  const body = req.body as UpdateProfileBody;
  const file = req.file;
  const wantsRemove = body.removeImage === 'true';

  if (file && wantsRemove) {
    throw new HttpError(
      400,
      'VALIDATION_FAILED',
      'Cannot upload and remove image at the same time',
    );
  }

  if (body.firstName === undefined && body.lastName === undefined && !file && !wantsRemove) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
  }

  let profileImageUrl: string | null | undefined;
  if (file) {
    profileImageUrl = `https://${config.backendHost}${PROFILE_IMAGE_URL_PREFIX}/${file.filename}`;
  } else if (wantsRemove) {
    profileImageUrl = null;
  }

  const profile = await profileService.update(req.user.id, {
    firstName: body.firstName,
    lastName: body.lastName,
    profileImageUrl,
  });
  res.status(200).json(profile);
}

/**
 * @openapi
 * /profile:
 *   get:
 *     summary: Get current authenticated user's profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.get('/', requireAuth, asyncHandler(getProfileController));

/**
 * @openapi
 * /profile:
 *   patch:
 *     summary: Update current user's profile (firstName, lastName, profile image)
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, maxLength: 50 }
 *               lastName: { type: string, maxLength: 50 }
 *               removeImage:
 *                 type: string
 *                 enum: [true]
 *                 description: Set to "true" to clear the existing image without uploading a new one.
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile image (jpeg, png, webp, max 5MB). Mutually exclusive with `removeImage`.
 *     responses:
 *       200:
 *         description: Updated profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       413:
 *         description: Uploaded image exceeds size limit
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.patch(
  '/',
  requireAuth,
  profileImageUpload,
  cleanupUploadOnError,
  requireTurnstile,
  validate({ body: updateProfileSchema }),
  asyncHandler(patchProfileController),
);

export default router;
