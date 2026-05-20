import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(255).pipe(z.string().email());

export const passwordSchema = z
  .string()
  .min(8, 'password must be at least 8 chars')
  .max(72, 'password too long')
  .regex(/[A-Za-z]/, 'password must contain a letter')
  .regex(/[0-9]/, 'password must contain a digit');
