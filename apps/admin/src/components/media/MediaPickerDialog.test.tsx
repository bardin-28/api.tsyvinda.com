import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, type DataProvider } from 'react-admin';
import type { AdminMedia } from '@tsyvinda/shared-types';
import { MediaPickerDialog } from './MediaPickerDialog';

const media = (id: string, fileName: string, usages: AdminMedia['usages'] = []): AdminMedia => ({
  id,
  url: `https://cdn.example/media/${id}.webp`,
  fileName,
  mimeType: 'image/webp',
  size: 2048,
  createdAt: '2026-11-13T10:00:00.000Z',
  uploadedBy: null,
  usages,
});

function renderPicker() {
  const dataProvider = {
    getList: vi.fn(async () => ({
      data: [
        media('m1', 'cover.webp', [{ kind: 'post', id: 'p1', label: 'Post' }]),
        media('m2', 'me.webp'),
      ],
      total: 2,
    })),
    create: vi.fn(async () => ({ data: media('m3', 'new.webp') })),
  };
  const onSelect = vi.fn();
  render(
    <AdminContext dataProvider={dataProvider as unknown as DataProvider}>
      <MediaPickerDialog open label="Cover" onClose={vi.fn()} onSelect={onSelect} />
    </AdminContext>,
  );
  return { dataProvider, onSelect };
}

describe('MediaPickerDialog', () => {
  it('lists library images and hands back the chosen one', async () => {
    const { onSelect } = renderPicker();
    const dialog = await screen.findByRole('dialog', { name: 'Media library — Cover' });
    const option = await within(dialog).findByRole('option', { name: 'me.webp' });
    expect(within(dialog).getByText('Used 1×')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Use this image' })).toBeDisabled();
    await userEvent.click(option);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use this image' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm2' }));
  });

  it('uploads into the library and selects the new image', async () => {
    const { dataProvider, onSelect } = renderPicker();
    await screen.findByRole('option', { name: 'me.webp' });
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Upload to the media library'), file);
    await waitFor(() =>
      expect(dataProvider.create).toHaveBeenCalledWith('media', {
        data: { image: { rawFile: file } },
      }),
    );
    expect(
      await screen.findByRole('option', { name: 'new.webp', selected: true }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use this image' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm3' }));
  });
});
