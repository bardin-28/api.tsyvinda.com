import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../../shared/async-handler';
import { validate } from '../../../shared/validate';
import { listQuerySchema, type ListPostsQuery } from '../entities/post.schema';
import { postService } from '../services/post.service';

const router = Router();

async function listPostsController(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListPostsQuery;
  const result = await postService.list({ limit: query.limit, cursor: query.cursor });
  res.status(200).json(result);
}

/**
 * @openapi
 * /posts:
 *   get:
 *     summary: List posts (cursor-paginated, newest first)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Opaque cursor returned by a previous call as `nextCursor`.
 *     responses:
 *       200:
 *         description: Paginated list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostList'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/', validate({ query: listQuerySchema }), asyncHandler(listPostsController));

export default router;
