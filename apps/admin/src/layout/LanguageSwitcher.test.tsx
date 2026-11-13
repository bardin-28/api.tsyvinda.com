import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext } from 'react-admin';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  CONTENT_LOCALE_STORAGE_KEY,
  getContentLocale,
  resetContentLocaleForTests,
  setUnsavedChanges,
} from '../lib/contentLocale';

const renderSwitcher = () =>
  render(
    <AdminContext>
      <LanguageSwitcher />
    </AdminContext>,
  );

beforeEach(() => {
  window.localStorage.clear();
  resetContentLocaleForTests();
});

describe('LanguageSwitcher', () => {
  it('starts in English and remembers a switch to Ukrainian', async () => {
    renderSwitcher();
    await userEvent.click(screen.getByRole('button', { name: /content language: english/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Українська' }));

    expect(getContentLocale()).toBe('uk');
    expect(window.localStorage.getItem(CONTENT_LOCALE_STORAGE_KEY)).toBe('uk');
    expect(screen.getByRole('button', { name: /content language: українська/i })).toHaveTextContent(
      'UK',
    );
  });

  it('restores the remembered language on load', () => {
    window.localStorage.setItem(CONTENT_LOCALE_STORAGE_KEY, 'uk');
    resetContentLocaleForTests();
    expect(getContentLocale()).toBe('uk');
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(CONTENT_LOCALE_STORAGE_KEY, 'de');
    resetContentLocaleForTests();
    expect(getContentLocale()).toBe('en');
  });

  it('asks before switching away from unsaved changes', async () => {
    renderSwitcher();
    setUnsavedChanges(true);
    await userEvent.click(screen.getByRole('button', { name: /content language/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Українська' }));

    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(getContentLocale()).toBe('en');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText('Discard unsaved changes?')).toBeNull());
    expect(getContentLocale()).toBe('en');

    await userEvent.click(screen.getByRole('button', { name: /content language/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Українська' }));
    await userEvent.click(screen.getByRole('button', { name: /switch language/i }));
    expect(getContentLocale()).toBe('uk');
  });
});
