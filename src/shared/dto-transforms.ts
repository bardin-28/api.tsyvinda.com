import type { TransformFnParams } from 'class-transformer';

// Mirrors zod `.trim()` on free-text string fields.
export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
