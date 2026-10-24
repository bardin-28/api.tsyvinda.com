// Lowercase alphanumeric with hyphens, no leading/trailing hyphen. Mirrors the
// zod slugSchema regex.
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const SLUG_MESSAGE =
  'Slug must be lowercase alphanumeric with hyphens (no leading/trailing hyphen)';
