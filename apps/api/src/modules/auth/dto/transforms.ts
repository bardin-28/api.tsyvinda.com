import type { TransformFnParams } from 'class-transformer';

// Mirrors the zod email pipeline: trim + lowercase before validation.
export const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Mirrors zod `.trim()` on free-text fields.
export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
