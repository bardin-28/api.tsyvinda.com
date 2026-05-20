import { z } from 'zod';

export const confirmEmailBodySchema = z.object({
  token: z.string().min(32).max(128),
});

export type ConfirmEmailBody = z.infer<typeof confirmEmailBodySchema>;
