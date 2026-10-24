import type { TransformFnParams } from 'class-transformer';

// Mirrors zod `.trim()` on free-text string fields.
export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Trims, then collapses an empty/whitespace-only string to `undefined` so
// `@IsOptional()` skips it. Needed for multipart PATCH where clients send blank
// text fields alongside an image — without this they'd fail `@Length`/`@Matches`.
export const trimToUndefined = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};
