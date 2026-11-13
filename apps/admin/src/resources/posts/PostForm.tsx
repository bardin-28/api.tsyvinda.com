import React, { useEffect, useState } from 'react';
import {
  Form,
  ImageField,
  TextInput,
  maxLength,
  required,
  useInput,
  useRecordContext,
} from 'react-admin';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { HtmlEditorInput } from '../../components/HtmlEditorInput';
import { DetailLayout } from '../../components/DetailLayout';
import { SingleImageInput } from '../../components/SingleImageInput';
import { slugify } from './slugify';
import { USE_COVER_AS_OG_FIELD } from './postPayload';
import { MissingTranslationNotice, UnsavedChangesReporter } from '../../components/Translations';
import { useContentLocale } from '../../lib/contentLocale';
import { DEFAULT_LOCALE } from '@tsyvinda/shared-types';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const slugFormat = (value: string) =>
  value && !SLUG_PATTERN.test(value)
    ? 'Lowercase letters, digits and inner hyphens only (e.g. my-first-post)'
    : undefined;

const URL_PATTERN = /^https?:\/\/\S+$/i;
const httpUrl = (value: string) =>
  value && !URL_PATTERN.test(value.trim()) ? 'A full URL starting with https://' : undefined;

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

// Existing posts carry images as URL strings; ImageInput previews `{ src }`.
const formatImage = (value: unknown) => (typeof value === 'string' ? { src: value } : value);
const IMAGE_TYPES = { 'image/jpeg': [], 'image/png': [], 'image/webp': [] };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Titled, bordered group inside a tab (like the reference's "Cover image" box). */
const FieldGroup: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Box
    component="section"
    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mt: 1 }}
  >
    <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" component="h3" sx={{ color: 'text.secondary', mt: 1 }}>
    {children}
  </Typography>
);

/** Live public path of this language: its own URL segment, else the shared one. */
const SlugPreview: React.FC = () => {
  const slug = useWatch({ name: 'slug' }) as string | undefined;
  const localizedSlug = useWatch({ name: 'localizedSlug' }) as string | null | undefined;
  const locale = useContentLocale();
  // English is unprefixed on the website, other languages live under /<locale>
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', px: 1.75, mt: -0.5 }}>
      {prefix}/blog/{localizedSlug || slug || '…'}
    </Typography>
  );
};

/** This language's own URL segment, with a button that transliterates the title into it. */
const LocalizedSlugInput: React.FC = () => {
  const { setValue } = useFormContext();
  const title = useWatch({ name: 'title' }) as string | undefined;
  const slug = useWatch({ name: 'slug' }) as string | undefined;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <TextInput
        source="localizedSlug"
        label="URL in this language"
        validate={[maxLength(200), slugFormat]}
        helperText={`Empty: the shared URL (${slug || '…'}). Old addresses redirect here.`}
        sx={{ flex: 1 }}
      />
      <Button
        variant="outlined"
        size="small"
        disabled={!title}
        onClick={() =>
          setValue('localizedSlug', slugify(title ?? ''), {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        sx={{ mt: 1.25, whiteSpace: 'nowrap' }}
      >
        From title
      </Button>
    </Stack>
  );
};

/** Stored as a list, edited as one comma-separated line. */
const formatKeywords = (value: unknown): string =>
  Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';

const ContentTab: React.FC = () => (
  <>
    <SectionLabel>Article</SectionLabel>
    <TextInput source="title" label="Title" validate={[required(), maxLength(200)]} />
    <TextInput
      source="description"
      label="Lead"
      multiline
      minRows={2}
      validate={maxLength(500)}
      helperText="Under the title and on the blog cards"
    />
    <FieldGroup title="Cover image">
      <SingleImageInput
        source="imageUrl"
        accept={IMAGE_TYPES}
        maxSize={MAX_IMAGE_BYTES}
        format={formatImage}
        helperText="JPEG, PNG or WebP, up to 5 MB · recommended ≥ 1280 px wide. Hero image; cards show the same."
      >
        <ImageField source="src" title="title" />
      </SingleImageInput>
      <TextInput
        source="coverAlt"
        label="Alt text"
        validate={maxLength(300)}
        helperText="Describe the image for screen readers and search engines"
      />
    </FieldGroup>
    <Box sx={{ mt: 1 }}>
      <HtmlEditorInput source="htmlContent" label="Body" />
    </Box>
  </>
);

/**
 * OG (social sharing) image: by default the cover is used; unticking the box reveals an upload
 * for a dedicated 1200×630 image. The box starts unticked only when the post already has one.
 */
const OgImageFields: React.FC = () => {
  const { field } = useInput({ source: USE_COVER_AS_OG_FIELD });
  const ogImageUrl = useWatch({ name: 'ogImageUrl' }) as unknown;
  const record = useRecordContext<{ ogImageUrl?: string | null }>();
  // Untouched: follow what is stored (no own OG image = the cover is used)
  const useCover = typeof field.value === 'boolean' ? field.value : !record?.ogImageUrl;

  return (
    <>
      <FormControlLabel
        control={
          <Checkbox
            checked={useCover}
            onChange={(event) => field.onChange(event.target.checked)}
            size="small"
          />
        }
        label="Use the cover image as OG image"
        sx={{ ml: -0.5 }}
      />
      {!useCover && (
        <SingleImageInput
          source="ogImageUrl"
          accept={IMAGE_TYPES}
          maxSize={MAX_IMAGE_BYTES}
          format={formatImage}
          helperText="Shown on Facebook, LinkedIn, WhatsApp … (1200 × 630)"
        >
          <ImageField source="src" title="title" />
        </SingleImageInput>
      )}
      {!useCover && !ogImageUrl && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Until an image is chosen, the cover is still used.
        </Typography>
      )}
    </>
  );
};

const SeoTab: React.FC = () => (
  <>
    <SectionLabel>Address</SectionLabel>
    <TextInput
      source="slug"
      label="URL"
      validate={[required(), maxLength(200), slugFormat]}
      helperText="Shared key of the post; languages without their own URL use it"
    />
    <LocalizedSlugInput />
    <SlugPreview />

    <SectionLabel>Search engines</SectionLabel>
    <TextInput
      source="seoTitle"
      label="SEO title"
      validate={maxLength(200)}
      helperText="Empty: the title"
    />
    <TextInput
      source="seoDescription"
      label="SEO description"
      multiline
      minRows={2}
      validate={maxLength(500)}
      helperText="Empty: the lead"
    />
    <TextInput
      source="keywords"
      label="Keywords"
      format={formatKeywords}
      parse={(value: string) => value}
      helperText="Comma-separated, in this language (e.g. Next.js, security, API proxy)"
    />
    <TextInput
      source="canonicalUrl"
      label="Canonical URL"
      validate={[maxLength(1024), httpUrl]}
      helperText="Empty: this language's own URL. Set it only when the article was first published elsewhere."
    />

    <FieldGroup title="OG image">
      <OgImageFields />
    </FieldGroup>
  </>
);

type PostTab = 'content' | 'seo';

/**
 * Post fields in Content / SEO tabs on the left, `sidebar` (publish, settings, actions) sticky on
 * the right. Both tabs stay mounted so validation covers every field.
 */
export const PostForm: React.FC<{
  autoSlug?: boolean;
  sidebar: React.ReactNode;
  defaultValues?: Record<string, unknown>;
}> = ({ autoSlug = false, sidebar, defaultValues }) => {
  const [tab, setTab] = useState<PostTab>('content');
  return (
    <Form validate={htmlContentRequired} defaultValues={defaultValues}>
      {autoSlug && <SlugFromTitle />}
      <UnsavedChangesReporter />
      <DetailLayout sidebar={sidebar}>
        <MissingTranslationNotice what="article" fields="the title and body" />
        <Tabs
          value={tab}
          onChange={(_event, next: PostTab) => setTab(next)}
          aria-label="Post sections"
          sx={{ mx: -2, mt: -2, px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            value="content"
            label="Content"
            id="post-tab-content"
            aria-controls="post-panel-content"
          />
          <Tab value="seo" label="SEO" id="post-tab-seo" aria-controls="post-panel-seo" />
        </Tabs>
        <Box
          role="tabpanel"
          id="post-panel-content"
          aria-labelledby="post-tab-content"
          hidden={tab !== 'content'}
          sx={{ display: tab === 'content' ? 'flex' : 'none', flexDirection: 'column', gap: 1 }}
        >
          <ContentTab />
        </Box>
        <Box
          role="tabpanel"
          id="post-panel-seo"
          aria-labelledby="post-tab-seo"
          hidden={tab !== 'seo'}
          sx={{ display: tab === 'seo' ? 'flex' : 'none', flexDirection: 'column', gap: 1 }}
        >
          <SeoTab />
        </Box>
      </DetailLayout>
    </Form>
  );
};
