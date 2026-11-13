import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, Form, SaveButton } from 'react-admin';
import { SingleImageInput } from './SingleImageInput';

const CROP = { aspect: 1, outputWidth: 512, shape: 'circle' } as const;
const STORED = 'https://cdn.example/profile/me.png';

function renderInput(initial: string | null, crop?: typeof CROP) {
  const onSubmit = vi.fn();
  const { container } = render(
    <AdminContext>
      <Form record={{ id: 1, avatar: initial }} onSubmit={onSubmit}>
        <SingleImageInput
          source="avatar"
          accept={{ 'image/png': [] }}
          format={(value: unknown) => (typeof value === 'string' ? { src: value } : value)}
          crop={crop}
          cropLabel="Avatar"
        />
        <SaveButton alwaysEnable />
      </Form>
    </AdminContext>,
  );
  const fileInput = () => container.querySelector<HTMLInputElement>('input[type="file"]')!;
  return { onSubmit, fileInput };
}

describe('SingleImageInput with crop', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:picked'), revokeObjectURL: vi.fn() });
  });

  it('opens the crop dialog for a picked file; Cancel keeps the previous avatar', async () => {
    const { onSubmit, fileInput } = renderInput(STORED, CROP);
    await userEvent.upload(fileInput(), new File(['x'], 'me.png', { type: 'image/png' }));

    const dialog = await screen.findByRole('dialog', { name: 'Crop image — Avatar' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].avatar).toBe(STORED);
  });

  it('offers Crop for the stored image', async () => {
    renderInput(STORED, CROP);
    await userEvent.click(screen.getByRole('button', { name: /^crop$/i }));
    expect(await screen.findByRole('dialog', { name: 'Crop image — Avatar' })).toBeInTheDocument();
  });

  it('without crop, a picked file goes straight into the form', async () => {
    const { onSubmit, fileInput } = renderInput(null);
    await userEvent.upload(fileInput(), new File(['x'], 'me.png', { type: 'image/png' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^crop$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].avatar.rawFile).toBeInstanceOf(File);
  });
});
