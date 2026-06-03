import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../auth/middleware/is-authenticated';
import { requireApproved } from '../../auth/middleware/requires-approval';
import { asyncHandler } from '../../../shared/async-handler';
import { cleanupUploadOnError } from '../../../shared/cleanup-upload';
import { HttpError } from '../../../shared/http-error';
import { config } from '../../../shared/app.config';
import { validate } from '../../../shared/validate';
import { createPostSchema, type CreatePostBody } from '../entities/post.schema';
import { postService } from '../services/post.service';
import { POST_IMAGE_URL_PREFIX, postImageUpload } from '../shared/upload';

const router = Router();

async function createPostController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }

  const body = req.body as CreatePostBody;
  const file = req.file;
  const imageUrl = file
    ? `https://${config.backendHost}${POST_IMAGE_URL_PREFIX}/${file.filename}`
    : null;

  const post = await postService.create(req.user.id, {
    title: body.title,
    slug: body.slug,
    description: body.description,
    htmlContent: body.htmlContent,
    imageUrl,
  });
  res.status(201).json(post);
}

/**
 * @openapi
 * /posts:
 *   post:
 *     summary: Create a new post (authenticated)
 *     tags: [Posts]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, slug, htmlContent]
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
 *                 description: Post image (jpeg, png, webp, max 5MB)
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       409:
 *         description: Slug already in use
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       413:
 *         description: Uploaded image exceeds size limit
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
router.post(
  '/',
  requireAuth,
  requireApproved,
  postImageUpload,
  cleanupUploadOnError,
  validate({ body: createPostSchema }),
  asyncHandler(createPostController),
);

export default router;
