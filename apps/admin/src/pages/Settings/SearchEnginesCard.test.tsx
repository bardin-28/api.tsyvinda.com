import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, type DataProvider } from 'react-admin';
import { SearchEnginesCard } from './SearchEnginesCard';

const renderCard = (dataProvider: Record<string, unknown>) =>
  render(
    <AdminContext dataProvider={dataProvider as unknown as DataProvider}>
      <SearchEnginesCard />
    </AdminContext>,
  );

describe('SearchEnginesCard', () => {
  it('shows the stored setting', async () => {
    renderCard({
      getSiteSettings: vi.fn().mockResolvedValue({
        indexingEnabled: true,
        updatedAt: new Date(2026, 10, 13, 9, 5, 0).toISOString(),
      }),
    });
    const toggle = await screen.findByRole('switch', {
      name: /allow search engines to index the website/i,
    });
    expect(toggle).toBeChecked();
    expect(screen.getByText('Last changed 09:05:00 • 13.11.2026')).toBeInTheDocument();
  });

  it('asks before hiding the website, then saves', async () => {
    const saveSiteSettings = vi
      .fn()
      .mockResolvedValue({ indexingEnabled: false, updatedAt: new Date().toISOString() });
    renderCard({
      getSiteSettings: vi.fn().mockResolvedValue({ indexingEnabled: true, updatedAt: null }),
      saveSiteSettings,
    });

    await userEvent.click(await screen.findByRole('switch'));
    expect(await screen.findByText('Hide the website from search engines?')).toBeInTheDocument();
    expect(saveSiteSettings).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /hide website/i }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledWith({ indexingEnabled: false }));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
  });

  it('cancelling the confirmation changes nothing', async () => {
    const saveSiteSettings = vi.fn();
    renderCard({
      getSiteSettings: vi.fn().mockResolvedValue({ indexingEnabled: false, updatedAt: null }),
      saveSiteSettings,
    });

    await userEvent.click(await screen.findByRole('switch'));
    expect(await screen.findByText('Let search engines index the website?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(saveSiteSettings).not.toHaveBeenCalled();
    // The dialog's exit transition briefly hides the page from role queries
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
  });
});
