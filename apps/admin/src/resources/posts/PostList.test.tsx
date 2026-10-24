import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminContext, ResourceContextProvider, type DataProvider } from 'react-admin';
import { PostList } from './PostList';

describe('PostList', () => {
  it('lists posts newest first with their author', async () => {
    const getList = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'p1',
          title: 'Hello world',
          slug: 'hello-world',
          imageUrl: null,
          author: { id: 'u1', firstName: 'Ada', lastName: 'Admin' },
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-02T10:00:00.000Z',
        },
      ],
      total: 1,
    });

    render(
      <AdminContext dataProvider={{ getList } as unknown as DataProvider}>
        <ResourceContextProvider value="posts">
          <PostList />
        </ResourceContextProvider>
      </AdminContext>,
    );

    expect(await screen.findByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('hello-world')).toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(getList).toHaveBeenCalledWith(
      'posts',
      expect.objectContaining({
        sort: { field: 'createdAt', order: 'DESC' },
        pagination: { page: 1, perPage: 25 },
      }),
    );
  });
});
