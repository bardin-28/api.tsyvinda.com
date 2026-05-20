import { z } from 'zod';
import { emailSchema, passwordSchema } from '../schemas.shared';

export const registerBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'passwords do not match',
      });
    }
  });

export type RegisterBody = z.infer<typeof registerBodySchema>;
