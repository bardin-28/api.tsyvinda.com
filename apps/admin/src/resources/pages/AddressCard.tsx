import React, { useEffect, useState } from 'react';
import { HttpError, useDataProvider, useNotify, useRecordContext, useRefresh } from 'react-admin';
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import {
  LOCALES,
  PAGE_SLUG_MAX,
  localizePath,
  type AdminPage,
  type Locale,
} from '@tsyvinda/shared-types';
import type { AdminDataProvider } from '../../providers/dataProvider';
import { LOCALE_LABELS } from '../../lib/contentLocale';
import { SidebarCard } from '../../components/DetailLayout';

/** "/uk/" before the slug input: the address up to the page's own segment. */
function prefixOf(page: AdminPage, locale: Locale): string {
  const current = page.paths[locale];
  const parentPath = current ? current.slice(0, current.lastIndexOf('/')) : '';
  return `${localizePath(parentPath || '/', locale).replace(/\/$/, '')}/`;
}

/**
 * The page's address per language. Saved on its own (separately from the content) and live at once; the
 * previous address keeps working as a redirect to the new one.
 */
export const AddressCard: React.FC = () => {
  const page = useRecordContext<AdminPage>();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [slugs, setSlugs] = useState<Partial<Record<Locale, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => setSlugs(page?.slugs ?? {}), [page?.slugs]);
  if (!page) return null;

  if (!page.routed) {
    return (
      <SidebarCard title="Address">
        <Typography variant="body2">The home page always lives at / and /uk.</Typography>
      </SidebarCard>
    );
  }

  const changed = LOCALES.some((locale) => (slugs[locale] ?? '') !== (page.slugs[locale] ?? ''));

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      await dataProvider.updatePageSlugs(page.id, slugs);
      notify('Address saved; the old one redirects to it', { type: 'success' });
      refresh();
    } catch (error) {
      setErrors(((error as HttpError).body?.errors as Record<string, string>) ?? {});
      notify((error as Error).message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidebarCard title="Address">
      {LOCALES.map((locale) => (
        <TextField
          key={locale}
          size="small"
          label={LOCALE_LABELS[locale].name}
          value={slugs[locale] ?? ''}
          onChange={(event) => setSlugs({ ...slugs, [locale]: event.target.value.toLowerCase() })}
          error={Boolean(errors[`slugs.${locale}`])}
          helperText={errors[`slugs.${locale}`]}
          slotProps={{
            htmlInput: {
              maxLength: PAGE_SLUG_MAX,
              'aria-label': `Address in ${LOCALE_LABELS[locale].name}`,
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">{prefixOf(page, locale)}</InputAdornment>
              ),
            },
          }}
        />
      ))}
      <Button variant="outlined" onClick={save} disabled={busy || !changed}>
        Save address
      </Button>
      {page.oldSlugs.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Redirect to the current address:
          </Typography>
          {page.oldSlugs.map((old) => (
            <Typography
              key={`${old.locale}:${old.slug}`}
              variant="body2"
              sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
            >
              {old.path}
            </Typography>
          ))}
        </Box>
      )}
    </SidebarCard>
  );
};
