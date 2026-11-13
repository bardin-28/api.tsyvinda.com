import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminContext, ResourceContextProvider, type DataProvider } from 'react-admin';
import { PostList } from './PostList';

describe('PostList', () => {
  it('lists posts with categories, author, status and reference date formats', async () => {
    const getList = vi.fn(async (resource: string) =>
      resource === 'posts'
        ? {
            data: [
              {
                id: 'p1',
                title: 'Hello world',
                slug: 'hello-world',
                imageUrl: null,
                author: { id: 'u1', firstName: 'Ada', lastName: 'Admin' },
                locale: 'en',
                locales: ['en', 'uk'],
                categories: [
                  { id: 'c1', name: 'Frontend', slug: 'frontend' },
                  { id: 'c2', name: 'Security', slug: 'security' },
                ],
                categoryIds: ['c1', 'c2'],
                status: 'published',
                // Local-time dates keep the formatted text timezone-independent
                publishedAt: new Date(2026, 7, 7, 9, 0, 0).toISOString(),
                createdAt: new Date(2026, 7, 1).toISOString(),
                updatedAt: new Date(2026, 10, 10, 21, 18, 22).toISOString(),
              },
            ],
            total: 1,
          }
        : { data: [], total: 0 },
    );

    render(
      <AdminContext dataProvider={{ getList } as unknown as DataProvider}>
        <ResourceContextProvider value="posts">
          <PostList />
        </ResourceContextProvider>
      </AdminContext>,
    );

    expect(await screen.findByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Frontend, Security')).toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('07.08.2026')).toBeInTheDocument();
    expect(screen.getByText('21:18:22 • 10.11.2026')).toBeInTheDocument();
    expect(getList).toHaveBeenCalledWith(
      'posts',
      expect.objectContaining({
        sort: { field: 'updatedAt', order: 'DESC' },
        pagination: { page: 1, perPage: 50 },
      }),
    );
  });
});
