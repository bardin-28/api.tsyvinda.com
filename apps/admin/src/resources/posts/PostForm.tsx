import React, { useEffect } from 'react';
import { ImageField, ImageInput, SimpleForm, TextInput, required, maxLength } from 'react-admin';
import { useFormContext, useWatch } from 'react-hook-form';
import { Box } from '@mui/material';
import { HtmlEditorInput } from '../../components/HtmlEditorInput';
import { slugify } from './slugify';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const slugFormat = (value: string) =>
  value && !SLUG_PATTERN.test(value)
    ? 'Lowercase letters, digits and inner hyphens only (e.g. my-first-post)'
    : undefined;

/** On create, keeps the slug following the title until the editor types a slug themselves. */
const SlugFromTitle: React.FC = () => {
  const title = useWatch({ name: 'title' }) as string | undefined;
  const { setValue, getFieldState } = useFormContext();

  useEffect(() => {
    if (!getFieldState('slug').isDirty) {
      setValue('slug', slugify(title ?? ''), { shouldValidate: !!title });
    }
  }, [title, setValue, getFieldState]);

  return null;
};

// TipTap's empty document is `<p></p>`, which `required()` would accept.
export const htmlContentRequired = (values: { htmlContent?: string }) => {
  const text = (values.htmlContent ?? '').replace(/<[^>]*>/g, '').trim();
  const hasMedia = /<(img|iframe|video|hr)\b/i.test(values.htmlContent ?? '');
  return text || hasMedia ? {} : { htmlContent: 'Content is required' };
};

// Existing posts carry the cover as a URL string; ImageInput previews `{ src }`.
const formatCover = (value: unknown) => (typeof value === 'string' ? { src: value } : value);

export const PostForm: React.FC<{ autoSlug?: boolean; toolbar?: React.ReactElement | false }> = ({
  autoSlug = false,
  toolbar,
}) => (
  <SimpleForm toolbar={toolbar} validate={htmlContentRequired}>
    {autoSlug && <SlugFromTitle />}
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: '2fr 1fr' }, width: '100%' }}>
      <TextInput source="title" validate={[required(), maxLength(200)]} />
      <TextInput
        source="slug"
        validate={[required(), maxLength(200), slugFormat]}
        helperText="Part of the post URL: /blog/<slug>"
      />
    </Box>
    <TextInput
      source="description"
      multiline
      minRows={2}
      validate={maxLength(500)}
      helperText="Short summary for the blog list and search engines"
    />
    <ImageInput
      source="imageUrl"
      label="Cover image"
      accept={{ 'image/jpeg': [], 'image/png': [], 'image/webp': [] }}
      maxSize={5 * 1024 * 1024}
      format={formatCover}
      helperText="JPEG, PNG or WebP, up to 5 MB"
    >
      <ImageField source="src" title="title" />
    </ImageInput>
    <HtmlEditorInput source="htmlContent" label="Content" />
  </SimpleForm>
);
