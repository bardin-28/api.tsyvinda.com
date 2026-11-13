import React, { useImperativeHandle } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext, TestMemoryRouter, type DataProvider } from 'react-admin';
import { Route, Routes } from 'react-router-dom';
import type { Post } from '@tsyvinda/shared-types';
import { CoverGeneratorPage, coverTextFromPost } from './CoverGeneratorPage';
import { DEFAULT_COVER } from './coverConfig';

// jsdom has no WebGL: replace the three.js composer with a stub that yields a fixed JPEG blob.
const jpegBlob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
vi.mock('./CoverComposer', () => ({
  CoverComposer: ({ ref }: { ref?: React.Ref<{ toJpegBlob: () => Promise<Blob> }> }) => {
    useImperativeHandle(ref, () => ({ toJpegBlob: () => Promise.resolve(jpegBlob) }), []);
    return <canvas aria-label="Cover preview" />;
  },
}));

const post: Post = {
  id: 'p1',
  locale: 'en',
  locales: ['en'],
  title: 'Shipping with confidence',
  slug: 'shipping-with-confidence',
  description: 'Release checklists that hold up.',
  htmlContent: '<p>Body</p>',
  imageUrl: null,
  coverAlt: null,
  categories: [],
  status: 'published',
  publishedAt: '2026-10-01T10:00:00.000Z',
  seoTitle: null,
  seoDescription: null,
  ogImageUrl: null,
  canonicalUrl: null,
  author: { id: 'u1', firstName: 'Ada', lastName: 'Admin' } as Post['author'],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

function renderPage(path: string, dataProvider: Partial<DataProvider>) {
  return render(
    <TestMemoryRouter initialEntries={[path]}>
      <AdminContext dataProvider={dataProvider as DataProvider}>
        <Routes>
          <Route path="/blog/cover" element={<CoverGeneratorPage />} />
        </Routes>
      </AdminContext>
    </TestMemoryRouter>,
  );
}

describe('coverTextFromPost', () => {
  it('takes the title and uses the description as subtitle', () => {
    expect(coverTextFromPost(post, DEFAULT_COVER)).toMatchObject({
      title: 'Shipping with confidence',
      subtitle: 'Release checklists that hold up.',
      showSubtitle: true,
    });
  });

  it('keeps the current subtitle when the post has no description', () => {
    const next = coverTextFromPost({ title: 'T', description: null }, DEFAULT_COVER);
    expect(next.subtitle).toBe(DEFAULT_COVER.subtitle);
  });
});

describe('CoverGeneratorPage', () => {
  let dataProvider: Partial<DataProvider>;

  beforeEach(() => {
    dataProvider = {
      getList: vi.fn().mockResolvedValue({ data: [post], total: 1 }),
      getOne: vi.fn().mockResolvedValue({ data: post }),
      update: vi
        .fn()
        .mockResolvedValue({ data: { ...post, imageUrl: 'https://cdn.test/posts/new.jpg' } }),
    };
  });

  it('prefills from ?postId and uploads the JPEG as the post cover', async () => {
    renderPage('/blog/cover?postId=p1', dataProvider);

    // The picker shows the post title too, so check the cover's own Title field.
    await waitFor(() =>
      expect(screen.getByLabelText(/^title$/i)).toHaveValue('Shipping with confidence'),
    );
    expect(screen.getByLabelText('Post')).toHaveValue('Shipping with confidence');

    await userEvent.click(screen.getByRole('button', { name: /set as post cover/i }));

    await waitFor(() => expect(dataProvider.update).toHaveBeenCalled());
    const [resource, params] = vi.mocked(dataProvider.update!).mock.calls[0]!;
    expect(resource).toBe('posts');
    expect(params.id).toBe('p1');
    const file = params.data.image.rawFile as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('shipping-with-confidence.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(await screen.findByText('Has a cover')).toBeInTheDocument();
  });

  it('asks before replacing an existing cover', async () => {
    dataProvider.getOne = vi
      .fn()
      .mockResolvedValue({ data: { ...post, imageUrl: 'https://cdn.test/posts/old.jpg' } });
    renderPage('/blog/cover?postId=p1', dataProvider);

    await screen.findByText('Has a cover');
    await userEvent.click(screen.getByRole('button', { name: /set as post cover/i }));
    expect(await screen.findByText(/replace the post cover/i)).toBeInTheDocument();
    expect(dataProvider.update).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /^replace$/i }));
    await waitFor(() => expect(dataProvider.update).toHaveBeenCalledTimes(1));
  });

  it('keeps "Set as post cover" disabled until a post is picked', async () => {
    renderPage('/blog/cover', dataProvider);
    expect(await screen.findByRole('button', { name: /set as post cover/i })).toBeDisabled();
    expect(dataProvider.getOne).not.toHaveBeenCalled();
  });

  it('downloads the JPEG named after the title', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:cover');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPage('/blog/cover', dataProvider);
    await userEvent.click(await screen.findByRole('button', { name: /download jpeg/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    const link = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('notes-on-building-software.jpg');
    expect(createObjectURL).toHaveBeenCalledWith(jpegBlob);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cover');
    clickSpy.mockRestore();
  });
});
