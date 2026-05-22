import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { postService } from '../services/post.service';

const router = Router();

async function getPostController(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const post = await postService.getById(id);
  res.status(200).json(post);
}

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     summary: Get a single post by id
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
router.get('/:id', asyncHandler(getPostController));

export default router;
