import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../auth/middleware/is-authenticated';
import { requireApproved } from '../../auth/middleware/requires-approval';
import { asyncHandler } from '../../../shared/async-handler';
import { HttpError } from '../../../shared/http-error';
import { postService } from '../services/post.service';

const router = Router();

async function deletePostController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }
  const id = req.params.id as string;
  await postService.remove(id, req.user.id);
  res.status(204).end();
}

/**
 * @openapi
 * /posts/{id}:
 *   delete:
 *     summary: Delete a post (author only)
 *     tags: [Posts]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       403:
 *         description: Caller is not the author
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', requireAuth, requireApproved, asyncHandler(deletePostController));

export default router;
