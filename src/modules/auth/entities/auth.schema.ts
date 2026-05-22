import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(255).pipe(z.string().email());

export const passwordSchema = z
  .string()
  .min(8, 'password must be at least 8 chars')
  .max(72, 'password too long')
  .regex(/[A-Za-z]/, 'password must contain a letter')
  .regex(/[0-9]/, 'password must contain a digit');

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

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

export const confirmEmailBodySchema = z.object({
  token: z.string().min(32).max(128),
});
export type ConfirmEmailBody = z.infer<typeof confirmEmailBodySchema>;
