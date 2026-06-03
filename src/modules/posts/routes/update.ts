import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../auth/middleware/is-authenticated';
import { requireApproved } from '../../auth/middleware/requires-approval';
import { asyncHandler } from '../../../shared/async-handler';
import { cleanupUploadOnError } from '../../../shared/cleanup-upload';
import { HttpError } from '../../../shared/http-error';
import { config } from '../../../shared/app.config';
import { validate } from '../../../shared/validate';
import { updatePostSchema, type UpdatePostBody } from '../entities/post.schema';
import { postService } from '../services/post.service';
import { POST_IMAGE_URL_PREFIX, postImageUpload } from '../shared/upload';

const router = Router();

async function updatePostController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }

  const id = req.params.id as string;
  const body = req.body as UpdatePostBody;
  const file = req.file;

  if (
    body.title === undefined &&
    body.slug === undefined &&
    body.description === undefined &&
    body.htmlContent === undefined &&
    !file
  ) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'At least one field is required');
  }

  const imageUrl: string | undefined = file
    ? `https://${config.backendHost}${POST_IMAGE_URL_PREFIX}/${file.filename}`
    : undefined;

  const post = await postService.update(id, req.user.id, {
    title: body.title,
    slug: body.slug,
    description: body.description,
    htmlContent: body.htmlContent,
    imageUrl,
  });
  res.status(200).json(post);
}

/**
 * @openapi
 * /posts/{id}:
 *   patch:
 *     summary: Update a post (author only)
 *     tags: [Posts]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               slug:
 *                 type: string
 *                 maxLength: 200
 *                 pattern: '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
 *                 description: Unique URL-safe identifier (lowercase, hyphens)
 *               description: { type: string, maxLength: 500 }
 *               htmlContent: { type: string, maxLength: 100000 }
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Post image (jpeg, png, webp, max 5MB). Uploading replaces the previous image, previous file deleted automatically.
 *     responses:
 *       200:
 *         description: Updated post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       403:
 *         description: Caller is not the author
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Slug already in use
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       413:
 *         description: Uploaded image exceeds size limit
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.patch(
  '/:id',
  requireAuth,
  requireApproved,
  postImageUpload,
  cleanupUploadOnError,
  validate({ body: updatePostSchema }),
  asyncHandler(updatePostController),
);

export default router;
