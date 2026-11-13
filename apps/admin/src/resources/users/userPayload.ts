import type { AdminUser, Role } from '@tsyvinda/shared-types';

/** The avatar as the form holds it: kept URL, newly picked file, or removed. */
type AvatarValue = string | { rawFile: File; src?: string } | null | undefined;

export interface UserFormValues {
  role: Role;
  profileImageUrl?: AvatarValue;
}

const isPicked = (value: AvatarValue): value is { rawFile: File } =>
  typeof value === 'object' && value !== null && value.rawFile instanceof File;

/**
 * Form values → `PATCH /admin/users/:id` body. A picked avatar goes out as `image` (multipart via
 * the dataProvider); a removed one as `removeImage`; read-only fields never leave the form.
 */
export function toUserPayload(
  values: UserFormValues,
  previous?: Pick<AdminUser, 'profileImageUrl'>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { role: values.role };
  if (isPicked(values.profileImageUrl)) payload.image = values.profileImageUrl;
  else if (!values.profileImageUrl && previous?.profileImageUrl) payload.removeImage = true;
  return payload;
}
