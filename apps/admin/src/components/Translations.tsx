import React, { useEffect, useState } from 'react';
import {
  Button as RaButton,
  Confirm,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
} from 'react-admin';
import { useFormState } from 'react-hook-form';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { DeleteOutlined } from '@mui/icons-material';
import { LOCALES, type Locale } from '@tsyvinda/shared-types';
import { SidebarCard } from './DetailLayout';
import { LOCALE_LABELS, setUnsavedChanges, useContentLocale } from '../lib/contentLocale';
import type { AdminDataProvider } from '../providers/dataProvider';

/** Inside a form: tells the language switcher whether there are unsaved edits. */
export const UnsavedChangesReporter: React.FC = () => {
  const { isDirty } = useFormState();
  useEffect(() => {
    setUnsavedChanges(isDirty);
  }, [isDirty]);
  useEffect(() => () => setUnsavedChanges(false), []);
  return null;
};

type Translatable = { locales?: Locale[] };

/** EN / UK chips: filled = translated, outlined = missing. */
export const LocaleChips: React.FC<{ locales: Locale[] }> = ({ locales }) => (
  <Stack direction="row" spacing={0.5}>
    {LOCALES.map((locale) => {
      const translated = locales.includes(locale);
      return (
        <Chip
          key={locale}
          size="small"
          label={LOCALE_LABELS[locale].short}
          color={translated ? 'primary' : 'default'}
          variant={translated ? 'filled' : 'outlined'}
          title={`${LOCALE_LABELS[locale].name}: ${translated ? 'translated' : 'not translated'}`}
          sx={{ fontWeight: 600, minWidth: 36, opacity: translated ? 1 : 0.6 }}
        />
      );
    })}
  </Stack>
);

/** Above an edit form whose record has no version in the content language yet. */
export const MissingTranslationNotice: React.FC<{ what: string; fields: string }> = ({
  what,
  fields,
}) => {
  const record = useRecordContext<Translatable>();
  const locale = useContentLocale();
  if (!record?.locales || record.locales.includes(locale)) return null;
  return (
    <Alert severity="info" sx={{ mb: 1 }}>
      This {what} has no {LOCALE_LABELS[locale].name} version yet. Fill in {fields} and save to add
      it; until then the website does not show it in this language.
    </Alert>
  );
};

/**
 * Post sidebar: which languages exist, and deleting the one being edited (never the last one).
 */
export const TranslationsCard: React.FC = () => {
  const record = useRecordContext<Translatable & { id: string }>();
  const locale = useContentLocale();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  if (!record?.locales) return null;

  const canDelete = record.locales.includes(locale) && record.locales.length > 1;
  const deleteVersion = async () => {
    setIsDeleting(true);
    try {
      await dataProvider.deletePostTranslation(record.id, locale);
      notify(`${LOCALE_LABELS[locale].name} version deleted`, { type: 'info' });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete this version', {
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <SidebarCard title="Languages">
      <LocaleChips locales={record.locales} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Editing: {LOCALE_LABELS[locale].name}. Switch the language in the top bar.
      </Typography>
      {canDelete && (
        <Box>
          <RaButton
            label={`Delete ${LOCALE_LABELS[locale].name} version`}
            color="error"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isDeleting}
          >
            <DeleteOutlined />
          </RaButton>
        </Box>
      )}
      <Confirm
        isOpen={isConfirmOpen}
        loading={isDeleting}
        title={`Delete the ${LOCALE_LABELS[locale].name} version?`}
        content="Its title, text, cover and SEO in this language are removed. Other languages stay."
        onConfirm={deleteVersion}
        onClose={() => setIsConfirmOpen(false)}
      />
    </SidebarCard>
  );
};
