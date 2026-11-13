import React, { useEffect, useState } from 'react';
import { BooleanInput, Edit, Form, useRecordContext } from 'react-admin';
import { useFormState, type FieldErrors } from 'react-hook-form';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Box,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import {
  BLOCK_DEFINITIONS,
  LOCALES,
  PAGE_DEFINITIONS,
  type AdminPage,
  type BlockDefinition,
  type FieldDefinitions,
  type Locale,
} from '@tsyvinda/shared-types';
import { DetailLayout, SaveCard, SidebarCard } from '../../components/DetailLayout';
import { FieldInputs } from '../../components/cms/FieldInput';
import { ImageFieldInput } from '../../components/cms/ImageFieldInput';
import { LanguagesCard } from '../../components/cms/CmsSidebarCards';
import { UnsavedChangesReporter } from '../../components/Translations';
import { LOCALE_LABELS, useContentLocale } from '../../lib/contentLocale';
import { AddressCard } from './AddressCard';
import { toPageDraftPayload } from './pagePayload';

/** Page name and SEO texts (same limits as the API's PAGE_META_FIELDS / PAGE_SEO_FIELDS). */
const PAGE_FIELDS = {
  title: {
    kind: 'text',
    localized: true,
    label: 'Page title',
    help: 'Breadcrumbs and admin lists',
    required: true,
    max: 120,
  },
} as const satisfies FieldDefinitions;

const SEO_FIELDS = {
  title: {
    kind: 'text',
    localized: true,
    label: 'SEO title',
    help: 'Browser tab and search results',
    required: true,
    max: 120,
    recommendedLength: { min: 30, max: 60 },
  },
  socialTitle: {
    kind: 'text',
    localized: true,
    label: 'Social title',
    help: 'Share cards; SEO title when empty',
    max: 160,
    recommendedLength: { min: 30, max: 60 },
  },
  description: {
    kind: 'text',
    localized: true,
    multiline: true,
    label: 'SEO description',
    help: 'Search results and share cards',
    required: true,
    max: 400,
    recommendedLength: { min: 70, max: 160 },
  },
  keywords: {
    kind: 'text',
    localized: true,
    multiline: true,
    label: 'Keywords',
    help: 'Comma-separated',
    max: 1000,
  },
} as const satisfies FieldDefinitions;

/** Open Graph card size the networks expect (1.91:1). */
const OG_IMAGE_CROP = { aspect: 1200 / 630, outputWidth: 1200, shape: 'rect' } as const;

type DraftErrors = FieldErrors<{
  draft: { title: unknown; seo: unknown; blocks: Record<number, unknown> };
}>;

/** Indexes of the sections the form has errors in (client or API `fieldErrors`). */
function sectionsWithErrors(errors: DraftErrors): number[] {
  const blocks = errors.draft?.blocks as Record<string, unknown> | undefined;
  return blocks ? Object.keys(blocks).map(Number).filter(Number.isInteger) : [];
}

/** Tab label with a red dot while one of its fields has an error. */
const TabLabel: React.FC<{ label: string; hasError: boolean }> = ({ label, hasError }) => (
  <Badge color="error" variant="dot" invisible={!hasError}>
    {label}
  </Badge>
);

/**
 * The page's sections, fixed by the page definition: numbered accordions, each with its fields.
 * Editors fill them in; they can't add, remove or reorder sections.
 */
const SectionsEditor: React.FC<{ page: AdminPage; locale: Locale }> = ({ page, locale }) => {
  const { errors } = useFormState();
  const failing = sectionsWithErrors(errors as DraftErrors);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // A failed save opens the sections it complains about
  const failingKey = failing.join(',');
  useEffect(() => {
    if (failingKey) setExpanded((open) => new Set([...open, ...failingKey.split(',').map(Number)]));
  }, [failingKey]);

  const toggle = (index: number) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {PAGE_DEFINITIONS[page.key].sections.map((section, index) => {
        const definition: BlockDefinition = BLOCK_DEFINITIONS[section.type];
        const hasFields = Object.keys(definition.fields).length > 0;
        const hasError = failing.includes(index);
        return (
          <Accordion
            key={`${index}-${section.type}`}
            expanded={expanded.has(index)}
            onChange={() => toggle(index)}
            disableGutters
            variant="outlined"
            slotProps={{ transition: { unmountOnExit: true } }}
            sx={{ '&::before': { display: 'none' }, borderRadius: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls={`section-${index}-content`}
              id={`section-${index}-header`}
              // Chevron right after the title, like Delta Lektorat's editor
              sx={{
                justifyContent: 'flex-start',
                '& .MuiAccordionSummary-content': { flexGrow: 0 },
              }}
            >
              <Typography
                component="h3"
                sx={{ fontWeight: 600, color: hasError ? 'error.main' : undefined }}
              >
                {index + 1}. {definition.label}
              </Typography>
            </AccordionSummary>
            <AccordionDetails
              id={`section-${index}-content`}
              sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
            >
              {definition.description && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  {definition.description}
                </Typography>
              )}
              {hasFields ? (
                <FieldInputs
                  defs={definition.fields}
                  locale={locale}
                  base={`draft.blocks.${index}.data`}
                />
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nothing to edit here: the website fills this section in.
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

/** How much of the page's text is filled in per language (as last saved). */
const TranslationCard: React.FC<{ page: AdminPage }> = ({ page }) => (
  <SidebarCard title="Translation">
    {LOCALES.filter((locale) => page.enabledLocales.includes(locale)).map((locale) => {
      const percent = page.translated[locale];
      return (
        <Box key={locale}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {LOCALE_LABELS[locale].short} text: {percent}% filled
          </Typography>
          <LinearProgress
            variant="determinate"
            value={percent}
            color={percent === 100 ? 'success' : 'warning'}
            aria-label={`${LOCALE_LABELS[locale].name} text filled`}
          />
        </Box>
      );
    })}
  </SidebarCard>
);

const PageTitle: React.FC = () => {
  const page = useRecordContext<AdminPage>();
  return <>{page ? `Page “${page.label}”` : 'Page'}</>;
};

const PageForm: React.FC = () => {
  const page = useRecordContext<AdminPage>();
  const locale = useContentLocale();
  const [tab, setTab] = useState<'content' | 'seo'>('content');
  if (!page) return null;

  return (
    <Form>
      <UnsavedChangesReporter />
      <DetailLayout
        sidebar={
          <>
            <SaveCard
              note="Changes are live on the website as soon as they are saved."
              lastSaved={page.updatedAt}
            />
            <TranslationCard page={page} />
            <AddressCard />
            <LanguagesCard />
          </>
        }
      >
        <PageTabs tab={tab} onChange={setTab} />
        <Box
          role="tabpanel"
          id="page-tab-content"
          aria-labelledby="page-tab-content-label"
          hidden={tab !== 'content'}
          sx={{ display: tab === 'content' ? 'flex' : 'none', flexDirection: 'column', gap: 1 }}
        >
          <FieldInputs defs={PAGE_FIELDS} locale={locale} base="draft" />
          <SectionsEditor page={page} locale={locale} />
        </Box>
        <Box
          role="tabpanel"
          id="page-tab-seo"
          aria-labelledby="page-tab-seo-label"
          hidden={tab !== 'seo'}
          sx={{ display: tab === 'seo' ? 'flex' : 'none', flexDirection: 'column', gap: 0.5 }}
        >
          <Typography variant="overline" component="h2" sx={{ color: 'text.secondary' }}>
            Search engines
          </Typography>
          <FieldInputs defs={SEO_FIELDS} locale={locale} base="draft.seo" />
          <ImageFieldInput
            source="draft.seo.ogImageUrl"
            label="Social sharing image"
            helperText="Facebook, LinkedIn, X… cards; cropped to 1200×630. The site’s generated card when empty"
            crop={OG_IMAGE_CROP}
          />
          <BooleanInput
            source="draft.seo.noindex"
            label="Hide from search engines"
            helperText="noindex even while indexing is on (Settings → General)"
          />
        </Box>
      </DetailLayout>
    </Form>
  );
};

/** Content / SEO tabs; a tab shows a red dot while it holds a field with an error. */
const PageTabs: React.FC<{
  tab: 'content' | 'seo';
  onChange: (tab: 'content' | 'seo') => void;
}> = ({ tab, onChange }) => {
  const { errors } = useFormState();
  const draftErrors = (errors as DraftErrors).draft;
  const seoError = Boolean(draftErrors?.seo);
  const contentError = Boolean(draftErrors?.title || draftErrors?.blocks);
  return (
    <Tabs
      value={tab}
      onChange={(_, value: 'content' | 'seo') => onChange(value)}
      sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
    >
      <Tab
        value="content"
        id="page-tab-content-label"
        aria-controls="page-tab-content"
        label={<TabLabel label="Content" hasError={contentError} />}
      />
      <Tab
        value="seo"
        id="page-tab-seo-label"
        aria-controls="page-tab-seo"
        label={<TabLabel label="SEO" hasError={seoError} />}
      />
    </Tabs>
  );
};

/** `id` defaults to the route's (tests pass it directly). */
export const PageEdit: React.FC<{ id?: string }> = ({ id }) => (
  <Edit
    id={id}
    title={<PageTitle />}
    actions={false}
    component="div"
    mutationMode="pessimistic"
    redirect={false}
    transform={toPageDraftPayload}
  >
    <PageForm />
  </Edit>
);
