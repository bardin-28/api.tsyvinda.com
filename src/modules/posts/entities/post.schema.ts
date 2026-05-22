import { z } from 'zod';

const MAX_HTML = 100_000;

export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  htmlContent: z.string().min(1).max(MAX_HTML),
});
export type CreatePostBody = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).optional(),
  htmlContent: z.string().min(1).max(MAX_HTML).optional(),
});
export type UpdatePostBody = z.infer<typeof updatePostSchema>;

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).optional(),
});
export type ListPostsQuery = z.infer<typeof listQuerySchema>;
