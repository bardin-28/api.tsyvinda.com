import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { postService } from '../services/post.service';

const router = Router();

async function getPostController(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug as string;
  const post = await postService.getBySlug(slug);
  res.status(200).json(post);
}

/**
 * @openapi
 * /posts/{slug}:
 *   get:
 *     summary: Get a single post by slug
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, maxLength: 200 }
 *     responses:
 *       200:
 *         description: Post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:slug', asyncHandler(getPostController));

export default router;
