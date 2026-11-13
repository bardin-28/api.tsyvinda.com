import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, ResourceContextProvider, type DataProvider } from 'react-admin';
import type { AdminPage } from '@tsyvinda/shared-types';
import { setContentLocale } from '../../lib/contentLocale';
import { PageEdit } from './PageEdit';

const text = (en: string, uk = '') => ({ en, uk });

const page: AdminPage = {
  id: 'contacts',
  key: 'contacts',
  label: 'Contacts',
  routed: true,
  enabledLocales: ['en', 'uk'],
  translated: { en: 100, uk: 75 },
  paths: { en: '/contacts', uk: '/kontakty' },
  updatedAt: '2026-11-13T10:00:00.000Z',
  updatedBy: { id: 'u1', name: 'Ada Admin' },
  version: 4,
  slugs: { en: 'contacts', uk: 'kontakty' },
  oldSlugs: [{ locale: 'uk', slug: 'contacts', path: '/uk/contacts' }],
  parent: null,
  draft: {
    title: text('Contacts', 'Контакти'),
    seo: {
      title: text('Contacts', 'Контакти'),
      socialTitle: text(''),
      description: text('Reach me', 'Пишіть'),
      keywords: text(''),
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: '01930000-0000-7000-8000-000000000001',
        type: 'contactsHero',
        anchor: null,
        data: { title: text('Let’s talk', 'Поговорімо'), lead: text(''), mapLabel: text('') },
      },
      {
        id: '01930000-0000-7000-8000-000000000002',
        type: 'contactChannels',
        anchor: null,
        data: {},
      },
    ],
  },
};

function renderEdit(overrides: Partial<Record<string, unknown>> = {}) {
  const dataProvider = {
    getOne: vi.fn().mockResolvedValue({ data: page }),
    update: vi.fn(async (_resource: string, params: { data: unknown }) => ({
      data: { ...page, version: 5 },
      params,
    })),
    updatePageSlugs: vi.fn().mockResolvedValue({ ...page }),
    ...overrides,
  };
  render(
    <AdminContext dataProvider={dataProvider as unknown as DataProvider}>
      <ResourceContextProvider value="pages">
        <PageEdit id="contacts" />
      </ResourceContextProvider>
    </AdminContext>,
  );
  return dataProvider;
}

const openSection = async (name: RegExp) =>
  userEvent.click(await screen.findByRole('button', { name }));

describe('PageEdit', () => {
  beforeEach(() => setContentLocale('en'));

  it('shows the page’s fixed sections as numbered accordions, without add/remove/reorder', async () => {
    renderEdit();
    expect(await screen.findByRole('button', { name: /1\. Contacts — hero/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2\. Contact channels/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add section/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove|move/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/changes are live on the website as soon as they are saved/i),
    ).toBeInTheDocument();
    expect(screen.getByText('UK text: 75% filled')).toBeInTheDocument();
  });

  it('saves the whole content of every language with the version', async () => {
    const dataProvider = renderEdit();
    await openSection(/1\. Contacts — hero/);
    const heroTitle = await screen.findByDisplayValue('Let’s talk');
    await userEvent.clear(heroTitle);
    await userEvent.type(heroTitle, 'Say hi');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(dataProvider.update).toHaveBeenCalled());
    const sent = dataProvider.update.mock.calls[0]![1].data as {
      version: number;
      draft: AdminPage['draft'];
      enabledLocales: string[];
    };
    expect(Object.keys(sent).sort()).toEqual(['draft', 'enabledLocales', 'version']);
    expect(sent.version).toBe(4);
    expect(sent.draft.blocks[0]!.data.title).toEqual({ en: 'Say hi', uk: 'Поговорімо' });
    expect(sent.draft.blocks.map((block) => block.type)).toEqual([
      'contactsHero',
      'contactChannels',
    ]);
  });

  it('edits SEO on its own tab', async () => {
    renderEdit();
    await userEvent.click(await screen.findByRole('tab', { name: /seo/i }));
    expect(await screen.findByDisplayValue('Reach me')).toBeVisible();
    expect(screen.getByLabelText(/hide from search engines/i)).toBeInTheDocument();
    // Length hints, live while typing
    expect(screen.getByText('8 characters, recommended: 30–60')).toBeInTheDocument();
    expect(screen.getByText('8 characters, recommended: 70–160')).toBeInTheDocument();
    await userEvent.type(screen.getByDisplayValue('Reach me'), ' anytime');
    expect(screen.getByText('16 characters, recommended: 70–160')).toBeInTheDocument();
    // Social image is an upload with crop, not a URL field
    expect(screen.getByRole('group', { name: 'Social sharing image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
  });

  it('saves the address separately and lists old addresses', async () => {
    const dataProvider = renderEdit();
    const address = await screen.findByRole('region', { name: 'Address' });
    expect(within(address).getByText('/uk/contacts')).toBeInTheDocument();
    const ukrainian = within(address).getByLabelText('Address in Українська');
    await userEvent.clear(ukrainian);
    await userEvent.type(ukrainian, 'Zviazok');
    await userEvent.click(within(address).getByRole('button', { name: /save address/i }));
    await waitFor(() =>
      expect(dataProvider.updatePageSlugs).toHaveBeenCalledWith('contacts', {
        en: 'contacts',
        uk: 'zviazok',
      }),
    );
  });

  it('marks required fields the API refuses and opens their section', async () => {
    const { HttpError } = await import('react-admin');
    const update = vi.fn().mockRejectedValue(
      new HttpError('Fill in the required fields', 400, {
        errors: { 'draft.blocks.0.data.title.en': 'Required' },
      }),
    );
    renderEdit({ update });
    const title = await screen.findByLabelText(/page title/i);
    await userEvent.type(title, '!');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(await screen.findByText('Required')).toBeInTheDocument();
  });
});
