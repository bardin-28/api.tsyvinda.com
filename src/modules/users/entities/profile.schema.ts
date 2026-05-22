import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
