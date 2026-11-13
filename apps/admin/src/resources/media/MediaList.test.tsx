import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminContext, ResourceContextProvider, type DataProvider } from 'react-admin';
import type { AdminMedia } from '@tsyvinda/shared-types';
import { MediaList } from './MediaList';

const item = (id: string, fileName: string, usages: AdminMedia['usages']): AdminMedia => ({
  id,
  url: `https://cdn.example/media/${id}.webp`,
  fileName,
  mimeType: 'image/webp',
  size: 300 * 1024,
  createdAt: '2026-11-13T10:00:00.000Z',
  uploadedBy: { id: 'a1', name: 'Ada Admin' },
  usages,
});

describe('MediaList', () => {
  it('shows each image with where it is used; only unused ones can be deleted', async () => {
    const dataProvider = {
      getList: vi.fn(async () => ({
        data: [
          item('m1', 'cover.webp', [{ kind: 'post', id: 'p1', label: 'Hello world' }]),
          item('m2', 'spare.webp', []),
        ],
        total: 2,
      })),
    };
    render(
      <AdminContext dataProvider={dataProvider as unknown as DataProvider}>
        <ResourceContextProvider value="media">
          <MediaList />
        </ResourceContextProvider>
      </AdminContext>,
    );
    expect(await screen.findByText('cover.webp')).toBeInTheDocument();
    // Router-relative link to the post (hash in the test router, path in the app)
    expect(screen.getByRole('link', { name: 'Post: Hello world' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/posts\/p1$/),
    );
    expect(screen.getByText('Unused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete cover.webp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete spare.webp' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
  });
});
