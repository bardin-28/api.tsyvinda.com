# Report: Cloudflare Turnstile backend verification

**Status**: ✅ Delivered
**Date**: 2026-06-05
**Plan**: `plans/turnstile.md`

---

## 1. Goal

Verify Cloudflare Turnstile tokens server-side on the auth + profile mutation
endpoints. The frontend already renders the widget and attaches the token under the
body/form key `cf-turnstile-response`; the backend now calls Cloudflare's
`siteverify` API and rejects requests with a missing, invalid, or unverifiable
token before the protected handler runs.

**Deliberately deferred**: rotating/idempotency keys for siteverify, per-action
Turnstile `action` binding, and caching of verified tokens (each token is
single-use by design).

---

## 2. Scope delivered

### Endpoints (verification added)

| Method | Path | Transport | Notes |
| ------ | ---- | --------- | ----- |
| POST | `/auth/login` | JSON | token in body |
| POST | `/auth/register` | JSON | token in body |
| POST | `/auth/forgot-password` | JSON | token in body |
| POST | `/auth/reset-password` | JSON | token in body |
| PATCH | `/profile` | multipart/form-data | token as form field; runs after multer + upload-cleanup |

`POST /auth/confirm-email` is intentionally **not** protected — the FE sends no
token there (it already carries an opaque email-confirmation token).

### Failure responses

| Condition | Status | Code |
| --------- | ------ | ---- |
| token missing/empty | 400 | `TURNSTILE_REQUIRED` |
| Cloudflare says invalid | 403 | `TURNSTILE_FAILED` |
| Cloudflare unreachable / non-200 / bad JSON | 502 | `TURNSTILE_UNAVAILABLE` |
| secret missing outside dev/test (defensive) | 500 | `TURNSTILE_MISCONFIGURED` |

---

## 3. Tech used & why

| Choice | Why | Alternative rejected |
| ------ | --- | -------------------- |
| Native global `fetch` | Node 22 ships it; no new dependency (repo rule) | `axios`/`got` — extra dep for one POST |
| Shared module `src/shared/turnstile/` | Used by both `auth` and `users` modules | auth-local — would force `users` to import across modules |
| `URLSearchParams` body | siteverify expects `application/x-www-form-urlencoded` | JSON body — Cloudflare accepts form-encoded canonically |
| `AbortController` 10s timeout | A hung Cloudflare call must not stall the endpoint | no timeout — request could hang indefinitely |
| Optional secret, prod-required (`superRefine`) | Keeps dev/test green without mocking Cloudflare everywhere; fails fast in prod if misconfigured | always-required — breaks every existing auth route test |

---

## 4. Files

### New
- `src/shared/turnstile/constants.ts` — `TURNSTILE_TOKEN_FIELD`, `SITEVERIFY_URL`, timeout.
- `src/shared/turnstile/turnstile.service.ts` — `verifyTurnstileToken()` + `TurnstileUnavailableError`.
- `src/shared/turnstile/turnstile.middleware.ts` — `requireTurnstile` Express middleware.
- `src/shared/turnstile/turnstile.service.test.ts` — 5 tests (fetch mocked).
- `src/shared/turnstile/turnstile.middleware.test.ts` — 6 tests (config + service mocked).

### Modified
- `src/shared/app.config.ts` — added `TURNSTILE_SECRET_KEY` (optional; prod-required) → `config.turnstile.secretKey`.
- `src/shared/app.config.test.ts` — updated prod test + 2 new turnstile-config tests.
- `src/modules/auth/routes/{login,register,forgot-password,reset-password}.ts` — `requireTurnstile` before `validate`.
- `src/modules/users/routes/profile.ts` — `requireTurnstile` after multer + `cleanupUploadOnError`, before `validate`.

---

## 5. Verification

- `npm run typecheck` — clean.
- `npm run lint` — "No issues found".
- `npx vitest run src/shared/turnstile src/shared/app.config.test.ts` — **14 passed**.

### Pre-existing failures (NOT introduced here)

The supertest integration suites (`app.test.ts`, `auth.routes.test.ts`,
`users.routes.test.ts`) fail with `TypeError: Cannot read properties of null
(reading 'port')` inside supertest's `serverAddress`. Confirmed pre-existing by
stashing all Turnstile changes and re-running — failures persist. Likely the
runner is on Node v24 while `.nvmrc` pins Node 22. Run the suite under Node 22.

---

## 6. Manual follow-up required

- **`.env.example`** could not be edited — the agent sandbox denies `.env*`
  access. Add manually:
  ```
  TURNSTILE_SECRET_KEY=0x0000000000000000000000000000000000000000
  ```
- Set the real `TURNSTILE_SECRET_KEY` in `.env.production` before deploy (boot
  fails without it when `NODE_ENV=production`).
