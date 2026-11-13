import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, ResourceContextProvider, type DataProvider } from 'react-admin';
import { PostCreate } from './PostCreate';

// Settings inputs (categories, author) load their choices from these resources.
const referenceLists = {
  getList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getMany: vi.fn().mockResolvedValue({ data: [] }),
};

const renderCreate = (dataProvider: Partial<DataProvider>) =>
  render(
    <AdminContext dataProvider={{ ...referenceLists, ...dataProvider } as DataProvider}>
      <ResourceContextProvider value="posts">
        <PostCreate />
      </ResourceContextProvider>
    </AdminContext>,
  );

// Label queries: role queries are too slow on this DOM (editor + both tabs mounted).
// /^title/ matches "Title *" but not "SEO title".
const titleInput = () => screen.findByLabelText(/^title/i);

describe('PostCreate', () => {
  it('derives the slug from the title and saves a draft with HTML content', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 'p1' } });
    renderCreate({ create, getOne: vi.fn().mockResolvedValue({ data: { id: 'p1' } }) });

    await userEvent.type(await titleInput(), 'My First Post');
    // Slug lives on the SEO tab (mounted, just hidden)
    expect(screen.getAllByLabelText(/^url/i)[0]).toHaveValue('my-first-post');

    await userEvent.click(screen.getByRole('button', { name: 'HTML source' }));
    await userEvent.type(screen.getByLabelText('Body HTML'), '<p>Hello</p>');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[1].data).toMatchObject({
      title: 'My First Post',
      slug: 'my-first-post',
      description: '',
      htmlContent: '<p>Hello</p>',
      status: 'draft',
      categoryIds: [],
    });
  });

  it('publishes straight away with the Publish button', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 'p1' } });
    renderCreate({ create, getOne: vi.fn().mockResolvedValue({ data: { id: 'p1' } }) });

    await userEvent.type(await titleInput(), 'Live');
    await userEvent.click(screen.getByRole('button', { name: 'HTML source' }));
    await userEvent.type(screen.getByLabelText('Body HTML'), '<p>Now</p>');
    await userEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[1].data).toMatchObject({ status: 'published' });
  });

  it('does not submit an empty body', async () => {
    const create = vi.fn();
    renderCreate({ create });

    await userEvent.type(await titleInput(), 'Empty');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    expect(await screen.findByText('Content is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
