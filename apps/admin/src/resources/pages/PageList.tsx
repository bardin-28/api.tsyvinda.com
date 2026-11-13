import React from 'react';
import { Datagrid, EditButton, FunctionField, List, SearchInput, TextField } from 'react-admin';
import { Typography } from '@mui/material';
import { LOCALES, localizePath, type AdminPageListItem, type Locale } from '@tsyvinda/shared-types';
import { LOCALE_LABELS, useContentLocale } from '../../lib/contentLocale';
import { formatDateTime } from '../../lib/dateFormat';

/** Public address in the language being edited ("/about", "/uk/pro-mene"). */
const Address: React.FC<{ page: AdminPageListItem; locale: Locale }> = ({ page, locale }) => {
  const path = page.paths[locale];
  return (
    <Typography variant="body2">{path === undefined ? '—' : localizePath(path, locale)}</Typography>
  );
};

/** "EN 100% · UK 92%": translatable texts filled in per enabled language. */
const translatedLabel = (page: AdminPageListItem): string =>
  LOCALES.filter((locale) => page.enabledLocales.includes(locale))
    .map((locale) => `${LOCALE_LABELS[locale].short} ${page.translated[locale]}%`)
    .join(' · ');

const filters = [<SearchInput key="q" source="q" alwaysOn />];

/** The website's pages: fixed set (one per design), so no create or delete. */
export const PageList: React.FC = () => {
  const locale = useContentLocale();
  return (
    <List pagination={false} actions={false} exporter={false} filters={filters}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="label" label="Title" sortable={false} />
        <FunctionField<AdminPageListItem>
          label="Address"
          render={(page) => <Address page={page} locale={locale} />}
        />
        <FunctionField<AdminPageListItem> label="Translated" render={translatedLabel} />
        <FunctionField<AdminPageListItem>
          label="Updated at"
          render={(page) => formatDateTime(page.updatedAt)}
        />
        <EditButton />
      </Datagrid>
    </List>
  );
};
