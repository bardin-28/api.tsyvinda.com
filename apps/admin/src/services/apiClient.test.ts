import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpError } from 'react-admin';
import { ApiError, apiClient, toHttpError } from './apiClient';
import { getUser, setUser } from '../auth/sessionStore';
import type { User } from '@tsyvinda/shared-types';

const respond = (status: number, data: unknown = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const user = { id: 'u1', email: 'a@example.com' } as User;

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

let apiHandler: ReturnType<typeof vi.fn<Handler>>;
let refreshHandler: ReturnType<typeof vi.fn<Handler>>;
let fetchMock: ReturnType<typeof vi.fn<Handler>>;

beforeEach(() => {
  apiHandler = vi.fn<Handler>();
  refreshHandler = vi.fn<Handler>();
  fetchMock = vi.fn<Handler>((url, init) =>
    url.endsWith('/auth/refresh') ? refreshHandler(url, init) : apiHandler(url, init),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient requests', () => {
  it('prefixes the base URL, sends cookies and serialises params like axios did', async () => {
    apiHandler.mockResolvedValue(respond(200, { ok: true }));

    const res = await apiClient.get('/users', {
      params: { q: 'a b', page: 2, empty: undefined, gone: null, ids: [1, 2] },
    });

    expect(res.data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/admin/users?q=a+b&page=2&ids%5B%5D=1&ids%5B%5D=2');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('sends objects as JSON and FormData untouched', async () => {
    apiHandler.mockImplementation(async () => respond(200));
    const form = new FormData();
    form.append('title', 'x');

    await apiClient.post('/posts', { title: 'x' });
    await apiClient.patch('/posts/1', form);

    const [, jsonInit] = fetchMock.mock.calls[0]!;
    expect(jsonInit.body).toBe('{"title":"x"}');
    expect(jsonInit.headers).toEqual({ 'Content-Type': 'application/json' });
    const [, formInit] = fetchMock.mock.calls[1]!;
    expect(formInit.body).toBe(form);
    expect(formInit.headers).toBeUndefined();
  });

  it('resolves empty bodies (204) with undefined data', async () => {
    apiHandler.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiClient.delete('/posts/1')).resolves.toEqual({ data: undefined });
  });

  it('rejects non-2xx with an ApiError carrying status and body', async () => {
    apiHandler.mockResolvedValue(respond(404, { error: { code: 'NOT_FOUND' } }));
    const err = await apiClient.get('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).data).toEqual({ error: { code: 'NOT_FOUND' } });
  });
});

describe('apiClient 401 handling', () => {
  it('refreshes once and retries the original request', async () => {
    apiHandler
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, { ok: true }));
    refreshHandler.mockImplementation(async () => respond(200));

    const res = await apiClient.get('/dashboard');

    expect(res.data).toEqual({ ok: true });
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(apiHandler).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh between concurrent 401s', async () => {
    let calls = 0;
    apiHandler.mockImplementation(async () => (++calls <= 2 ? respond(401) : respond(200)));
    refreshHandler.mockImplementation(async () => respond(200));

    await Promise.all([apiClient.get('/a'), apiClient.get('/b')]);

    expect(refreshHandler).toHaveBeenCalledTimes(1);
  });

  it('clears the cached session when the refresh fails', async () => {
    setUser(user);
    apiHandler.mockImplementation(async () => respond(401));
    refreshHandler.mockImplementation(async () => respond(401));

    await expect(apiClient.get('/dashboard')).rejects.toBeInstanceOf(ApiError);
    expect(getUser()).toBeNull();
  });

  it('never refreshes for the auth endpoints themselves', async () => {
    apiHandler.mockImplementation(async () => respond(401));

    await expect(apiClient.post('/auth/login', {})).rejects.toBeInstanceOf(ApiError);
    expect(refreshHandler).not.toHaveBeenCalled();
  });
});

describe('toHttpError', () => {
  const apiError = (status: number, data: unknown) => new ApiError('fail', status, data);

  it('uses the API error message and status', () => {
    const err = toHttpError(
      apiError(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      }),
    );
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid email or password');
  });

  it('maps VALIDATION_FAILED fieldErrors onto body.errors (first message per field)', () => {
    const err = toHttpError(
      apiError(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: { formErrors: [], fieldErrors: { email: ['email must be an email', 'x'] } },
        },
      }),
    );
    expect(err.body).toEqual({
      errors: { email: 'email must be an email' },
      code: 'VALIDATION_FAILED',
    });
  });

  it('reports an unreachable API as a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = toHttpError(await apiClient.get('/x').catch((e: unknown) => e));
    expect(err.status).toBe(500);
    expect(err.message).toMatch(/network error/i);
  });
});
