import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { HttpError } from 'react-admin';
import { apiClient, refreshClient, toHttpError } from './apiClient';
import { getUser, setUser } from '../auth/sessionStore';
import type { User } from '@tsyvinda/shared-types';

const respond = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown = {},
): AxiosResponse => ({ status, statusText: '', data, headers: {}, config });

const fail = (config: InternalAxiosRequestConfig, status: number, data: unknown = {}) =>
  Promise.reject(
    new AxiosError('fail', String(status), config, null, respond(config, status, data)),
  );

const user = { id: 'u1', email: 'a@example.com' } as User;

let apiAdapter: ReturnType<typeof vi.fn<AxiosAdapter>>;
let refreshAdapter: ReturnType<typeof vi.fn<AxiosAdapter>>;

beforeEach(() => {
  apiAdapter = vi.fn<AxiosAdapter>();
  refreshAdapter = vi.fn<AxiosAdapter>();
  apiClient.defaults.adapter = apiAdapter;
  refreshClient.defaults.adapter = refreshAdapter;
});

describe('apiClient 401 handling', () => {
  it('refreshes once and retries the original request', async () => {
    apiAdapter
      .mockImplementationOnce((config) => fail(config, 401))
      .mockImplementationOnce(async (config) => respond(config, 200, { ok: true }));
    refreshAdapter.mockImplementation(async (config) => respond(config, 200));

    const res = await apiClient.get('/dashboard');

    expect(res.data).toEqual({ ok: true });
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
    expect(apiAdapter).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh between concurrent 401s', async () => {
    let calls = 0;
    apiAdapter.mockImplementation((config) =>
      ++calls <= 2 ? fail(config, 401) : Promise.resolve(respond(config, 200)),
    );
    refreshAdapter.mockImplementation(async (config) => respond(config, 200));

    await Promise.all([apiClient.get('/a'), apiClient.get('/b')]);

    expect(refreshAdapter).toHaveBeenCalledTimes(1);
  });

  it('clears the cached session when the refresh fails', async () => {
    setUser(user);
    apiAdapter.mockImplementation((config) => fail(config, 401));
    refreshAdapter.mockImplementation((config) => fail(config, 401));

    await expect(apiClient.get('/dashboard')).rejects.toBeInstanceOf(AxiosError);
    expect(getUser()).toBeNull();
  });

  it('never refreshes for the auth endpoints themselves', async () => {
    apiAdapter.mockImplementation((config) => fail(config, 401));

    await expect(apiClient.post('/auth/login', {})).rejects.toBeInstanceOf(AxiosError);
    expect(refreshAdapter).not.toHaveBeenCalled();
  });
});

describe('toHttpError', () => {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const axiosError = (status: number, data: unknown) =>
    new AxiosError('fail', String(status), config, null, respond(config, status, data));

  it('uses the API error message and status', () => {
    const err = toHttpError(
      axiosError(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      }),
    );
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid email or password');
  });

  it('maps VALIDATION_FAILED fieldErrors onto body.errors (first message per field)', () => {
    const err = toHttpError(
      axiosError(400, {
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

  it('reports an unreachable API as a network error', () => {
    const err = toHttpError(new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(err.status).toBe(500);
    expect(err.message).toMatch(/network error/i);
  });
});
