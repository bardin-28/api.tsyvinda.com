import type { Post } from '@tsyvinda/shared-types';

/** The cover image as the form holds it: kept URL, newly picked file, or removed. */
type CoverValue = string | { rawFile: File; src?: string } | null | undefined;

export interface PostFormValues {
  title: string;
  slug: string;
  description?: string | null;
  htmlContent: string;
  imageUrl?: CoverValue;
}

const isPicked = (value: CoverValue): value is { rawFile: File } =>
  typeof value === 'object' && value !== null && value.rawFile instanceof File;

/**
 * Form values → API body. A picked cover goes out as `image` (multipart via the dataProvider);
 * a removed one as `removeImage`; read-only fields (author, dates) never leave the form.
 */
export function toPostPayload(
  values: PostFormValues,
  previous?: Pick<Post, 'imageUrl'>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: values.title,
    slug: values.slug,
    description: values.description ?? '',
    htmlContent: values.htmlContent,
  };
  if (isPicked(values.imageUrl)) payload.image = values.imageUrl;
  else if (!values.imageUrl && previous?.imageUrl) payload.removeImage = true;
  return payload;
}
