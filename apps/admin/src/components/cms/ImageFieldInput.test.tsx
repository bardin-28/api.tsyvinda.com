import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, Form, SaveButton, type DataProvider } from 'react-admin';
import { ImageFieldInput } from './ImageFieldInput';

const CROP = { aspect: 1, outputWidth: 640, shape: 'circle' } as const;

function renderInput(initialUrl: string | null, crop?: typeof CROP) {
  const uploadPageImage = vi.fn().mockResolvedValue({ url: 'https://cdn.example/pages/new.png' });
  const onSubmit = vi.fn();
  render(
    <AdminContext dataProvider={{ uploadPageImage } as unknown as DataProvider}>
      <Form record={{ id: 1, data: { avatar: initialUrl } }} onSubmit={onSubmit}>
        <ImageFieldInput source="data.avatar" label="Photo" helperText="Square" crop={crop} />
        <SaveButton alwaysEnable />
      </Form>
    </AdminContext>,
  );
  return { uploadPageImage, onSubmit };
}

describe('ImageFieldInput', () => {
  it('uploads the picked file at once and keeps its URL in the form', async () => {
    const { uploadPageImage, onSubmit } = renderInput(null);
    const file = new File(['x'], 'me.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Upload Photo'), file);
    await waitFor(() => expect(uploadPageImage).toHaveBeenCalledWith(file));
    expect(await screen.findByAltText('Photo preview')).toHaveAttribute(
      'src',
      'https://cdn.example/pages/new.png',
    );
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(onSubmit.mock.calls[0]![0].data.avatar).toBe('https://cdn.example/pages/new.png'),
    );
  });

  it('removes the image', async () => {
    const { onSubmit } = renderInput('https://cdn.example/pages/old.png');
    expect(screen.getByRole('button', { name: /replace/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.queryByAltText('Photo preview')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit.mock.calls[0]![0].data.avatar).toBeNull());
  });

  it('with crop, opens the crop dialog for a picked file instead of uploading it', async () => {
    const createObjectURL = vi.fn(() => 'blob:picked');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const { uploadPageImage } = renderInput(null, CROP);
    const file = new File(['x'], 'me.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Upload Photo'), file);

    const dialog = await screen.findByRole('dialog', { name: 'Crop image — Photo' });
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(uploadPageImage).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:picked');
    expect(uploadPageImage).not.toHaveBeenCalled();
  });

  it('offers Crop for a stored image', async () => {
    renderInput('https://cdn.example/pages/old.png', CROP);
    await userEvent.click(screen.getByRole('button', { name: /^crop$/i }));
    expect(await screen.findByRole('dialog', { name: 'Crop image — Photo' })).toBeInTheDocument();
  });
});
