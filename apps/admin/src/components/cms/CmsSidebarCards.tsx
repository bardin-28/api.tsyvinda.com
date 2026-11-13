import React from 'react';
import { CheckboxGroupInput } from 'react-admin';
import { LOCALES } from '@tsyvinda/shared-types';
import { LOCALE_LABELS } from '../../lib/contentLocale';
import { SidebarCard } from '../DetailLayout';

const LOCALE_CHOICES = LOCALES.map((locale) => ({ id: locale, name: LOCALE_LABELS[locale].name }));

/** Languages the content is live in (every required field must be filled in each). */
export const LanguagesCard: React.FC = () => (
  <SidebarCard title="Languages">
    <CheckboxGroupInput
      source="enabledLocales"
      label={false}
      choices={LOCALE_CHOICES}
      row={false}
      helperText="Shown on the website in these languages"
    />
  </SidebarCard>
);
