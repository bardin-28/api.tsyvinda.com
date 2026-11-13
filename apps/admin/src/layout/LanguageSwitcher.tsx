import React, { useState } from 'react';
import { Confirm } from 'react-admin';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { Check, KeyboardArrowDown, Translate } from '@mui/icons-material';
import { LOCALES, type Locale } from '@tsyvinda/shared-types';
import {
  LOCALE_LABELS,
  getUnsavedChanges,
  setContentLocale,
  setUnsavedChanges,
  useContentLocale,
} from '../lib/contentLocale';

/**
 * App bar dropdown: the language articles and categories are shown and edited in. The choice is
 * remembered in localStorage; switching reloads the current page's data in that language.
 */
export const LanguageSwitcher: React.FC = () => {
  const locale = useContentLocale();
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  const switchTo = (next: Locale) => {
    setUnsavedChanges(false);
    setContentLocale(next);
    // Cached rows are in the old language: drop them and refetch what is on screen
    void queryClient.resetQueries();
  };

  const choose = (next: Locale) => {
    setMenuAnchor(null);
    if (next === locale) return;
    if (getUnsavedChanges()) setPendingLocale(next);
    else switchTo(next);
  };

  return (
    <>
      <Tooltip title="Content language">
        <Button
          color="inherit"
          size="small"
          startIcon={<Translate fontSize="small" />}
          endIcon={<KeyboardArrowDown fontSize="small" />}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          aria-haspopup="menu"
          aria-label={`Content language: ${LOCALE_LABELS[locale].name}`}
          sx={{ minWidth: 0, fontWeight: 600 }}
        >
          {LOCALE_LABELS[locale].short}
        </Button>
      </Tooltip>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {LOCALES.map((option) => (
          <MenuItem key={option} selected={option === locale} onClick={() => choose(option)}>
            <ListItemIcon>{option === locale && <Check fontSize="small" />}</ListItemIcon>
            <ListItemText primary={LOCALE_LABELS[option].name} />
          </MenuItem>
        ))}
      </Menu>
      <Confirm
        isOpen={pendingLocale !== null}
        title="Discard unsaved changes?"
        content="Switching the language reloads this page. Changes you have not saved will be lost."
        confirm="Switch language"
        onConfirm={() => {
          if (pendingLocale) switchTo(pendingLocale);
          setPendingLocale(null);
        }}
        onClose={() => setPendingLocale(null)}
      />
    </>
  );
};
