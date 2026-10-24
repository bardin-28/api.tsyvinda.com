import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, ResourceContextProvider, type DataProvider } from 'react-admin';
import { PostCreate } from './PostCreate';

const renderCreate = (dataProvider: Partial<DataProvider>) =>
  render(
    <AdminContext dataProvider={dataProvider as DataProvider}>
      <ResourceContextProvider value="posts">
        <PostCreate />
      </ResourceContextProvider>
    </AdminContext>,
  );

describe('PostCreate', () => {
  it('derives the slug from the title and creates the post with HTML content', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 'p1' } });
    renderCreate({ create, getOne: vi.fn().mockResolvedValue({ data: { id: 'p1' } }) });

    await userEvent.type(await screen.findByLabelText(/title/i), 'My First Post');
    expect(screen.getByLabelText(/slug/i)).toHaveValue('my-first-post');

    await userEvent.click(screen.getByRole('button', { name: 'HTML source' }));
    await userEvent.type(screen.getByLabelText('Content HTML'), '<p>Hello</p>');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[1].data).toEqual({
      title: 'My First Post',
      slug: 'my-first-post',
      description: '',
      htmlContent: '<p>Hello</p>',
    });
  });

  it('does not submit an empty body', async () => {
    const create = vi.fn();
    renderCreate({ create });

    await userEvent.type(await screen.findByLabelText(/title/i), 'Empty');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Content is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
