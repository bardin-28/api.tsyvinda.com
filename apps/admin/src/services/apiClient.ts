import { HttpError } from 'react-admin';
import type { ApiErrorBody } from '@tsyvinda/shared-types';
import { clearSession } from '../auth/sessionStore';

export const AUTH_LOGIN_PATH = '/auth/login';
export const AUTH_REFRESH_PATH = '/auth/refresh';
export const AUTH_LOGOUT_PATH = '/auth/logout';
export const AUTH_ME_PATH = '/auth/me';

const BASE_URL = (import.meta.env.ADMIN_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export interface ApiResponse<T> {
  data: T;
}

export interface RequestOptions {
  params?: Record<string, unknown>;
}

/** A failed API call. `status` is undefined when no response arrived (network failure). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly data?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

// Same shape axios produced: null/undefined dropped, arrays as `key[]`, objects as JSON.
function toQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  const append = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (value instanceof Date) search.append(key, value.toISOString());
    else if (typeof value === 'object') search.append(key, JSON.stringify(value));
    else search.append(key, String(value));
  };
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => append(`${key}[]`, item));
    else append(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// credentials: the API authenticates the panel by its httpOnly admin_* cookies, never a header.
// FormData goes out untouched so fetch sets the multipart boundary itself; objects go as JSON.
async function send<T>(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions | undefined,
): Promise<ApiResponse<T>> {
  const init: RequestInit = { method, credentials: 'include' };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${toQuery(options?.params)}`, init);
  } catch (cause) {
    throw new ApiError('Network Error', undefined, undefined, { cause });
  }

  const data = parseBody(await res.text());
  if (!res.ok) {
    throw new ApiError(`Request failed with status code ${res.status}`, res.status, data);
  }
  return { data: data as T };
}

// Concurrent 401s share one refresh, otherwise each would rotate the refresh cookie and replay the old one
let inFlightRefresh: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  try {
    await send('POST', AUTH_REFRESH_PATH, undefined, undefined);
    return true;
  } catch {
    return false;
  }
}

const isAuthEndpoint = (path: string): boolean =>
  [AUTH_LOGIN_PATH, AUTH_REFRESH_PATH, AUTH_LOGOUT_PATH].some((p) => path.endsWith(p));

// A 401 triggers one cookie refresh and a single replay of the original request.
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  try {
    return await send<T>(method, path, body, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || isAuthEndpoint(path)) {
      throw error;
    }

    inFlightRefresh ??= refreshSession().finally(() => {
      inFlightRefresh = null;
    });

    if (!(await inFlightRefresh)) {
      clearSession();
      throw error;
    }

    return send<T>(method, path, body, options);
  }
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};

export function extractErrorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

// VALIDATION_FAILED carries `details.fieldErrors: { field: [messages] }`; RA wants one message per field.
function toFieldErrors(
  fieldErrors: Record<string, string[] | undefined> | undefined,
): Record<string, string> | undefined {
  if (!fieldErrors) return undefined;
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const first = messages?.[0];
    if (first) out[field] = first;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Normalises an API failure (`{ error: { code, message, details } }`) into react-admin's
 * HttpError, whose `body.errors` RA maps onto form fields as server-side validation.
 */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  const status = extractErrorStatus(error) ?? 500;
  const body = error instanceof ApiError ? (error.data as ApiErrorBody | undefined) : undefined;
  const apiError = body?.error;
  const message =
    apiError?.message ||
    (error instanceof ApiError && error.status === undefined
      ? 'Network error: API unreachable'
      : '') ||
    (error instanceof Error ? error.message : 'Request failed');

  const errors = toFieldErrors(apiError?.details?.fieldErrors);
  return new HttpError(message, status, errors ? { errors, code: apiError?.code } : apiError);
}
