import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { HttpError } from 'react-admin';
import type { ApiErrorBody } from '@tsyvinda/shared-types';
import { clearSession } from '../auth/sessionStore';

export const AUTH_LOGIN_PATH = '/auth/login';
export const AUTH_REFRESH_PATH = '/auth/refresh';
export const AUTH_LOGOUT_PATH = '/auth/logout';
export const AUTH_ME_PATH = '/auth/me';

// withCredentials: the API authenticates the panel by its httpOnly admin_* cookies, never a header.
// No fixed Content-Type: axios picks JSON for objects and multipart (with boundary) for FormData;
// a JSON default would make it serialize FormData uploads to JSON.
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.ADMIN_PUBLIC_API_URL,
  withCredentials: true,
});

// Separate instance so the refresh call never re-enters the 401 interceptor (exported for tests)
export const refreshClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.ADMIN_PUBLIC_API_URL,
  withCredentials: true,
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// Concurrent 401s share one refresh, otherwise each would rotate the refresh cookie and replay the old one
let inFlightRefresh: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  try {
    await refreshClient.post(AUTH_REFRESH_PATH);
    return true;
  } catch {
    return false;
  }
}

const isAuthEndpoint = (url: string | undefined): boolean =>
  !!url &&
  [AUTH_LOGIN_PATH, AUTH_REFRESH_PATH, AUTH_LOGOUT_PATH].some((path) => url.endsWith(path));

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || error.response?.status !== 401) {
    throw error;
  }

  const config = error.config as RetriableConfig | undefined;
  if (!config || config._retried || isAuthEndpoint(config.url)) {
    throw error;
  }

  inFlightRefresh ??= refreshSession().finally(() => {
    inFlightRefresh = null;
  });

  if (!(await inFlightRefresh)) {
    clearSession();
    throw error;
  }

  config._retried = true;
  return apiClient.request(config);
});

export function extractErrorStatus(error: unknown): number | undefined {
  if (error instanceof AxiosError) {
    return error.response?.status ?? error.status;
  }
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
  const body =
    error instanceof AxiosError ? (error.response?.data as ApiErrorBody | undefined) : undefined;
  const apiError = body?.error;
  const message =
    apiError?.message ||
    (error instanceof AxiosError && !error.response ? 'Network error: API unreachable' : '') ||
    (error instanceof Error ? error.message : 'Request failed');

  const errors = toFieldErrors(apiError?.details?.fieldErrors);
  return new HttpError(message, status, errors ? { errors, code: apiError?.code } : apiError);
}
