import { z } from 'zod';
import { emailSchema } from '../schemas.shared';

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
