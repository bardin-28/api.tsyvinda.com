import type { CookieOptions, Request, Response } from 'express';
import { config } from '../../../shared/app.config';
import type { AuthSessionResult } from '../services/auth.service';

export const ACCESS_COOKIE_NAME = 'access';
export const REFRESH_COOKIE_NAME = 'refresh';
export const HAS_SESSION_COOKIE_NAME = 'has_session';

function baseCookieOpts(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: config.cookieDomain || undefined,
    maxAge: config.auth.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

function accessCookieOpts(): CookieOptions {
  return { ...baseCookieOpts(), path: '/' };
}

function refreshCookieOpts(): CookieOptions {
  return { ...baseCookieOpts(), path: '/' };
}

function hasSessionCookieOpts(): CookieOptions {
  return { ...baseCookieOpts(), path: '/', httpOnly: false };
}

export function setSessionCookies(res: Response, session: AuthSessionResult): void {
  res.cookie(ACCESS_COOKIE_NAME, session.accessToken, accessCookieOpts());
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOpts());
  res.cookie(HAS_SESSION_COOKIE_NAME, '1', hasSessionCookieOpts());
}

export function clearSessionCookies(res: Response): void {
  const accessClear = accessCookieOpts();
  delete accessClear.maxAge;

  const refreshClear = refreshCookieOpts();
  delete refreshClear.maxAge;

  const hasSessionClear = hasSessionCookieOpts();
  delete hasSessionClear.maxAge;

  res.clearCookie(ACCESS_COOKIE_NAME, accessClear);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshClear);
  res.clearCookie(HAS_SESSION_COOKIE_NAME, hasSessionClear);
}

export function readAccessCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_COOKIE_NAME];
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}

// Admin panel cookies: host-only on the API and scoped to /admin, so website routes never see them
// and the website's COOKIE_DOMAIN cookies can't collide.
export const ADMIN_ACCESS_COOKIE_NAME = 'admin_access';
export const ADMIN_REFRESH_COOKIE_NAME = 'admin_refresh';
export const ADMIN_COOKIE_PATH = '/admin';

function adminCookieOpts(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: ADMIN_COOKIE_PATH,
    maxAge: config.auth.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

export function setAdminSessionCookies(res: Response, session: AuthSessionResult): void {
  res.cookie(ADMIN_ACCESS_COOKIE_NAME, session.accessToken, adminCookieOpts());
  res.cookie(ADMIN_REFRESH_COOKIE_NAME, session.refreshToken, adminCookieOpts());
}

export function clearAdminSessionCookies(res: Response): void {
  const opts = adminCookieOpts();
  delete opts.maxAge;
  res.clearCookie(ADMIN_ACCESS_COOKIE_NAME, opts);
  res.clearCookie(ADMIN_REFRESH_COOKIE_NAME, opts);
}

export function readAdminAccessCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ADMIN_ACCESS_COOKIE_NAME];
}

export function readAdminRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ADMIN_REFRESH_COOKIE_NAME];
}

export function clientUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' && ua ? ua : null;
}

export function clientIp(req: Request): string | null {
  return typeof req.ip === 'string' && req.ip ? req.ip : null;
}
