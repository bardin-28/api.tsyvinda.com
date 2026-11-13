import { describe, it, expect, vi } from 'vitest';
import { HttpError } from 'react-admin';
import { dataProvider, toRequestBody } from './dataProvider';
import { ApiError, apiClient } from '../services/apiClient';

describe('dataProvider', () => {
  it('getList sends paging, sort and filters as query params and maps items/total', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { items: [{ id: 1 }], total: 7 } });

    const result = await dataProvider.getList('users', {
      pagination: { page: 2, perPage: 25 },
      sort: { field: 'createdAt', order: 'DESC' },
      filter: { q: 'ada' },
    });

    expect(get).toHaveBeenCalledWith('/users', {
      params: { q: 'ada', page: 2, perPage: 25, sort: 'createdAt', order: 'DESC' },
    });
    expect(result).toEqual({ data: [{ id: 1 }], total: 7 });
  });

  it('update PATCHes /<resource>/:id', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: { id: 3, name: 'x' } });

    const result = await dataProvider.update('users', {
      id: 3,
      data: { name: 'x' },
      previousData: { id: 3 },
    });

    expect(patch).toHaveBeenCalledWith('/users/3', { name: 'x' });
    expect(result.data).toEqual({ id: 3, name: 'x' });
  });

  it('getDashboard reads /dashboard', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { users: {} } });
    await expect(dataProvider.getDashboard()).resolves.toEqual({ users: {} });
    expect(get).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects with an RA HttpError carrying the API message', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(
      new ApiError('fail', 404, { error: { code: 'NOT_FOUND', message: 'User not found' } }),
    );

    const err = await dataProvider.getOne('users', { id: 'missing' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(404);
    expect((err as HttpError).message).toBe('User not found');
  });

  it('create sends JSON when no file was picked', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { id: 1 } });
    await dataProvider.create('posts', { data: { title: 'x' } });
    expect(post).toHaveBeenCalledWith('/posts', { title: 'x' });
  });
});

describe('toRequestBody', () => {
  it('switches to multipart when a picked file is present', () => {
    const rawFile = new File(['x'], 'cover.png', { type: 'image/png' });
    const body = toRequestBody({ title: 'Hi', removeImage: true, image: { rawFile }, gone: null });

    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('title')).toBe('Hi');
    expect(form.get('removeImage')).toBe('true');
    expect(form.get('image')).toBeInstanceOf(File);
    expect(form.has('gone')).toBe(false);
  });

  it('leaves plain objects as JSON', () => {
    const data = { title: 'Hi' };
    expect(toRequestBody(data)).toBe(data);
  });
});

describe('dataProvider CMS actions', () => {
  it('uploads page images as multipart', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { url: 'https://cdn.example/pages/a.png' } });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(dataProvider.uploadPageImage(file)).resolves.toEqual({
      url: 'https://cdn.example/pages/a.png',
    });
    const [path, body] = post.mock.calls[0]!;
    expect(path).toBe('/pages/uploads');
    expect((body as FormData).get('image')).toBe(file);
  });

  it('PUTs page addresses', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { id: 'about' } });
    await dataProvider.updatePageSlugs('about', { uk: 'pro-mene' });
    expect(put).toHaveBeenCalledWith('/pages/about/slugs', { slugs: { uk: 'pro-mene' } });
  });

  it('maps CMS field errors (one message per path) onto form fields', async () => {
    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      new ApiError('fail', 400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Page content is invalid',
          details: { fieldErrors: { 'draft.blocks.0.data.title.en': 'At most 300 characters' } },
        },
      }),
    );
    const err = (await dataProvider
      .update('pages', { id: 'about', data: {}, previousData: { id: 'about' } })
      .catch((e: unknown) => e)) as HttpError;
    expect(err.body.errors).toEqual({ 'draft.blocks.0.data.title.en': 'At most 300 characters' });
  });
});
