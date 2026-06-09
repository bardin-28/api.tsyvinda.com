# Plan: Cloudflare Turnstile backend verification

## Goal

Verify Cloudflare Turnstile tokens server-side on the auth and profile mutation
endpoints. The frontend already renders the widget and sends the token under the
body/form key `cf-turnstile-response`; the backend must call Cloudflare's
`siteverify` API and reject requests whose token is missing, invalid, or
unverifiable before the protected handler runs.

---

## Requirements

- Verify the Turnstile token on every state-changing public/auth endpoint the FE
  attaches a token to: `POST /auth/login`, `POST /auth/register`,
  `POST /auth/forgot-password`, `POST /auth/reset-password`, `PATCH /profile`.
- Read the token from the `cf-turnstile-response` key (shared contract with FE).
- Use the secret `TURNSTILE_SECRET_KEY` already added to `.env`.
- Reuse existing project patterns: `zod` env config, `HttpError`, `asyncHandler`,
  middleware composition on the route, Vitest tests for new code.

---

## Architectural decisions

- **Shared module, not auth-local** — Turnstile is used by both `auth` and `users`
  modules, so it lives in `src/shared/turnstile/` (constants, service, middleware)
  rather than inside one feature module.
- **Native `fetch`** — Node 22 ships a global `fetch`; no new dependency for the
  outbound `siteverify` call. Matches the "don't add packages" rule.
- **Optional in dev/test, required in prod** — `TURNSTILE_SECRET_KEY` is optional in
  the env schema but enforced (fail-fast at boot) when `NODE_ENV=production`. When
  no key is configured (dev/test), the middleware skips verification. This mirrors
  the FE behaviour (empty site key disables the widget) and keeps existing auth
  route tests green without mocking Cloudflare in every test.
- **Fail-closed** — missing token → `400 TURNSTILE_REQUIRED`; failed verification →
  `403 TURNSTILE_FAILED`; Cloudflare unreachable/non-200 → `502 TURNSTILE_UNAVAILABLE`.
- **Middleware runs before `validate`** — the zod schemas strip unknown keys, so the
  token must be read before validation. For `PATCH /profile` the middleware is placed
  after `multer` (field parsed into `req.body`) and after `cleanupUploadOnError` (so a
  rejected request still triggers the uploaded-file cleanup hook).
- **Token consumed** — after a successful check the middleware deletes
  `cf-turnstile-response` from `req.body` so it never leaks into handlers/logs.

---

## Implementation Checklist

### ✅ Phase 1 — Shared Turnstile module + config

- **Step 1** — Add `TURNSTILE_SECRET_KEY` to `app.config.ts` (optional, prod-required
  via `superRefine`); expose as `config.turnstile.secretKey`.
- **Step 2** — `src/shared/turnstile/constants.ts`: `TURNSTILE_TOKEN_FIELD`,
  `SITEVERIFY_URL`.
- **Step 3** — `src/shared/turnstile/turnstile.service.ts`: `verifyTurnstileToken(token, remoteIp?)`
  → calls siteverify, returns `{ success, errorCodes }`.
- **Step 4** — `src/shared/turnstile/turnstile.middleware.ts`: `requireTurnstile`.
- **Step 5** — Unit tests for service (mock `fetch`) and middleware (mock service + config).

### ✅ Phase 2 — Wire middleware into routes

- **Step 1** — Add `requireTurnstile` before `validate` on login, register,
  forgot-password, reset-password.
- **Step 2** — Add `requireTurnstile` to `PATCH /profile` after multer + cleanup.
- **Step 3** — Add `TURNSTILE_SECRET_KEY` to `.env.example`; add to `vitest.config.ts`
  only if a test needs the enforced path (otherwise leave unset so skip-path is default).

### ✅ Phase 3 — Report

- **Step 1** — Write `reports/turnstile.md` from the template.

---

## Important Notes

- The FE sends the token in JSON for the four auth endpoints and as a multipart form
  field for `PATCH /profile`; the middleware must read `req.body[...]` in both cases,
  which works because `express.json` and `multer` both populate `req.body`.
- `remoteip` is optional for siteverify; we pass `req.ip` (Express `trust proxy` is set).
