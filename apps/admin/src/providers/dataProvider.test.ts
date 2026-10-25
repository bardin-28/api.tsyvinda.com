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
